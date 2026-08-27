const MemoCounter = require('../models/MemoCounter');
const Organization = require('../models/Organization');

const MAX_UPSERT_ATTEMPTS = 5;

// findOneAndUpdate with $inc is atomic per-document in MongoDB, so this alone
// already rules out the classic "count + 1" race. The one edge case a plain
// upsert doesn't fully cover is two requests racing to *insert* the very
// first counter document for a brand-new (organization, year) pair — MongoDB
// can reject one side of that race with a duplicate-key error even though
// upsert is otherwise atomic. Retrying picks it up as a normal increment on
// the document the other request just created.
const nextSequence = async (organizationId, year, attempt = 0) => {
  try {
    const counter = await MemoCounter.findOneAndUpdate(
      { organizationId, year },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );
    return counter.sequence;
  } catch (error) {
    if (error.code === 11000 && attempt < MAX_UPSERT_ATTEMPTS - 1) {
      return nextSequence(organizationId, year, attempt + 1);
    }
    throw error;
  }
};

const generateMemoReferenceNumber = async (organizationId) => {
  const year = new Date().getFullYear();
  const sequence = await nextSequence(organizationId, year);
  const organization = await Organization.findById(organizationId).select('identifier');

  const paddedSequence = String(sequence).padStart(4, '0');
  return `${organization.identifier.toUpperCase()}-${year}-${paddedSequence}`;
};

module.exports = { generateMemoReferenceNumber };
