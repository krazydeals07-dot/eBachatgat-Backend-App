const express = require('express');
const router = express.Router();
const { getHomeScreenSummaryDetails, getBalanceSheetData, downloadBalanceSheet } = require('../controllers/summary.controller');
const { verify } = require('../utils/jwt');

router.get('/home-screen-summary-details', verify, getHomeScreenSummaryDetails);
router.get('/balance-sheet-data', verify, getBalanceSheetData);
router.get('/download-balance-sheet', verify, downloadBalanceSheet);

module.exports = router;