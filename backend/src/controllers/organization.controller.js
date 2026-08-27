const asyncHandler = require('../utils/asyncHandler');
const organizationService = require('../services/organization.service');

const createOrganization = asyncHandler(async (req, res) => {
  const {
    name,
    identifier,
    logo,
    contactInfo,
    subscriptionTier,
    adminName,
    adminEmail,
    adminPassword,
    adminDesignation,
  } = req.body;

  const { organization, user } = await organizationService.createOrganizationWithAdmin({
    name,
    identifier,
    logo,
    contactInfo,
    subscriptionTier,
    adminName,
    adminEmail,
    adminPassword,
    adminDesignation,
  });

  res.status(201).json({ organization, user });
});

const getOrganizationById = asyncHandler(async (req, res) => {
  const organization = await organizationService.getOrganizationById(req.params.id);
  res.status(200).json({ organization });
});

module.exports = { createOrganization, getOrganizationById };
