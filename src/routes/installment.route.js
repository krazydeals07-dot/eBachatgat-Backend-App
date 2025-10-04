const express = require('express');
const router = express.Router();
const { fetchInstallmentByLoanId, fetchInstallmentByStatus } = require('../controllers/installment.controller');
const { verify } = require('../utils/jwt');

router.get('/fetch-installment-by-loan-id', verify, fetchInstallmentByLoanId);
router.get('/fetch-installment-by-status', verify, fetchInstallmentByStatus);

module.exports = router;