import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',').map(s => s.trim()).filter(Boolean),
  provider: process.env.LLM_PROVIDER || 'nvidia',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  llmApiKey: process.env.LLM_API_KEY || 'ollama',
  llmModel: process.env.LLM_MODEL || 'meta/llama-3.1-8b-instruct',
  llmTimeoutMs: Number(process.env.LLM_TIMEOUT_MS || 90000),
  llmMaxOutputTokens: Number(process.env.LLM_MAX_OUTPUT_TOKENS || 1024),
  llmMaxConcurrent: Number(process.env.LLM_MAX_CONCURRENT_REQUESTS || 20),
  rateWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateMax: Number(process.env.RATE_LIMIT_MAX || 120),
  chatRateMax: Number(process.env.CHAT_RATE_LIMIT_MAX || 20),
  maxMessageChars: Number(process.env.MAX_MESSAGE_CHARS || 12000),
  maxContextMessages: Number(process.env.MAX_CONTEXT_MESSAGES || 20)
};
