const express = require('express');

const organizationController = require('../controllers/organization.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');
const requireSameOrganization = require('../middleware/tenantIsolation');

const router = express.Router();

// Public: initial organization + admin user setup (tenant provisioning).
router.post('/', organizationController.createOrganization);

// Protected: only an admin of the same organization may view its details.
router.get(
  '/:id',
  protect,
  authorize('admin'),
  requireSameOrganization('id'),
  organizationController.getOrganizationById
);

module.exports = router;
