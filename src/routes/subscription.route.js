const express = require('express');
const router = express.Router();
const { 
    createSubscription, 
    getSubscriptionById, 
    getSubscriptionsByGroup, 
    listSubscriptions, 
    updateSubscription, 
    deleteSubscription 
} = require('../controllers/subscription.controller');
const { verify } = require('../utils/jwt');

// Create subscription
router.post('/create', verify, createSubscription);

// Get subscription by ID
router.get('/get-by-id', verify, getSubscriptionById);

// Get subscriptions by SHG group
router.get('/get-by-group', verify, getSubscriptionsByGroup);

// List all subscriptions
router.get('/list', verify, listSubscriptions);

// Update subscription
router.put('/update', verify, updateSubscription);

// Delete subscription
router.delete('/delete', verify, deleteSubscription);

module.exports = router;
