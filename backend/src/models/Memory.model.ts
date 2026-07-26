import { Schema, model, Document, Types } from 'mongoose';
import { encrypt, decrypt } from '../utils/encryption';

export interface IMemoryProfile {
  recurringThemes: string[];
  keyPeople: Array<{ name: string; relationship: string; dynamic: string }>;
  triggers: string[];
  copingStrategies: Array<{ strategy: string; effectiveness: string }>;
  progressNotes: string[];
  moodTrend?: string;
  followUpTopics: string[];
}

export interface IMemory extends Document {
  userId: Types.ObjectId;
  profile: IMemoryProfile;
  lastUpdated: Date;
}

const encryptedString = {
  type: String,
  set: (val: string) => encrypt(val),
  get: (val: string) => decrypt(val)
};

const MemorySchema = new Schema<IMemory>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  profile: {
    recurringThemes: { type: [encryptedString], default: [] },
    keyPeople: [{
      name: { ...encryptedString, required: true },
      relationship: { ...encryptedString, required: true },
      dynamic: { ...encryptedString, default: '' }
    }],
    triggers: { type: [encryptedString], default: [] },
    copingStrategies: [{
      strategy: { ...encryptedString, required: true },
      effectiveness: { ...encryptedString, default: 'medium' }
    }],
    progressNotes: { type: [encryptedString], default: [] },
    moodTrend: { ...encryptedString, default: '' },
    followUpTopics: { type: [encryptedString], default: [] }
  },
  lastUpdated: { type: Date, default: Date.now }
}, {
  toJSON: { getters: true },
  toObject: { getters: true }
});

export const MemoryModel = model<IMemory>('Memory', MemorySchema);
