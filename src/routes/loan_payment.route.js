const express = require('express');
const router = express.Router();
const { createLoanPayment, approveOrRejectPayment } = require('../controllers/loan_payment.controller');
const { verify } = require('../utils/jwt');

router.post('/create-payment', verify, createLoanPayment);
router.put('/approve-or-reject-payment', verify, approveOrRejectPayment);

module.exports = router;