import mongoose from 'mongoose';
import { getPlanLimit, normalizePlan } from '@coldmailai/shared';

const { Schema } = mongoose;

const profileSchema = new Schema(
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
      index: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      default: '',
      trim: true,
    },
    jobTitle: {
      type: String,
      default: '',
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    avatarUrl: {
      type: String,
      default: '',
      trim: true,
    },
    preferences: {
      tone: {
        type: String,
        default: 'direct',
      },
      language: {
        type: String,
        default: 'en',
      },
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'power'],
      default: 'free',
    },
    monthlyLimit: {
      type: Number,
      default: 5,
    },
    stripeCustomerId: {
      type: String,
      default: null,
    },
    stripeSubscriptionId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const bugReportSchema = new Schema(
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
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    stepsToReproduce: {
      type: String,
      default: '',
      trim: true,
    },
    expectedResult: {
      type: String,
      default: '',
      trim: true,
    },
    actualResult: {
      type: String,
      default: '',
      trim: true,
    },
    pageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'triaged', 'resolved', 'closed'],
      default: 'open',
    },
    appVersion: {
      type: String,
      default: '',
      trim: true,
    },
    browser: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

bugReportSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    userId: this.userId,
    email: this.email,
    name: this.name,
    subject: this.subject,
    description: this.description,
    stepsToReproduce: this.stepsToReproduce,
    expectedResult: this.expectedResult,
    actualResult: this.actualResult,
    pageUrl: this.pageUrl,
    severity: this.severity,
    status: this.status,
    appVersion: this.appVersion,
    browser: this.browser,
    metadata: this.metadata,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

profileSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    userId: this.userId,
    email: this.email,
    name: this.name,
    companyName: this.companyName,
    jobTitle: this.jobTitle,
    website: this.website,
    timezone: this.timezone,
    avatarUrl: this.avatarUrl,
    preferences: this.preferences,
    plan: this.plan,
    monthlyLimit: this.monthlyLimit,
    stripeCustomerId: this.stripeCustomerId,
    stripeSubscriptionId: this.stripeSubscriptionId,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Profile = mongoose.model('UserProfile', profileSchema);
export const BugReport = mongoose.model('BugReport', bugReportSchema);

export function createProfilePlanFields(plan) {
  const normalizedPlan = normalizePlan(plan);
  return {
    plan: normalizedPlan,
    monthlyLimit: getPlanLimit(normalizedPlan),
  };
}
