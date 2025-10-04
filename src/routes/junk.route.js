const express = require('express');
const router = express.Router();
const { createJunk, listJunk, updateJunk } = require('../controllers/junk.controller');

router.post('/create-junk', createJunk);
router.get('/list-junk', listJunk);
router.put('/update-junk', updateJunk);

module.exports = router;