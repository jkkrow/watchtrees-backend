import { HydratedDocument, model, Schema, Types } from 'mongoose';

export interface HistoryDocument extends HydratedDocument<History> {}

export interface History {
  user: Types.ObjectId;
  tree: Types.ObjectId;
  activeNodeId: string;
  progress: number;
  totalProgress: number;
  isEnded: boolean;
}

export interface HistoryDTO extends Omit<History, 'user' | 'tree'> {
  tree: string;
}

const HistorySchema = new Schema<History>(
  {
    user: { type: Types.ObjectId, required: true, ref: 'User' },
    tree: { type: Types.ObjectId, required: true, ref: 'VideoTree' },
    activeNodeId: { type: String, required: true },
    progress: { type: Number, required: true },
    totalProgress: { type: Number, required: true },
    isEnded: { type: Boolean, required: true },
  },
  { timestamps: true }
);

export const HistoryModel = model<History>('History', HistorySchema);
