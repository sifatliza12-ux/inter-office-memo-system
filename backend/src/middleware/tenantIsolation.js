const ApiError = require('../utils/ApiError');

// Reusable guard for routes where the resource's organization id is directly
// available as a request param (e.g. GET /api/organizations/:id).
// It never trusts the param on its own — it only allows the request through
// when the param matches the organizationId that came from the verified JWT.
const requireSameOrganization = (paramName = 'id') => (req, res, next) => {
  const requestedOrganizationId = req.params[paramName];

  if (requestedOrganizationId !== String(req.user.organizationId)) {
    return next(new ApiError(403, "You do not have access to this organization's resources"));
  }

  next();
};

module.exports = requireSameOrganization;
