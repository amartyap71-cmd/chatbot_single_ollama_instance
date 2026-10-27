import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import { notFound, errorHandler } from './middleware/errors.js';

const app = express();
app.disable('x-powered-by');
// Set this only to the number of trusted proxies in your deployment.
// Avoid `true` unless your ingress/load balancer is configured safely.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
}));
app.use(express.json({ limit: '32kb' }));

const apiLimiter = rateLimit({
  windowMs: config.rateWindowMs,
  limit: config.rateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
const chatLimiter = rateLimit({
  windowMs: config.rateWindowMs,
  limit: config.chatRateMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many chat requests. Please wait and retry.' }
});

app.get('/health/live', (req, res) => res.json({ ok: true }));
app.get('/health/ready', (req, res) => {
  const mongoose = app.locals.mongoose;
  const ready = mongoose?.connection?.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready });
});
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/chats', (req, res, next) => {
  if (req.method === 'POST' && req.path.endsWith('/messages')) return chatLimiter(req, res, next);
  next();
}, chatRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
