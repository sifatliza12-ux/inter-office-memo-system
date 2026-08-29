const Organization = require('../models/Organization');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { isValidEmail } = require('../utils/validators');
const { assertPasswordPolicy } = require('../utils/passwordPolicy');
const { hashPassword } = require('./auth.service');
const { logAuditEvent } = require('./audit.service');

const createOrganizationWithAdmin = async ({
  name,
  identifier,
  logo,
  contactInfo,
  subscriptionTier,
  adminName,
  adminEmail,
  adminPassword,
  adminDesignation,
}) => {
  if (!name || !identifier || !adminName || !adminEmail || !adminPassword) {
    throw new ApiError(
      400,
      'name, identifier, adminName, adminEmail, and adminPassword are required'
    );
  }

  if (!isValidEmail(adminEmail)) {
    throw new ApiError(400, 'Please provide a valid admin email address');
  }

  assertPasswordPolicy(adminPassword);

  const normalizedIdentifier = identifier.toLowerCase().trim();

  const existingOrganization = await Organization.findOne({ identifier: normalizedIdentifier });
  if (existingOrganization) {
    throw new ApiError(409, 'An organization with this identifier already exists');
  }

  const organization = await Organization.create({
    name,
    identifier: normalizedIdentifier,
    logo,
    contactInfo,
    subscriptionTier,
  });

  const hashedPassword = await hashPassword(adminPassword);

  const adminUser = await User.create({
    organizationId: organization._id,
    name: adminName,
    email: adminEmail.toLowerCase(),
    password: hashedPassword,
    role: 'admin',
    designation: adminDesignation,
  });

  await logAuditEvent({
    organizationId: organization._id,
    userId: adminUser._id,
    eventType: 'USER_CREATED',
    description: `${adminUser.name} (${adminUser.email}) was created as the initial admin for ${organization.name}.`,
  });

  return { organization, user: adminUser };
};

const getOrganizationById = async (id) => {
  const organization = await Organization.findById(id);

  if (!organization) {
    throw new ApiError(404, 'Organization not found');
  }

  return organization;
};

module.exports = { createOrganizationWithAdmin, getOrganizationById };
