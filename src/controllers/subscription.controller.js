const Subscription = require('../models/subscription.model');
const ShgGroup = require('../models/shg_group.model');
const logger = require('../../logger');
const User = require('../models/user.model');
const { ROLES } = require('../assets/constants.json');

// CREATE - Add new subscription
async function createSubscription(req, res) {
    try {
        logger.info(`Creating subscription payload: ${JSON.stringify(req.body)}`);
        const { shg_group_id, starts_on, ends_on, amount, remarks } = req.body;

        // Validation for required fields
        if (!shg_group_id || !starts_on || !ends_on || !amount) {
            return res.status(400).json({
                message: 'shg_group_id, starts_on, ends_on, and amount are required'
            });
        }

        // Validate dates
        const startDate = new Date(starts_on);
        const endDate = new Date(ends_on);
        
        if (startDate >= endDate) {
            return res.status(400).json({
                message: 'ends_on must be after starts_on'
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                message: 'amount must be greater than 0'
            });
        }

        // Check if SHG group exists
        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            return res.status(404).json({ message: 'SHG group not found' });
        }

        const subscriptionPayload = {
            shg_group_id,
            starts_on: startDate,
            ends_on: endDate,
            amount,
            remarks
        };

        logger.info(`Subscription payload: ${JSON.stringify(subscriptionPayload)}`);

        const subscription = new Subscription(subscriptionPayload);
        await subscription.save();

        res.status(201).json({
            message: 'Subscription created successfully',
            data: subscription
        });

    } catch (error) {
        logger.error(`Error creating subscription: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get subscription by ID
async function getSubscriptionById(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Getting subscription by ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Subscription ID is required' });
        }

        const subscription = await Subscription.findById(id).populate('shg_group_id', 'name code');
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        res.status(200).json({
            message: 'Subscription retrieved successfully',
            data: subscription
        });

    } catch (error) {
        logger.error(`Error getting subscription by ID: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get all subscriptions by SHG group
async function getSubscriptionsByGroup(req, res) {
    try {
        const { shg_group_id } = req.query;
        logger.info(`Getting subscriptions by group ID: ${shg_group_id}`);

        if (!shg_group_id) {
            return res.status(400).json({ message: 'SHG group ID is required' });
        }

        // Check if SHG group exists
        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            return res.status(404).json({ message: 'SHG group not found' });
        }

        let subscriptions = await Subscription.find({
            shg_group_id
        }).populate('shg_group_id', 'name code').sort({ createdAt: -1 });

        const president = await User.findOne({ shg_group_id, role: ROLES.PRESIDENT }).select('-password');

        res.status(200).json({
            message: 'Subscriptions retrieved successfully',
            count: subscriptions.length,
            data: subscriptions,
            president
        });

    } catch (error) {
        logger.error(`Error getting subscriptions by group: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get all subscriptions
async function listSubscriptions(req, res) {
    try {
        const { limit = 100, offset = 0 } = req.query;
        logger.info('Getting all subscriptions');

        let skipNum = offset ? parseInt(offset) : 0;
        let limitNum = limit ? parseInt(limit) : 100;

        const subscriptions = await Subscription.find({})
            .populate('shg_group_id', 'name code')
            .sort({ createdAt: -1 })
            .skip(skipNum)
            .limit(limitNum);

        const totalCount = await Subscription.countDocuments({});

        res.status(200).json({
            message: 'Subscriptions retrieved successfully',
            count: subscriptions.length,
            total: totalCount,
            data: subscriptions
        });

    } catch (error) {
        logger.error(`Error getting subscriptions: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update subscription
async function updateSubscription(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating subscription ID: ${id}, payload: ${JSON.stringify(req.body)}`);

        if (!id) {
            return res.status(400).json({ message: 'Subscription ID is required' });
        }

        // Check if subscription exists
        const existingSubscription = await Subscription.findById(id);
        if (!existingSubscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        const { shg_group_id, starts_on, ends_on, amount, remarks } = req.body;

        // Validate dates if provided
        if (starts_on && ends_on) {
            const startDate = new Date(starts_on);
            const endDate = new Date(ends_on);
            
            if (startDate >= endDate) {
                return res.status(400).json({
                    message: 'ends_on must be after starts_on'
                });
            }
        }

        // Validate amount if provided
        if (amount !== undefined && amount <= 0) {
            return res.status(400).json({
                message: 'amount must be greater than 0'
            });
        }

        // Check if SHG group exists if provided
        if (shg_group_id) {
            const group = await ShgGroup.findById(shg_group_id);
            if (!group) {
                return res.status(404).json({ message: 'SHG group not found' });
            }
        }

        // Prepare update payload
        const updatePayload = {};
        if (shg_group_id) updatePayload.shg_group_id = shg_group_id;
        if (starts_on) updatePayload.starts_on = new Date(starts_on);
        if (ends_on) updatePayload.ends_on = new Date(ends_on);
        if (amount !== undefined) updatePayload.amount = amount;
        if (remarks !== undefined) updatePayload.remarks = remarks;

        const updatedSubscription = await Subscription.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        ).populate('shg_group_id', 'name code');

        res.status(200).json({
            message: 'Subscription updated successfully',
            data: updatedSubscription
        });

    } catch (error) {
        logger.error(`Error updating subscription: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// DELETE - Delete subscription
async function deleteSubscription(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Deleting subscription ID: ${id}`);

        if (!id) {
            return res.status(400).json({ message: 'Subscription ID is required' });
        }

        // Check if subscription exists
        const subscription = await Subscription.findById(id);
        if (!subscription) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        await Subscription.deleteOne({ _id: id });

        res.status(200).json({
            message: 'Subscription deleted successfully'
        });

    } catch (error) {
        logger.error(`Error deleting subscription: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    createSubscription,
    getSubscriptionById,
    getSubscriptionsByGroup,
    listSubscriptions,
    updateSubscription,
    deleteSubscription
};
