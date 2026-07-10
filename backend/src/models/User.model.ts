import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  preferredModality: 'CBT' | 'DBT' | 'ACT' | 'Person-centred' | 'Motivational Interviewing';
  timezone: string;
<<<<<<< HEAD
  onboardingAnswers: Record<string, unknown>;
=======
  onboardingAnswers: Record<string, any>;
  consentAcceptedAt?: Date;
  tokenVersion: number;
  lastActiveAt: Date;
  deletedAt?: Date;
>>>>>>> b406221 (feat: add user export route and memory management services)
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
<<<<<<< HEAD
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true, select: false },
=======
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
>>>>>>> b406221 (feat: add user export route and memory management services)
  preferredModality: { 
    type: String, 
    enum: ['CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'], 
    default: 'CBT' 
  },
  timezone: { type: String, default: 'UTC' },
  onboardingAnswers: { type: Schema.Types.Mixed, default: {} },
  consentAcceptedAt: { type: Date },
  tokenVersion: { type: Number, default: 0 },
  lastActiveAt: { type: Date, default: Date.now },
  deletedAt: { type: Date }
}, { timestamps: true });

export const UserModel = model<IUser>('User', UserSchema);
