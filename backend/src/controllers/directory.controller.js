const asyncHandler = require('../utils/asyncHandler');
const directoryService = require('../services/directory.service');

const listDirectory = asyncHandler(async (req, res) => {
  const { users, departments } = await directoryService.listOrganizationDirectory(req.user.organizationId);
  res.status(200).json({ users, departments });
});

module.exports = { listDirectory };
