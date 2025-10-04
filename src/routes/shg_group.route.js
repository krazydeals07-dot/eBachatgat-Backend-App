const express = require('express');
const router = express.Router();
const { getShgGroupDetails, listShgGroups, deactivateShgGroup } = require('../controllers/shg_group.controller');
const { verify } = require('../utils/jwt');

router.get('/details', verify, getShgGroupDetails);
router.get('/list', verify, listShgGroups);

router.patch('/deactivate', verify, deactivateShgGroup);

module.exports = router;


