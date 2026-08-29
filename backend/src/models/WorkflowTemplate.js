const mongoose = require('mongoose');

const { Schema } = mongoose;

const positionSchema = new Schema(
  {
    // Server-assigned from array position at create/update time (10, 20,
    // 30…) — matching the WorkflowStep.stepOrder convention (memo.service.js
    // / workflow.service.js's STEP_ORDER_INCREMENT). Never accepted from the
    // client directly; see workflowTemplate.service.js's normalizePositions.
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    roleLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
  },
  { _id: false }
);

const workflowTemplateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    positions: {
      type: [positionSchema],
      validate: {
        validator: (positions) => Array.isArray(positions) && positions.length > 0,
        message: 'A workflow template must have at least one position',
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

workflowTemplateSchema.index({ organizationId: 1 });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
