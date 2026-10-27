import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 100000 },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

messageSchema.index({ chatId: 1, createdAt: 1, _id: 1 });
messageSchema.index({ userId: 1, chatId: 1 });
export default mongoose.model('Message', messageSchema);
