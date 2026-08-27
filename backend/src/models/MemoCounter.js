const mongoose = require('mongoose');

const { Schema } = mongoose;

// Exists solely to generate memo reference numbers atomically. One document
// per (organization, year); `sequence` is only ever advanced via a single
// atomic $inc, never read-then-written, so concurrent memo creation cannot
// produce two memos with the same reference number.
const memoCounterSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  sequence: {
    type: Number,
    default: 0,
  },
});

memoCounterSchema.index({ organizationId: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('MemoCounter', memoCounterSchema);
