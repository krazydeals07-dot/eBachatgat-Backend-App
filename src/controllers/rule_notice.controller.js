const logger = require('../../logger');
const RuleNotice = require('../models/rule_notice.model');
const { RULE_NOTICE_TYPES } = require('../assets/constants.json');

// CREATE - Add new rule/notice
async function createRuleNotice(req, res) {
    try {
        logger.info(`Creating rule/notice payload : ${JSON.stringify(req.body)}`);
        const { shg_group_id, type, description } = req.body;

        if (!shg_group_id || !type || !description) {
            return res.status(400).json({
                message: 'shg_group_id, type and description are required'
            });
        }

        if (!RULE_NOTICE_TYPES.ARRAY.includes(type)) {
            return res.status(400).json({ message: `type must be one of: ${RULE_NOTICE_TYPES.ARRAY.join(', ')}` });
        }

        const created = await RuleNotice.create({ shg_group_id, type, description });
        return res.status(201).json({
            message: 'Rule/Notice created successfully',
            data: created
        });
    } catch (error) {
        logger.error(`Error creating rule/notice: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get list by SHG group (optional type filter)
async function getRuleNotices(req, res) {
    try {
        const { shg_group_id, type } = req.query;
        if (!shg_group_id) {
            return res.status(400).json({ message: 'shg_group_id is required' });
        }

        const filter = { shg_group_id };
        if (type) {
            if (!RULE_NOTICE_TYPES.ARRAY.includes(type)) {
                return res.status(400).json({ message: `type must be one of: ${RULE_NOTICE_TYPES.ARRAY.join(', ')}` });
            }
            filter.type = type;
        }

        const list = await RuleNotice.find(filter).sort({ createdAt: -1 });
        return res.status(200).json({
            message: 'Rule/Notice list retrieved successfully',
            count: list.length,
            data: list
        });
    } catch (error) {
        logger.error(`Error fetching rule/notice list: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// READ - Get single by ID
async function getRuleNoticeById(req, res) {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ message: 'id is required' });
        }

        const doc = await RuleNotice.findById(id);
        if (!doc) {
            return res.status(404).json({ message: 'Rule/Notice not found' });
        }

        return res.status(200).json({
            message: 'Rule/Notice retrieved successfully',
            data: doc
        });
    } catch (error) {
        logger.error(`Error fetching rule/notice by id: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// UPDATE - Update by ID
async function updateRuleNotice(req, res) {
    try {
        const { id } = req.query;
        const { type, description } = req.body;
        if (!id) {
            return res.status(400).json({ message: 'id is required' });
        }

        const update = {};
        if (type) {
            if (!RULE_NOTICE_TYPES.ARRAY.includes(type)) {
                return res.status(400).json({ message: `type must be one of: ${RULE_NOTICE_TYPES.ARRAY.join(', ')}` });
            }
            update.type = type;
        }
        if (description) update.description = description;

        const updated = await RuleNotice.findByIdAndUpdate(
            id,
            update,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Rule/Notice not found' });
        }

        return res.status(200).json({
            message: 'Rule/Notice updated successfully',
            data: updated
        });
    } catch (error) {
        logger.error(`Error updating rule/notice: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

// DELETE - Delete by ID
async function deleteRuleNotice(req, res) {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ message: 'id is required' });
        }

        const deleted = await RuleNotice.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ message: 'Rule/Notice not found' });
        }

        return res.status(200).json({ message: 'Rule/Notice deleted successfully' });
    } catch (error) {
        logger.error(`Error deleting rule/notice: ${JSON.stringify(error)}`);
        return res.status(500).json({ message: error.message || 'Internal server error' });
    }
}

module.exports = {
    createRuleNotice,
    getRuleNotices,
    getRuleNoticeById,
    updateRuleNotice,
    deleteRuleNotice
};

 