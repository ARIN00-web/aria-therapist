import { Schema, model, Document } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
}

export interface ISession extends Document {
  userId: Schema.Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  moodBefore?: number;
  moodAfter?: number;
  messages: IMessage[];
  rollingSummary?: string;
}

const MessageSchema = new Schema<IMessage>({
  role: { type: String, required: true, enum: ['user', 'assistant'] },
  content: {
    type: String,
    required: true,

    set: (val: string) => encrypt(val),

    get: (val: string) => decrypt(val)
  },
  ts: { type: Date, default: Date.now }
});

const SessionSchema = new Schema<ISession>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date },
  moodBefore: { type: Number, min: 1, max: 10 },
  moodAfter: { type: Number, min: 1, max: 10 },
  messages: [MessageSchema],
  rollingSummary: { type: String }
}, {

  toJSON: { getters: true },
  toObject: { getters: true }
});

export const SessionModel = model<ISession>('Session', SessionSchema);
