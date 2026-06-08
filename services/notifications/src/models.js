import mongoose from 'mongoose';

const { Schema } = mongoose;

const notificationLogSchema = new Schema(
  {
    to: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    template: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      required: true,
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['success', 'error'],
      default: 'success',
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
