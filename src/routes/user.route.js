const express = require('express');
const router = express.Router();
const { createUser, getUserById, getUsersByGroup, updateUser, deleteUser } = require('../controllers/user.controller');
const { verify } = require('../utils/jwt');

router.post('/create_user', createUser);
router.get('/get_user_by_id', verify, getUserById);
router.get('/get_users_by_group', getUsersByGroup);
router.put('/update_user', verify, updateUser);
router.delete('/delete_user', verify, deleteUser);

module.exports = router;