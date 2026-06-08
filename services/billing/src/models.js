import mongoose from 'mongoose';

const { Schema } = mongoose;

const billingSubscriptionSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
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
    status: {
      type: String,
      default: 'inactive',
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
    priceId: {
      type: String,
      default: null,
    },
    currentPeriodStart: {
      type: Date,
      default: null,
    },
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const billingWebhookEventSchema = new Schema(
  {
    stripeEventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['processed', 'failed'],
      default: 'processed',
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export const BillingSubscription = mongoose.model('BillingSubscription', billingSubscriptionSchema);
export const BillingWebhookEvent = mongoose.model('BillingWebhookEvent', billingWebhookEventSchema);
