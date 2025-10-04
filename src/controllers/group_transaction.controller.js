const logger = require('../../logger');
const GroupTransaction = require('../models/group_transaction.model');
const User = require('../models/user.model');
const { ObjectId } = require('mongoose').Types;
const { GROUP_TRANSACTION_TYPES, GROUP_FLOW_TYPES } = require('../assets/constants.json');
const moment = require('moment-timezone');

// Create a new group transaction
const createGroupTransaction = async (req, res) => {
    try {
        logger.info('Payload to create transaction ', req.body);
        const {
            shg_group_id,
            member_id,
            amount,
            flow_type,
            transaction_type,
            is_group_activity = false,
            notes,
            created_by_id
        } = req.body;

        // Validate required fields
        if (!shg_group_id || !amount || !flow_type || !transaction_type) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id, amount, flow_type, and transaction_type are required'
            });
        }

        // Validate flow_type
        if (!GROUP_FLOW_TYPES.ARRAY.includes(flow_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid flow_type. Must be one of: ${GROUP_FLOW_TYPES.ARRAY.join(', ')}`
            });
        }

        // Validate transaction_type
        if (!GROUP_TRANSACTION_TYPES.ARRAY.includes(transaction_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid transaction_type. Must be one of: ${GROUP_TRANSACTION_TYPES.ARRAY.join(', ')}`
            });
        }

        // Validate amount
        if (amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be greater than 0'
            });
        }

        let user = null;
        if (!is_group_activity) {
            user = await User.findById(member_id);
            if (!user) {
                return res.status(400).json({
                    success: false,
                    message: 'Member not found'
                });
            }
        }

        // Create transaction payload
        const transactionPayload = {
            shg_group_id,
            member_id: user ? user._id : null,
            amount,
            flow_type,
            transaction_type,
            is_group_activity,
            notes: notes || null,
            created_by_id: created_by_id
        };

        logger.info('Creating group transaction with payload:', transactionPayload);

        const transaction = await GroupTransaction.create(transactionPayload);

        return res.status(201).json({
            success: true,
            message: 'Group transaction created successfully',
            data: transaction
        });

    } catch (error) {
        logger.error('Error in createGroupTransaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get all group transactions with filtering and pagination
const getGroupTransactions = async (req, res) => {
    try {
        let {
            shg_group_id,
            member_id,
            flow_type,
            transaction_type,
            start_date,
            end_date,
            skip = 0,
            limit = 50
        } = req.query;

        // Build filter object
        let filter = {};

        if (shg_group_id) {
            filter.shg_group_id = new ObjectId(shg_group_id);
        }

        if (member_id?.length > 0) {
            member_id = member_id.split(',');
            let tempIds = [];
            for(let i = 0; i < member_id.length; i++){
                tempIds.push(new ObjectId(member_id[i]));
            }
            filter.member_id = { $in: tempIds };
        }

        if (flow_type?.length > 0) {
            flow_type = flow_type.split(',');
            filter.flow_type = { $in: flow_type };
        }

        if (transaction_type?.length > 0) {
            transaction_type = transaction_type.split(',');
            filter.transaction_type = { $in: transaction_type };
        }

        // Date range filter
        if (start_date || end_date) {
            filter.createdAt = {};
            if (start_date) {
                filter.createdAt.$gte = moment(start_date).tz('Asia/Kolkata').toDate();
            }
            if (end_date) {
                filter.createdAt.$lte = moment(end_date).tz('Asia/Kolkata').toDate();
            }
        }

        // Pagination
        const limitNum = parseInt(limit);
        const skipNum = parseInt(skip);

        logger.info('Fetching group transactions with filter:', filter);

        // Get transactions with pagination
        const transactions = await GroupTransaction.aggregate([
            {
                $match: filter
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $skip: skipNum
            },
            {
                $limit: limitNum
            },
            // {
            //     $lookup: {
            //         from: 'users',
            //         localField: 'member_id',
            //         foreignField: '_id',
            //         as: 'member'
            //     }
            // },
            // {
            //     $unwind: {
            //         path: '$member',
            //         preserveNullAndEmptyArrays: true
            //     }
            // },
            // {
            //     $lookup: {
            //         from: 'users',
            //         localField: 'created_by_id',
            //         foreignField: '_id',
            //         as: 'created_by'
            //     }
            // },
            // {
            //     $unwind: {
            //         path: '$created_by',
            //         preserveNullAndEmptyArrays: true
            //     }
            // },
            
        ])

        return res.status(200).json({
            success: true,
            message: 'Group transactions fetched successfully',
            data: transactions
        });

    } catch (error) {
        logger.error('Error in getGroupTransactions:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update a group transaction
const updateGroupTransaction = async (req, res) => {
    try {
        const { id } = req.query;
        const {
            amount,
            flow_type,
            transaction_type,
            is_group_activity,
            notes,
            member_id
        } = req.body;

        logger.info('Payload to update transaction ', req.body);
        logger.info('Payload to update transaction id ', req.query);

        // Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID is required'
            });
        }

        // Check if transaction exists
        const existingTransaction = await GroupTransaction.findById(id);
        if (!existingTransaction) {
            return res.status(404).json({
                success: false,
                message: 'Group transaction not found'
            });
        }

        // Build update object
        const updateData = {};

        if (amount !== undefined) {
            if (amount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Amount must be greater than 0'
                });
            }
            updateData.amount = amount;
        }

        if (flow_type) {
            if (!GROUP_FLOW_TYPES.ARRAY.includes(flow_type)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid flow_type. Must be one of: ${GROUP_FLOW_TYPES.ARRAY.join(', ')}`
                });
            }
            updateData.flow_type = flow_type;
        }

        if (transaction_type) {
            if (!GROUP_TRANSACTION_TYPES.ARRAY.includes(transaction_type)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid transaction_type. Must be one of: ${GROUP_TRANSACTION_TYPES.ARRAY.join(', ')}`
                });
            }
            updateData.transaction_type = transaction_type;
        }

        if (is_group_activity !== undefined) {
            updateData.is_group_activity = is_group_activity;
            if (is_group_activity) updateData.member_id = null;
        }

        if (notes !== undefined) {
            updateData.notes = notes;
        }

        if(!is_group_activity && member_id){
            const user = await User.findById(member_id);
            if(!user){
                return res.status(400).json({
                    success: false,
                    message: 'Member not found'
                })
            }
            updateData.member_id = user._id;
        }

        logger.info('Updating group transaction with ID:', id, 'Data:', updateData);

        const updatedTransaction = await GroupTransaction.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )

        return res.status(200).json({
            success: true,
            message: 'Group transaction updated successfully',
            data: updatedTransaction || null
        });

    } catch (error) {
        logger.error('Error in updateGroupTransaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete a group transaction
const deleteGroupTransaction = async (req, res) => {
    try {
        const { id } = req.query;
        logger.info('Payload to delete transaction ', req.query);

        // Validate ObjectId
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID is required'
            });
        }

        logger.info('Deleting group transaction with ID:', id);

        const deletedTransaction = await GroupTransaction.findByIdAndDelete(id);

        if (!deletedTransaction) {
            return res.status(404).json({
                success: false,
                message: 'Group transaction not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Group transaction deleted successfully',
            data: deletedTransaction
        });

    } catch (error) {
        logger.error('Error in deleteGroupTransaction:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get transaction summary/statistics
const getTransactionSummary = async (req, res) => {
    try {
        const { shg_group_id, start_date, end_date } = req.query;

        // Build match filter
        const matchFilter = {};

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }
        matchFilter.shg_group_id = new ObjectId(shg_group_id);

        // Date range filter
        if (start_date || end_date) {
            matchFilter.createdAt = {};
            if (start_date) {
                matchFilter.createdAt.$gte = moment(start_date).tz('Asia/Kolkata').toDate();
            }
            if (end_date) {
                matchFilter.createdAt.$lte = moment(end_date).tz('Asia/Kolkata').toDate();
            }
        }

        logger.info('Getting transaction summary with filter:', matchFilter);

        const summary = await GroupTransaction.aggregate([
            { $match: matchFilter },
            {
                $group: {
                    _id: '$flow_type',
                    total_amount: { $sum: '$amount' }
                }
            }
        ]);
        logger.info('Transaction summary ', summary);

        // Calculate totals
        let totalInflow = 0;
        let totalOutflow = 0;

        summary.forEach(flow => {
            if (flow._id === 'in') {
                totalInflow = flow.total_amount;
            } else if (flow._id === 'out') {
                totalOutflow = flow.total_amount;
            }
        });

        const result = {
            total_inflow: totalInflow,
            total_outflow: totalOutflow,
            total_balance_remaining: totalInflow - totalOutflow
        };

        return res.status(200).json({
            success: true,
            message: 'Transaction summary fetched successfully',
            data: result
        });

    } catch (error) {
        logger.error('Error in getTransactionSummary:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    createGroupTransaction,
    getGroupTransactions,
    updateGroupTransaction,
    deleteGroupTransaction,
    getTransactionSummary
};
