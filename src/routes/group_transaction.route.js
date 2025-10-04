const express = require('express');
const router = express.Router();
const { createGroupTransaction, getGroupTransactions, updateGroupTransaction, deleteGroupTransaction, getTransactionSummary } = require('../controllers/group_transaction.controller');
const { verify } = require('../utils/jwt');

router.post('/create-group-transaction', verify, createGroupTransaction);
router.get('/get-group-transactions', verify, getGroupTransactions);
router.put('/update-group-transaction', verify, updateGroupTransaction);
router.delete('/delete-group-transaction', verify, deleteGroupTransaction);
router.get('/get-transaction-summary', verify, getTransactionSummary);

module.exports = router;