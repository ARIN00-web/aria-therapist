import { Schema, model, Document } from 'mongoose';

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
  userId: Schema.Types.ObjectId;
  profile: IMemoryProfile;
  lastUpdated: Date;
}

const MemorySchema = new Schema<IMemory>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  profile: {
    recurringThemes: { type: [String], default: [] },
    keyPeople: [{
      name: { type: String, required: true },
      relationship: { type: String, required: true },
      dynamic: { type: String, default: '' }
    }],
    triggers: { type: [String], default: [] },
    copingStrategies: [{
      strategy: { type: String, required: true },
      effectiveness: { type: String, default: 'medium' }
    }],
    progressNotes: { type: [String], default: [] },
    moodTrend: { type: String, default: '' },
    followUpTopics: { type: [String], default: [] }
  },
  lastUpdated: { type: Date, default: Date.now }
});

export const MemoryModel = model<IMemory>('Memory', MemorySchema);
