import { Schema, model, Document, Types } from 'mongoose';

export type WellnessActivityType = 'mood' | 'journal' | 'goal' | 'tool' | 'message' | 'setting';

export interface IWellnessActivity extends Document {
  userId: Types.ObjectId;
  type: WellnessActivityType;
  title?: string;
  content?: string;
  mood?: number;
  moodLabel?: string;
  tool?: string;
  completed?: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const WellnessActivitySchema = new Schema<IWellnessActivity>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, required: true, enum: ['mood', 'journal', 'goal', 'tool', 'message', 'setting'], index: true },
  title: { type: String, trim: true, maxlength: 160 },
  content: { type: String, trim: true, maxlength: 4_000 },
  mood: { type: Number, min: 1, max: 10 },
  moodLabel: { type: String, trim: true, maxlength: 80 },
  tool: { type: String, trim: true, maxlength: 120 },
  completed: { type: Boolean, default: false },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export const WellnessActivityModel = model<IWellnessActivity>('WellnessActivity', WellnessActivitySchema);
