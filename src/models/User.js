import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });

export default mongoose.model('User', userSchema);
