const express = require('express');
const router = express.Router();
const {
    createLoan, getLoansByStatus, fetchLoanById, getLoanByMemberId,
    generateLoanReportPDF, getPreCloseLoanData, loanPreclosing, getLoanSummaryByMemberAndGroup
} = require('../controllers/loan.controller');
const { verify } = require('../utils/jwt');

router.post('/create-loan', verify, createLoan);
router.get('/loans-by-status', verify, getLoansByStatus);
router.get('/loan-by-id', verify, fetchLoanById);
router.get('/loan-by-member-id', verify, getLoanByMemberId);
router.get('/loan-report-pdf', verify, generateLoanReportPDF);
router.get('/preclose-loan-data', verify, getPreCloseLoanData);
router.post('/loan-preclosing', verify, loanPreclosing);
router.get('/loan-summary', verify, getLoanSummaryByMemberAndGroup);

module.exports = router;