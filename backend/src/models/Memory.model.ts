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

/**
 * Mongoose does not consistently apply nested getters when serialising a
 * document returned from every query path. Decrypt the profile explicitly at
 * the application boundary so API responses and AI context never expose
 * ciphertext. This also accepts already-decrypted values.
 */
export function decryptMemoryProfile(profile: IMemoryProfile): IMemoryProfile {
  return {
    recurringThemes: profile.recurringThemes.map(decryptIfEncrypted),
    keyPeople: profile.keyPeople.map((person) => ({
      name: decryptIfEncrypted(person.name),
      relationship: decryptIfEncrypted(person.relationship),
      dynamic: decryptIfEncrypted(person.dynamic)
    })),
    triggers: profile.triggers.map(decryptIfEncrypted),
    copingStrategies: profile.copingStrategies.map((strategy) => ({
      strategy: decryptIfEncrypted(strategy.strategy),
      effectiveness: decryptIfEncrypted(strategy.effectiveness)
    })),
    progressNotes: profile.progressNotes.map(decryptIfEncrypted),
    moodTrend: decryptIfEncrypted(profile.moodTrend),
    followUpTopics: profile.followUpTopics.map(decryptIfEncrypted)
  };
}

function decryptIfEncrypted(value: string | undefined): string {
  if (!value) return value || '';

  // AES-256-GCM values produced by encrypt() are iv:authTag:ciphertext in hex.
  // Older profile updates may have encrypted a raw nested value more than once,
  // so unwrap until we reach the original text.
  let decrypted = value;
  while (/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(decrypted)) {
    const nextValue = decrypt(decrypted);
    if (nextValue === decrypted || nextValue === '[Encrypted Content - Decryption Failed]') break;
    decrypted = nextValue;
  }
  return decrypted;
}

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
