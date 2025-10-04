const express = require('express');
const router = express.Router();
const { verify } = require('../utils/jwt');
const {
    createRuleNotice,
    getRuleNotices,
    getRuleNoticeById,
    updateRuleNotice,
    deleteRuleNotice
} = require('../controllers/rule_notice.controller');

router.post('/create', verify, createRuleNotice);
router.get('/list', verify, getRuleNotices);
router.get('/by-id', verify, getRuleNoticeById);
router.put('/update', verify, updateRuleNotice);
router.delete('/delete', verify, deleteRuleNotice);

module.exports = router;


