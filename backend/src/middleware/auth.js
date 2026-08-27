const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Not authorized, no token provided'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    req.user = {
      id: decoded.id,
      organizationId: decoded.organizationId,
      role: decoded.role,
      departmentId: decoded.departmentId || null,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Session expired, please log in again'));
    }
    return next(new ApiError(401, 'Not authorized, invalid token'));
  }
};

module.exports = protect;
