import { Schema, Types, model } from 'mongoose';

export interface ChatMessageDocument {
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  isRead: boolean;
  readBy: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const chatMessageSchema = new Schema<ChatMessageDocument>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }]
  },
  {
    timestamps: { createdAt: true, updatedAt: true }
  }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessageModel = model<ChatMessageDocument>('ChatMessage', chatMessageSchema);
