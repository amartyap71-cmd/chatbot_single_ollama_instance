import { Router } from 'express';
import mongoose from 'mongoose';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { streamChat } from '../services/llm.js';

const router = Router();
router.use(requireAuth);

function validId(id) {
  return mongoose.isValidObjectId(id);
}
function sendSse(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.get('/', async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const filter = { userId: req.userId };
  if (req.query.before) {
    if (!validId(req.query.before)) return res.status(400).json({ error: 'Invalid cursor.' });
    filter._id = { $lt: req.query.before };
  }
  const chats = await Chat.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = chats.length > limit;
  if (hasMore) chats.pop();
  res.json({ chats, nextCursor: hasMore ? String(chats[chats.length - 1]._id) : null });
});

router.post('/', async (req, res) => {
  const title = String(req.body?.title || 'New chat').trim().slice(0, 120) || 'New chat';
  const chat = await Chat.create({ userId: req.userId, title });
  res.status(201).json({ chat });
});

router.get('/:chatId/messages', async (req, res) => {
  const { chatId } = req.params;
  if (!validId(chatId)) return res.status(400).json({ error: 'Invalid chat ID.' });
  const chat = await Chat.findOne({ _id: chatId, userId: req.userId }).lean();
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const filter = { chatId, userId: req.userId };
  if (req.query.before) {
    const date = new Date(req.query.before);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid before timestamp.' });
    filter.createdAt = { $lt: date };
  }
  const messages = await Message.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();
  messages.reverse();
  res.json({ chat, messages, hasMore });
});

router.delete('/:chatId', async (req, res) => {
  const { chatId } = req.params;
  if (!validId(chatId)) return res.status(400).json({ error: 'Invalid chat ID.' });
  const chat = await Chat.findOneAndDelete({ _id: chatId, userId: req.userId });
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });
  await Message.deleteMany({ chatId, userId: req.userId });
  res.status(204).end();
});

// SSE endpoint. Save the user message before generation and the complete
// assistant response afterward. A disconnect aborts provider generation.
router.post('/:chatId/messages', async (req, res) => {
  const { chatId } = req.params;
  if (!validId(chatId)) return res.status(400).json({ error: 'Invalid chat ID.' });
  const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
  if (!content) return res.status(400).json({ error: 'Message content is required.' });
  if (content.length > config.maxMessageChars) return res.status(413).json({ error: `Message exceeds ${config.maxMessageChars} characters.` });

  const chat = await Chat.findOne({ _id: chatId, userId: req.userId });
  if (!chat) return res.status(404).json({ error: 'Chat not found.' });

  const prior = await Message.find({ chatId, userId: req.userId })
    .sort({ createdAt: -1, _id: -1 }).limit(config.maxContextMessages)
    .select('role content createdAt').lean();
  prior.reverse();
  await Message.create({ chatId, userId: req.userId, role: 'user', content });
  chat.lastMessageAt = new Date();
  if (chat.title === 'New chat') chat.title = content.slice(0, 60);
  await chat.save();

  const messages = [
    { role: 'system', content: 'You are a helpful AI assistant. Be accurate, clear, and concise.' },
    ...prior.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content }
  ];

  const controller = new AbortController();
  let disconnected = false;
  res.on('close', () => {
    // The response close event fires when the client disconnects or the
    // response completes. Only abort on an incomplete response.
    if (!res.writableEnded) {
      disconnected = true;
      controller.abort();
    }
  });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  let fullResponse = '';
  try {
    await streamChat(messages, token => {
      if (disconnected || res.destroyed) return;
      fullResponse += token;
      sendSse(res, 'token', { token });
    }, controller.signal);

    if (!disconnected && fullResponse) {
      await Message.create({ chatId, userId: req.userId, role: 'assistant', content: fullResponse });
      chat.lastMessageAt = new Date();
      await chat.save();
      sendSse(res, 'done', { chatId, saved: true });
    } else if (!disconnected) {
      sendSse(res, 'error', { error: 'The model returned an empty response.' });
    }
  } catch (err) {
    if (!disconnected && !res.destroyed) {
      sendSse(res, 'error', { error: err.status === 503 ? err.message : 'AI generation failed. Please retry.' });
    }
    if (!controller.signal.aborted) console.error('LLM stream failed:', err.message);
  } finally {
    if (!res.destroyed) res.end();
  }
});

export default router;
