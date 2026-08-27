const express = require('express');

const departmentController = require('../controllers/department.controller');
const protect = require('../middleware/auth');
const authorize = require('../middleware/role');

const router = express.Router();

router.use(protect, authorize('admin'));

router.post('/', departmentController.createDepartment);
router.get('/', departmentController.listDepartments);
router.get('/:id', departmentController.getDepartment);
router.patch('/:id', departmentController.updateDepartment);
router.patch('/:id/status', departmentController.updateDepartmentStatus);

module.exports = router;
