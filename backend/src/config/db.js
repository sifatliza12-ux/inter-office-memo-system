const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in the environment variables');
  }

  await mongoose.connect(mongoUri);

  return mongoose.connection;
};

module.exports = connectDB;
