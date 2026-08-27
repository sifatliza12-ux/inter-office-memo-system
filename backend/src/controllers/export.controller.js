const asyncHandler = require('../utils/asyncHandler');
const exportService = require('../services/export.service');

const exportMemoPdf = asyncHandler(async (req, res) => {
  const { buffer, filename } = await exportService.exportMemoPdf(
    req.user.organizationId,
    req.params.id,
    req.user.id
  );

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.send(buffer);
});

module.exports = { exportMemoPdf };
