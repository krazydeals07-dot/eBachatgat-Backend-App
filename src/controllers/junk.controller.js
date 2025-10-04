const Junk = require('../models/junk.model');
const logger = require('../../logger');

// CREATE - Add new junk record
async function createJunk(req, res) {
    try {
        logger.info(`Creating junk record payload: ${JSON.stringify(req.body)}`);
        const { playstore_link, subscription_expired_content } = req.body;

        // Validation for required fields
        if (!playstore_link) {
            return res.status(400).json({
                message: 'playstore_link is required'
            });
        }

        if (!subscription_expired_content) {
            return res.status(400).json({
                message: 'subscription_expired_content is required'
            });
        }

        const junkPayload = {
            playstore_link,
            subscription_expired_content
        };

        logger.info(`Junk payload: ${JSON.stringify(junkPayload)}`);

        const junk = new Junk(junkPayload);
        await junk.save();

        res.status(201).json({
            message: 'Junk record created successfully',
            data: junk
        });

    } catch (error) {
        logger.error(`Error creating junk record: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get all junk records
async function listJunk(req, res) {
    try {
        logger.info('Getting all junk records');

        const junkRecords = await Junk.find({});

        res.status(200).json({
            message: 'Junk records retrieved successfully',
            count: junkRecords.length,
            data: junkRecords
        });

    } catch (error) {
        logger.error(`Error getting junk records: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update junk record
async function updateJunk(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating junk record ID: ${id}, payload: ${JSON.stringify(req.body)}`);

        if (!id) {
            return res.status(400).json({ message: 'Junk record ID is required' });
        }

        // Check if junk record exists
        const existingJunk = await Junk.findById(id);
        if (!existingJunk) {
            return res.status(404).json({ message: 'Junk record not found' });
        }

        const { playstore_link, subscription_expired_content } = req.body;

        // Prepare update payload
        const updatePayload = {};
        if (playstore_link) updatePayload.playstore_link = playstore_link;
        if (subscription_expired_content) updatePayload.subscription_expired_content = subscription_expired_content;
        
        const updatedJunk = await Junk.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            message: 'Junk record updated successfully',
            data: updatedJunk
        });

    } catch (error) {
        logger.error(`Error updating junk record: ${JSON.stringify(error)}`);
        res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    createJunk,
    listJunk,
    updateJunk
};
