import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  preferredModality: 'CBT' | 'DBT' | 'ACT' | 'Person-centred' | 'Motivational Interviewing';
  timezone: string;
  onboardingAnswers: Record<string, any>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  preferredModality: { 
    type: String, 
    enum: ['CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'], 
    default: 'CBT' 
  },
  timezone: { type: String, default: 'UTC' },
  onboardingAnswers: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now }
});

export const UserModel = model<IUser>('User', UserSchema);
