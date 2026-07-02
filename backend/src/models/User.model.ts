import { Schema, model, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import { randomUUID } from "crypto";



export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  preferredModality: 'CBT' | 'DBT' | 'ACT' | 'Person-centred' | 'Motivational Interviewing';
  timezone: string;
  onboardingAnswers: Record<string, any>;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  id: { type: String, default: uuidv4() },
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
