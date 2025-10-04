const express = require('express');
const router = express.Router();
const { createLoanRequest, getLoanApplicationsByStatus, getLoanApplicationByWitnessId, getPendingLoanApplicationsWithCompletedWitnessActions, updateLoanApplicationStatus } = require('../controllers/loan_application.controller');
const { verify } = require('../utils/jwt');

router.post('/apply-loan', createLoanRequest);
router.get('/applications-by-status', verify, getLoanApplicationsByStatus);
router.post('/applications-by-witness-id', verify, getLoanApplicationByWitnessId);
router.get('/pending-with-completed-witnesses', verify, getPendingLoanApplicationsWithCompletedWitnessActions);
router.put('/update-status', verify, updateLoanApplicationStatus);

module.exports = router;