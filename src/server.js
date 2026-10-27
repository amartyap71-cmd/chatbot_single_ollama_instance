import 'express-async-errors';
import app from './app.js';
import mongoose from 'mongoose';
import { config } from './config.js';
import { connectDatabase } from './db.js';

app.locals.mongoose = mongoose;

await connectDatabase(config.mongoUri);
const server = app.listen(config.port, () => {
  console.log(`API listening on port ${config.port} (${config.nodeEnv})`);
});

function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await mongoose.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
