require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Fail loudly and immediately rather than letting a missing var surface
// later as a confusing runtime error — e.g. jwt.sign()/jwt.verify() in
// utils/jwt.js throw on an undefined secret with no custom message, and
// only the first time someone tries to log in, not at startup. Doesn't
// exit the process, matching connectDB()'s existing failure handling below
// (logs and lets the server come up anyway) rather than changing that
// behavior.
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnvVars.join(', ')}. Copy backend/.env.example to backend/.env and fill them in.`
  );
}

const startServer = async () => {
  try {
    await connectDB();
    console.log('MongoDB connected');
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
