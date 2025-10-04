const express = require('express');
const router = express.Router();
const { updateLoanApplicationAction } = require('../controllers/loan_application_action.controller');
const { verify } = require('../utils/jwt');

router.put('/update-action', verify, updateLoanApplicationAction);

module.exports = router; 