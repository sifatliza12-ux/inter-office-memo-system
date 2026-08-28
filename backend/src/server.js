require('dotenv').config();

// mongodb+srv:// URIs (MongoDB Atlas) require a DNS SRV record lookup
// before Mongoose can even attempt a connection. Node's own resolver
// (c-ares) sometimes picks up a broken or loopback-only DNS server from
// the OS (seen in this project's dev environment: dns.getServers()
// reported 127.0.0.1, which nothing listens on, causing every SRV lookup
// to fail with ECONNREFUSED — even though the OS's own resolver worked
// fine for the identical query). Explicitly pointing Node at public
// resolvers sidesteps that, and is safe everywhere: the app only ever
// needs to resolve public internet hostnames (MongoDB Atlas, Supabase),
// never anything internal/private that would depend on a
// network-specific DNS server.
require('dns').setServers(['8.8.8.8', '1.1.1.1']);

const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Fail loudly and immediately rather than letting a missing var surface
// later as a confusing runtime error — e.g. jwt.sign()/jwt.verify() in
// utils/jwt.js throw on an undefined secret with no custom message, and
// only the first time someone tries to log in, not at startup.
//
// In production (Render), a missing var exits the process non-zero so the
// platform's deploy health check fails clearly, rather than the app coming
// up and silently serving requests with broken auth/DB access. In local
// dev, it only logs — matching connectDB()'s existing failure handling
// below (logs and lets the server come up anyway), which is more
// convenient while still setting up a fresh .env.
const REQUIRED_ENV_VARS = ['MONGODB_URI', 'JWT_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(
    `Missing required environment variable(s): ${missingEnvVars.join(', ')}. Copy backend/.env.example to backend/.env and fill them in.`
  );
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
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
