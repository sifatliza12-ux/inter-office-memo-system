// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((fieldError) => fieldError.message)
      .join(', ');
  } else if (err.code === 11000) {
    statusCode = 409;
    const fields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value for field(s): ${fields}`;
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for field: ${err.path}`;
  }

  if (statusCode === 500) {
    console.error(err.stack);
  }

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    message: statusCode === 500 && isProduction ? 'Internal Server Error' : message,
  });
};

module.exports = errorHandler;
