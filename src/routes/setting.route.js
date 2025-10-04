const express = require('express');
const router = express.Router();
const { createSettings, getSettings, getAllSettings, updateSettings, deleteSettings } = require('../controllers/settings.controller');
const { verify } = require('../utils/jwt');

router.post('/create', verify, createSettings);
router.get('/get', verify, getSettings);
router.get('/get-all', verify, getAllSettings);
router.put('/update', verify, updateSettings);
router.delete('/delete', verify, deleteSettings);

module.exports = router;