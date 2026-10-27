import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({}, config.jwtSecret, { subject: String(user._id), expiresIn: config.jwtExpiresIn });
}

router.post('/register', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!emailPattern.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email.' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ error: 'Password must be 10–128 characters.' });
  const existing = await User.exists({ email });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, passwordHash });
    return res.status(201).json({ token: issueToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'An account with this email already exists.' });
    throw err;
  }
});

router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = user && await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });
  return res.json({ token: issueToken(user), user: { id: user.id, email: user.email } });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select('email createdAt');
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: { id: user.id, email: user.email, createdAt: user.createdAt } });
});

export default router;
