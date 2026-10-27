import OpenAI from 'openai';
import { config } from '../config.js';

// The OpenAI-compatible client works with NVIDIA API Catalog and current
// Ollama versions exposing /v1. Keep provider credentials server-side.
const client = new OpenAI({
  baseURL: config.llmBaseUrl,
  apiKey: config.llmApiKey,
  timeout: config.llmTimeoutMs,
  maxRetries: 1
});

// Per-process backpressure. This protects one instance; use a shared queue or
// distributed semaphore if you need a strict global concurrency ceiling.
let active = 0;
const waiting = [];
async function acquireSlot() {
  if (active < config.llmMaxConcurrent) { active++; return; }
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const i = waiting.findIndex(x => x.resolve === resolve);
      if (i >= 0) waiting.splice(i, 1);
      reject(Object.assign(new Error('AI service is busy. Try again shortly.'), { status: 503 }));
    }, 15000);
    waiting.push({ resolve: () => { clearTimeout(timer); active++; resolve(); } });
  });
}
function releaseSlot() {
  active = Math.max(0, active - 1);
  const next = waiting.shift();
  if (next) next.resolve();
}

export async function streamChat(messages, onToken, signal) {
  await acquireSlot();
  try {
    const stream = await client.chat.completions.create({
      model: config.llmModel,
      messages,
      stream: true,
      max_tokens: config.llmMaxOutputTokens
    }, { signal });

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content;
      if (token) onToken(token);
    }
  } finally {
    releaseSlot();
  }
}
