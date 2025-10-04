const express = require('express');
const router = express.Router();
const { registerGroup, loginController, listGroupsByCode, verifyToken, verifyUserAuthenticity, changePassword } = require('../controllers/auth.controller');

router.post('/register-group', registerGroup);
router.post('/login', loginController);
router.get('/list-groups-by-code', listGroupsByCode);
router.get('/verify-token', verifyToken);
router.post('/verify-user-authenticity', verifyUserAuthenticity);
router.post('/change-password', changePassword);

module.exports = router;