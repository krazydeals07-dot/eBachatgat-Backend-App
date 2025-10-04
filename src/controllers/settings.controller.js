const Settings = require('../models/settings.model');
const SHGGroup = require('../models/shg_group.model');
const logger = require('../../logger');
const moment = require('moment');

// Create new settings for a group
const createSettings = async (req, res) => {
    try {
        logger.info('Creating settings for group:', req.body);
        const { shg_group_id, savings_settings = {}, loan_settings = {}, meeting_settings = {} } = req.body;

        // Validate mandatory fields
        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        // Check if group exists
        const groupExists = await SHGGroup.findById(shg_group_id);
        if (!groupExists) {
            return res.status(404).json({
                success: false,
                message: 'SHG Group not found'
            });
        }

        // Check if settings already exist for this group
        const existingSettings = await Settings.findOne({ shg_group_id });
        if (existingSettings) {
            return res.status(409).json({
                success: false,
                message: 'Settings already exist for this group. Use update instead.'
            });
        }

        // Create new settings
        const newSettings = new Settings({
            shg_group_id,
            savings_settings,
            loan_settings,
            meeting_settings
        });

        await newSettings.save();

        logger.info(`Settings created for group: ${shg_group_id}`);

        return res.status(201).json({
            success: true,
            message: 'Settings created successfully',
            data: newSettings
        });

    } catch (error) {
        logger.error('Error in createSettings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get settings by ID or by group ID
const getSettings = async (req, res) => {
    try {
        const { shg_group_id } = req.query;

        let settings;

        if (shg_group_id) {
            settings = await Settings.findOne({ shg_group_id });
        } else {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Settings retrieved successfully',
            data: settings
        });

    } catch (error) {
        logger.error('Error in getSettings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all settings with optional filtering
const getAllSettings = async (req, res) => {
    try {
        const { skip = 0, limit = 10 } = req.query;

        let query = {};
        
        const settings = await Settings.find(query)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: 'Settings retrieved successfully',
            data: settings
        });

    } catch (error) {
        logger.error('Error in getAllSettings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update settings
const updateSettings = async (req, res) => {
    try {
        const { id } = req.query;
        const updateData = req.body;

        let settings;

        if (id) {
            // Update by settings ID
            settings = await Settings.findById(id);
        } else {
            return res.status(400).json({
                success: false,
                message: 'settings ID is required'
            });
        }

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found'
            });
        }

        let savings_settings = updateData.savings_settings || null;
        let loan_settings = updateData.loan_settings || null;
        let meeting_settings = updateData.meeting_settings || null;
        
        if (savings_settings) {
            settings.savings_settings = savings_settings;
        }
        if (loan_settings) {
            settings.loan_settings = loan_settings;
        }
        if (meeting_settings) {
            settings.meeting_settings = meeting_settings;
        }

        await settings.save();

        logger.info(`Settings updated for group: ${settings.shg_group_id}`);

        return res.status(200).json({   
            success: true,
            message: 'Settings updated successfully',
            data: settings
        });

    } catch (error) {
        logger.error('Error in updateSettings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete settings
const deleteSettings = async (req, res) => {
    try {
        const { id } = req.query;

        let settings;

        if (id) {
            // Delete by settings ID
            settings = await Settings.findById(id);
        } else {
            return res.status(400).json({
                success: false,
                message: 'settings ID is required'
            });
        }

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found'
            });
        }

        await Settings.findByIdAndDelete(settings._id);

        logger.info(`Settings deleted for group: ${settings.shg_group_id}`);

        return res.status(200).json({
            success: true,
            message: 'Settings deleted successfully',
            data: {
                deleted_id: settings._id,
                shg_group_id: settings.shg_group_id
            }
        });

    } catch (error) {
        logger.error('Error in deleteSettings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createSettings,
    getSettings,
    getAllSettings,
    updateSettings,
    deleteSettings
}; 