import { Schema, model, Document, Types } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

export interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: Date;
}

export interface ISession extends Document {
  userId: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  moodBefore?: number;
  moodAfter?: number;
  messages: IMessage[];
  rollingSummary?: string;
  summaryMessageCount: number;
  status: 'active' | 'paused_for_crisis' | 'ended';
  summaryCard?: {
    themes: string[];
    reflection: string;
    nextTopic: string;
  };
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
  rollingSummary: {
    type: String,
    set: (val: string) => encrypt(val),
    get: (val: string) => decrypt(val),
    default: ''
  },
  summaryMessageCount: { type: Number, default: 0, min: 0 },
  status: {
    type: String,
    enum: ['active', 'paused_for_crisis', 'ended'],
    default: 'active'
  },
  summaryCard: {
    themes: { type: [String], default: [] },
    reflection: { type: String, default: '' },
    nextTopic: { type: String, default: '' }
  }
}, {

  toJSON: { getters: true },
  toObject: { getters: true }
});

export const SessionModel = model<ISession>('Session', SessionSchema);
