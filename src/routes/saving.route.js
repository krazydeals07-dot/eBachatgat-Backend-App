const express = require('express');
const router = express.Router();
const { filterSavings, initiateSavingsPayment, getSavingsByStatus, checkSavingsInitiated, updateSavingsDetails, updatePenaltyForOverdueSavings, updatePenaltyByPaymentId } = require('../controllers/saving.controller');
const { verify } = require('../utils/jwt');

router.post('/history', verify, filterSavings);
router.post('/initiate-payment-request', verify, initiateSavingsPayment);
router.get('/get-savings-by-status', verify, getSavingsByStatus);
router.post('/check-savings-initiated', verify, checkSavingsInitiated);
router.put('/update-savings-details', verify, updateSavingsDetails);
router.put('/update-penalty-overdue', verify, updatePenaltyForOverdueSavings);
router.put('/update-penalty-by-payment-id', verify, updatePenaltyByPaymentId);

module.exports = router;