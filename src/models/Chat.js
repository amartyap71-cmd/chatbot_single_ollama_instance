import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 120, default: 'New chat' },
  lastMessageAt: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

chatSchema.index({ userId: 1, lastMessageAt: -1, _id: -1 });
export default mongoose.model('Chat', chatSchema);
