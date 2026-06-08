import mongoose from 'mongoose';
import { getMonthWindow, getMonthKey, getPlanLimit, normalizePlan } from '@coldmailai/shared';

const { Schema } = mongoose;

const usageBucketSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'power'],
      default: 'free',
    },
    limit: {
      type: Number,
      required: true,
    },
    used: {
      type: Number,
      default: 0,
    },
    reserved: {
      type: Number,
      default: 0,
    },
    monthKey: {
      type: String,
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    lastResetAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

usageBucketSchema.index({ userId: 1, monthKey: 1 }, { unique: true });

usageBucketSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    userId: this.userId,
    email: this.email,
    plan: this.plan,
    limit: this.limit,
    used: this.used,
    reserved: this.reserved,
    available: Math.max(this.limit - this.used - this.reserved, 0),
    unlimited: this.plan === 'power',
    monthKey: this.monthKey,
    periodStart: this.periodStart,
    periodEnd: this.periodEnd,
    lastResetAt: this.lastResetAt,
    lastActivityAt: this.lastActivityAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const UsageBucket = mongoose.model('UsageBucket', usageBucketSchema);

export function buildUsageBucket({ userId, email, plan }) {
  const normalizedPlan = normalizePlan(plan);
  const limit = getPlanLimit(normalizedPlan);
  const { start, end } = getMonthWindow();

  return {
    userId,
    email,
    plan: normalizedPlan,
    limit,
    used: 0,
    reserved: 0,
    monthKey: getMonthKey(),
    periodStart: start,
    periodEnd: end,
    lastResetAt: new Date(),
    lastActivityAt: new Date(),
  };
}
