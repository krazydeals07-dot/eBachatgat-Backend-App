const Issue = require('../models/issue.model');
const User = require('../models/user.model');
const ShgGroup = require('../models/shg_group.model');
const logger = require('../../logger');
const mongoose = require('mongoose');
const uploadFile = require('../utils/vercel_blob');

// CREATE - Add new issue
async function createIssue(req, res) {
    try {
        logger.info(`Creating issue payload: `, req.body);

        const { shg_group_id, member_id, desc, severity } = req.body;

        // Validation for required fields
        if (!shg_group_id || !member_id || !desc || !severity) {
            logger.warn('Missing required fields for issue creation');
            return res.status(400).json({
                success: false,
                message: 'shg_group_id, member_id, desc, and severity are required'
            });
        }

        // Check if SHG group exists
        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            logger.warn(`SHG group not found: ${shg_group_id}`);
            return res.status(404).json({
                success: false,
                message: 'SHG group not found'
            });
        }

        // Check if member exists and belongs to the group
        const member = await User.findOne({ _id: member_id, shg_group_id: shg_group_id });
        if (!member) {
            logger.warn(`Member not found or doesn't belong to group: ${member_id}`);
            return res.status(404).json({
                success: false,
                message: 'Member not found or does not belong to this group'
            });
        }

        const issuePayload = {
            shg_group_id,
            member_id,
            desc: desc.trim(),
            severity: severity?.toLowerCase() || ""
        };

        let files = req?.files && req.files?.length > 0 ? req.files[0] : null;

        if (files) {
            const path = `${process.env.APP_ENV}/issue/image/${files.originalname}`;
            logger.info('Uploading file to:', path, files);
            const url = await uploadFile(path, files);
            if (url) issuePayload.image = path;
        }

        logger.info(`Issue payload: `, issuePayload);

        const issue = new Issue(issuePayload);
        await issue.save();

        logger.info(`Issue created successfully with ID: `, issue);

        res.status(201).json({
            success: true,
            message: 'Issue created successfully',
            data: issue
        });
    } catch (error) {
        logger.error(`Error creating issue: `, error);

        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}

// READ - Get all issues with filtering and pagination
async function getIssues(req, res) {
    try {
        logger.info(`Getting issues with query: `, req.query);

        const {
            shg_group_id,
            member_id,
            severity,
            status,
            offset = 0,
            limit = 100
        } = req.query;

        // Build filter object
        const filter = {};

        if (shg_group_id) {
            filter.shg_group_id = shg_group_id;
        }

        if (member_id) {
            filter.member_id = member_id;
        }

        if (severity) {
            filter.severity = severity.toLowerCase();
        }

        if (status) {
            filter.status = status.toLowerCase();
        }

        // Pagination
        const skip = parseInt(offset);
        const limitNum = parseInt(limit);

        logger.info(`Filter: `, filter);

        const [issues, totalCount] = await Promise.all([
            Issue.find(filter)
                .populate('member_id', 'name mobile_no role')
                .populate('shg_group_id', 'name code')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Issue.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalCount / limitNum);

        logger.info(`Found ${issues.length} issues out of ${totalCount} total`);

        res.status(200).json({
            success: true,
            message: 'Issues retrieved successfully',
            data: issues,
            pagination: {
                current_page: offset + 1,
                total_pages: totalPages,
                total_count: totalCount,
                per_page: limitNum,
                has_next: offset < totalPages,
                has_prev: offset > 1
            }
        });
    } catch (error) {
        logger.error(`Error getting issues: `, error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}

// READ - Get single issue by ID
async function getIssueById(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Getting issue by ID: `, id);

        const issue = await Issue.findById(id)
            .populate('member_id', 'name mobile_no role email')
            .populate('shg_group_id', 'name code state');

        if (!issue) {
            logger.warn(`Issue not found: `, id);
            return res.status(404).json({
                success: false,
                message: 'Issue not found'
            });
        }

        logger.info(`Issue found: `, id);

        res.status(200).json({
            success: true,
            message: 'Issue retrieved successfully',
            data: issue
        });
    } catch (error) {
        logger.error(`Error getting issue by ID: `, error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}

// UPDATE - Update issue
async function updateIssue(req, res) {
    try {
        const { id } = req.query;
        logger.info(`Updating issue ${id} with payload: `, req.body);

        const { desc, severity, status, resolution_notes } = req.body;

        // Check if issue exists
        const existingIssue = await Issue.findById(id);
        if (!existingIssue) {
            logger.warn(`Issue not found for update: `, id);
            return res.status(404).json({
                success: false,
                message: 'Issue not found'
            });
        }

        // Build update object
        const updateData = {};

        if (desc !== undefined) {
            if (!desc || desc.trim().length < 10) {
                return res.status(400).json({
                    success: false,
                    message: 'Description must be at least 10 characters long'
                });
            }
            updateData.desc = desc.trim();
        }

        if (severity !== undefined) {
            const validSeverities = ['major', 'minor', 'moderate'];
            if (!validSeverities.includes(severity.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Severity must be one of: major, minor, moderate'
                });
            }
            updateData.severity = severity.toLowerCase();
        }

        if (status !== undefined) {
            const validStatuses = ['active', 'closed'];
            if (!validStatuses.includes(status.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Status must be one of: active, closed'
                });
            }
            updateData.status = status.toLowerCase();

            // If closing the issue, set resolved_date
            if (status.toLowerCase() === 'closed') {
                updateData.resolved_date = new Date();

                if (resolution_notes) {
                    updateData.resolution_notes = resolution_notes.trim();
                }
            }
        }

        // Handle image field
        let files = req?.files && req.files?.length > 0 ? req.files[0] : null;

        if (files) {
            const path = `${process.env.APP_ENV}/issue/image/${files.originalname}`;
            logger.info('Uploading file to:', path, files);
            const url = await uploadFile(path, files);
            if (url) updateData.image = path;
        }

        logger.info(`Update data: `, updateData);

        const updatedIssue = await Issue.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('member_id', 'name mobile_no role')
            .populate('shg_group_id', 'name code');

        logger.info(`Issue updated successfully: `, id);

        res.status(200).json({
            success: true,
            message: 'Issue updated successfully',
            data: updatedIssue
        });
    } catch (error) {
        logger.error(`Error updating issue: `, error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}

// DELETE - Delete issue (soft delete by marking as closed)
async function deleteIssue(req, res) {
    try {
        const { id } = req.query;

        logger.info(`Deleting issue `, id);

        const issue = await Issue.findById(id);
        if (!issue) {
            logger.warn(`Issue not found for deletion: `, id);
            return res.status(404).json({
                success: false,
                message: 'Issue not found'
            });
        }

        await Issue.findByIdAndDelete(id);
        logger.info(`Issue hard deleted: `, id);

        return res.status(200).json({
            success: true,
            message: 'Issue permanently deleted'
        });

    } catch (error) {
        logger.error(`Error deleting issue: `, error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
}


module.exports = {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    deleteIssue
};
