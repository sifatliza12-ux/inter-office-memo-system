const mongoose = require('mongoose');

const { Schema } = mongoose;

const contactInfoSchema = new Schema(
  {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false }
);

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    identifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    logo: {
      type: String,
      trim: true,
    },
    contactInfo: {
      type: contactInfoSchema,
      default: () => ({}),
    },
    subscriptionTier: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', organizationSchema);
