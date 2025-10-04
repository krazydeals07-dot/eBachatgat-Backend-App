const express = require('express');
const router = express.Router();
const {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    deleteIssue,
} = require('../controllers/issue.controller');
const { verify } = require('../utils/jwt');

router.post('/create', verify, createIssue);

router.get('/list', verify, getIssues);

router.get('/getById', verify, getIssueById);

router.put('/update', verify, updateIssue);

router.delete('/delete', verify, deleteIssue);

module.exports = router;
