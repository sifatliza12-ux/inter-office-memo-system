const express = require('express');

const directoryController = require('../controllers/directory.controller');
const protect = require('../middleware/auth');

const router = express.Router();

// Any authenticated user may browse their own organization's directory — a
// read-only, minimal-field listing used to pick memo workflow participants.
// Intentionally separate from the admin-only endpoints in user.routes.js,
// which stay exactly as Stage 3 left them.
router.use(protect);

router.get('/', directoryController.listDirectory);

module.exports = router;
