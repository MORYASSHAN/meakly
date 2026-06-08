import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    input: {
      companyName: { type: String, required: true },
      myOffer: { type: String, required: true },
      targetRole: { type: String, required: true },
      painPoint: { type: String, required: true },
    },
    output: {
      subject: { type: String, required: true },
      emailBody: { type: String, required: true },
      followUp1: { type: String, required: true },
      followUp2: { type: String, required: true },
    },
    isFavorited: {
      type: Boolean,
      default: false,
    },
    aiModel: {
      type: String,
      default: 'llama-3.3-70b-versatile',
    },
    aiLatencyMs: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

emailSchema.methods.toPublicObject = function toPublicObject() {
  return {
    id: this._id.toString(),
    userId: this.userId,
    input: this.input,
    output: this.output,
    isFavorited: this.isFavorited,
    aiModel: this.aiModel,
    aiLatencyMs: this.aiLatencyMs,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Email = mongoose.model('Email', emailSchema);
