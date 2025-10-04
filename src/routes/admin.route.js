const express = require('express');
const router = express.Router();
const { 
    registerAdmin,
    loginAdmin,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    changeAdminPassword
} = require('../controllers/admin.controller');
const { verify } = require('../utils/jwt');

// Public routes (no authentication required)
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);

// Protected routes (authentication required)
router.get('/get_admin_by_id', verify, getAdminById);
router.put('/update_admin', verify, updateAdmin);
router.delete('/delete_admin', verify, deleteAdmin);
router.put('/change_password', verify, changeAdminPassword);

module.exports = router;
