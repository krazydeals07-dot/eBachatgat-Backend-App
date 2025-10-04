const Savings = require('../models/savings.model');
const Settings = require('../models/settings.model');
const User = require('../models/user.model');
const logger = require('../../logger');
const moment = require('moment-timezone');
const { ObjectId } = require('mongoose').Types;
const constants = require('../assets/constants.json');
const uploadFile = require('../utils/vercel_blob');
const { saveGroupTransaction } = require('../utils/commonFunctions');
const { GROUP_FLOW_TYPES, GROUP_TRANSACTION_TYPES, SAVINGS_STATUS } = constants;
const handlebars = require('handlebars');
const transactionTemplates = require('../assets/transaction_templates.json');

// Controller to filter savings based on user_id, month, year, and shg_group_id
const filterSavings = async (req, res) => {
    try {
        const { shg_group_id, start_date, end_date, user_id } = req.body;

        // Validate mandatory fields
        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is mandatory field'
            });
        }

        let match = {
            shg_group_id: new ObjectId(shg_group_id)
        };

        if (start_date && end_date) {
            match.due_date = { $gte: moment(start_date).tz('Asia/Kolkata').toDate(), $lte: moment(end_date).tz('Asia/Kolkata').toDate() };
        }

        if (user_id) {
            match.user_id = new ObjectId(user_id);
        }
        logger.info('Match:', match);

        const savings = await Savings.aggregate([
            {
                $match: match
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            }
        ]);
        logger.info('Savings:', savings);

        return res.status(200).json({
            success: true,
            message: 'Savings filtered successfully',
            data: savings
        });

    } catch (error) {
        console.error('Error in filterSavings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Helper function to calculate due date and period for monthly savings
const calculateMonthlyDueDateAndPeriod = (startDate, dueDay) => {
    const temp = moment(startDate).tz('Asia/Kolkata');
    const dueDate = `${temp.year()}-${temp.month() + 1}-${dueDay}`;
    return { dueDate };
};

// Helper function to calculate due date and period for weekly savings
const calculateWeeklyDueDateAndPeriod = (startDate, dueDay) => {
    const startOfWeek = moment(startDate).tz('Asia/Kolkata').startOf('week');
    const dueDate = startOfWeek.add(dueDay - 1, 'days').format('YYYY-MM-DD');

    return { dueDate };
};

// Helper function to calculate amounts including penalty
const calculateAmounts = (savingsSettings, finalDueDate) => {
    const currentDate = moment().tz('Asia/Kolkata');
    const baseAmount = savingsSettings.amount;
    const penaltyAmount = currentDate.isAfter(finalDueDate) ? savingsSettings.penalty_amount : 0;

    return {
        dueAmount: baseAmount + penaltyAmount,
        paidAmount: 0,
        penaltyAmount
    };
};

// Helper function to create savings object
const createSavingsObject = (groupId, userId, savingsSettings, cycleStartDate, cycleEndDate, isMonthly) => {
    const { due_day, grace_period_days } = savingsSettings;

    // Calculate due date and period based on frequency
    const { dueDate } = isMonthly
        ? calculateMonthlyDueDateAndPeriod(cycleStartDate, due_day)
        : calculateWeeklyDueDateAndPeriod(cycleStartDate, due_day);

    // Calculate final due date with grace period
    const finalDueDate = moment(dueDate).tz('Asia/Kolkata').add(grace_period_days, 'days').format('YYYY-MM-DD');

    // Calculate amounts
    const { dueAmount, paidAmount, penaltyAmount } = calculateAmounts(savingsSettings, finalDueDate);

    return new Savings({
        shg_group_id: new ObjectId(groupId),
        user_id: new ObjectId(userId),
        due_amount: dueAmount,
        paid_amount: paidAmount,
        due_date: moment(dueDate).tz('Asia/Kolkata').format('YYYY-MM-DD'),
        final_due_date: finalDueDate,
        penalty_amount: penaltyAmount,
        status: constants.PAYMENT_STATUS.PENDING,
        member_remarks: null,
        admin_remarks: null,
        proof: null,
        cycle_start_date: cycleStartDate.format('YYYY-MM-DD'),
        cycle_end_date: cycleEndDate.format('YYYY-MM-DD'),
        is_penalty_added: penaltyAmount > 0 ? true : false
    });
};

// Helper function to check if savings already exist for a user
const checkExistingSavings = async (userId, groupId, cycleStartDate, cycleEndDate) => {
    return await Savings.findOne({
        user_id: new ObjectId(userId),
        shg_group_id: new ObjectId(groupId),
        cycle_start_date: cycleStartDate.format('YYYY-MM-DD'),
        cycle_end_date: cycleEndDate.format('YYYY-MM-DD')
    });
};

// Controller to initiate savings payment for all group members
const initiateSavingsPayment = async (req, res) => {
    try {
        logger.info('Initiating savings payment for group:', req.body);
        const { shg_group_id, initiate_date } = req.body;

        // Validate mandatory fields
        if (!shg_group_id || !initiate_date) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id and initiate_date are mandatory fields'
            });
        }

        // Get settings and users
        const [settings, users] = await Promise.all([
            Settings.findOne({ shg_group_id: new ObjectId(shg_group_id) }),
            User.find({ shg_group_id: new ObjectId(shg_group_id) })
        ]);

        logger.info('Settings data:', settings);
        logger.info('Number of users in the group:', users.length);

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found for the group'
            });
        }
        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No users found in the group'
            });
        }

        const { savings_settings: savingsSettings } = settings;
        const isMonthly = savingsSettings.frequency === 'monthly';

        const savingsData = [], returnData = [];

        // Process each user
        for (const user of users) {
            // Calculate end date based on frequency
            const userData = user;
            let cycleStartDate = moment(initiate_date);
            let cycleEndDate = moment(initiate_date);

            if (isMonthly) {
                cycleStartDate = cycleStartDate.startOf('month');
                cycleEndDate = cycleEndDate.endOf('month');
            } else {
                cycleStartDate = cycleStartDate.startOf('week');
                cycleEndDate = cycleEndDate.endOf('week');
            }

            // Check if savings already exist for this user in this period
            const existingSavings = await checkExistingSavings(user._id, shg_group_id, cycleStartDate, cycleEndDate);

            if (!existingSavings) {
                let savings = createSavingsObject(shg_group_id, user._id, savingsSettings, cycleStartDate, cycleEndDate, isMonthly);
                let temp = savings.toObject();
                temp.user = userData;
                savingsData.push(savings);
                returnData.push(temp);
            }
        }

        logger.info('Savings data:', savingsData);
        if (savingsData.length > 0) {
            await Savings.insertMany(savingsData);
            return res.status(200).json({
                success: true,
                message: 'Savings data saved successfully',
                data: returnData
            });
        } else {
            return res.status(200).json({
                success: true,
                message: 'No savings data to save',
                data: []
            });
        }

    } catch (error) {
        logger.error('Error in initiateSavingsPayment:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getSavingsByStatus = async (req, res) => {
    try {
        logger.info('Getting savings by status:', req.query);
        const { shg_group_id, status = '', user_id } = req.query;

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is mandatory field'
            });
        }

        let match = {
            shg_group_id: new ObjectId(shg_group_id),
            status: { $in: status.split(',') }
        };
        if (user_id) {
            match.user_id = new ObjectId(user_id);
        }

        const savings = await Savings.aggregate([
            {
                $match: match
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            {
                $unwind: '$user'
            }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Savings fetched successfully',
            data: savings
        });
    } catch (error) {
        console.error('Error in getSavingsByUserId:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Controller to check if savings payments have been initiated for a group in current phase
const checkSavingsInitiated = async (req, res) => {
    try {
        logger.info('Checking if savings are initiated for group:', req.body);
        const { shg_group_id, initiate_date } = req.body;

        // Validate mandatory fields
        if (!shg_group_id || !initiate_date) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id and initiate_date are mandatory fields'
            });
        }

        // Get settings for the group
        const settings = await Settings.findOne({ shg_group_id: new ObjectId(shg_group_id) });
        const user = await User.find({ shg_group_id: new ObjectId(shg_group_id) });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found for the group'
            });
        }

        const { savings_settings: savingsSettings } = settings;
        const isMonthly = savingsSettings.frequency === 'monthly';

        let startDate, endDate;

        if (isMonthly) {
            // For monthly, get start and end of the month
            startDate = moment(initiate_date).tz('Asia/Kolkata').startOf('month');
            endDate = moment(initiate_date).tz('Asia/Kolkata').endOf('month');
        } else {
            // For weekly, get start and end of the week
            startDate = moment(initiate_date).tz('Asia/Kolkata').startOf('week');
            endDate = moment(initiate_date).tz('Asia/Kolkata').endOf('week');
        }

        // Check if savings already exist for this group in this period
        const existingSavings = await Savings.find({
            shg_group_id: new ObjectId(shg_group_id),
            cycle_start_date: startDate.format('YYYY-MM-DD'),
            cycle_end_date: endDate.format('YYYY-MM-DD')
        });

        const isInitiated = existingSavings.length < user.length ? false : true;

        // Get count of existing savings for additional info
        const existingSavingsCount = await Savings.countDocuments({
            shg_group_id: new ObjectId(shg_group_id),
            cycle_start_date: startDate.format('YYYY-MM-DD'),
            cycle_end_date: endDate.format('YYYY-MM-DD')
        });

        return res.status(200).json({
            success: true,
            message: `Savings ${isInitiated ? 'have been' : 'have not been'} initiated for this phase`,
            data: {
                is_initiated: isInitiated,
                phase_type: isMonthly ? 'monthly' : 'weekly',
                phase_start: startDate.format('YYYY-MM-DD'),
                phase_end: endDate.format('YYYY-MM-DD'),
                existing_savings_count: existingSavingsCount,
                total_user_count: user.length
            }
        });

    } catch (error) {
        logger.error('Error in checkSavingsInitiated:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const updateSavingsDetails = async (req, res) => {
    try {
        logger.info('Updating savings details:', req.body);
        const {
            payment_id,
            due_amount,
            paid_amount,
            status,
            member_remarks,
            admin_remarks,
            penalty_amount
        } = req.body;

        const file = req.files;

        if (!payment_id) {
            return res.status(400).json({
                success: false,
                message: 'payment_id is mandatory field'
            });
        }

        const savings = await Savings.findOne({
            _id: new ObjectId(payment_id)
        });

        if (!savings) {
            return res.status(404).json({
                success: false,
                message: 'Savings not found'
            });
        }

        // Update fields only if they are provided
        if (due_amount !== undefined) savings.due_amount = due_amount;
        if (paid_amount !== undefined) savings.paid_amount = paid_amount;
        if (status !== undefined) savings.status = status;
        if (member_remarks !== undefined) savings.member_remarks = member_remarks;
        if (admin_remarks !== undefined) savings.admin_remarks = admin_remarks;
        if (penalty_amount !== undefined) savings.penalty_amount = penalty_amount;

        if (file && file.length > 0) {
            let temp = file[0];
            const path = `${process.env.APP_ENV}/savings/proof/${temp.originalname}`;
            logger.info('Uploading file to:', path, temp);
            const url = await uploadFile(path, temp);
            if (url) savings.proof = url;
        }

        await savings.save();

        if (status?.toLowerCase() == SAVINGS_STATUS.APPROVED) {
            const user = await User.findById(savings.user_id);
            let template = savings.is_penalty_added ? transactionTemplates.SAVINGS_DEPOSIT_WITH_PENALTY : transactionTemplates.SAVINGS_DEPOSIT_WITHOUT_PENALTY;
            let handlebarsTemplate = handlebars.compile(template);
            let notes = handlebarsTemplate({
                member_name: user.name,
                cycle_start_date: moment(savings.cycle_start_date).tz('Asia/Kolkata').format('DD-MM-YYYY'),
                cycle_end_date: moment(savings.cycle_end_date).tz('Asia/Kolkata').format('DD-MM-YYYY'),
                penalty_amount: savings.penalty_amount
            });

            let gtPayload = {
                shg_group_id: savings.shg_group_id,
                member_id: savings.user_id,
                amount: paid_amount,
                flow_type: GROUP_FLOW_TYPES.IN,
                transaction_type: GROUP_TRANSACTION_TYPES.SAVINGS_DEPOSIT,
                reference_model: 'savings',
                reference_id: savings._id,
                is_group_activity: false,
                notes: notes
            }
            await saveGroupTransaction(gtPayload).catch(err => {
                logger.error('Error in saveGroupTransaction:', err);
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Savings details updated successfully',
            data: savings
        });
    } catch (error) {
        logger.error('Error in updateSavingsDetails:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Controller to update penalty for overdue savings
const updatePenaltyForOverdueSavings = async (req, res) => {
    try {
        logger.info('Updating penalty for overdue savings:', req.body);
        const { shg_group_id } = req.body;

        // Validate mandatory fields
        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is mandatory field'
            });
        }

        // Get settings for the group
        const settings = await Settings.findOne({ shg_group_id: new ObjectId(shg_group_id) });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found for the group'
            });
        }

        const { savings_settings: savingsSettings } = settings;
        const penaltyAmount = savingsSettings.penalty_amount || 0;

        // Get current date
        const currentDate = moment().tz('Asia/Kolkata');

        // Find pending and rejected savings for the group
        const pendingAndRejectedSavings = await Savings.find({
            shg_group_id: new ObjectId(shg_group_id),
            status: { $in: [constants.PAYMENT_STATUS.PENDING, constants.PAYMENT_STATUS.REJECTED] }
        });

        logger.info(`Found ${pendingAndRejectedSavings.length} pending/rejected savings for group`);

        const updatedSavings = [];

        // Process each saving
        for (const saving of pendingAndRejectedSavings) {
            const finalDueDate = moment(saving.final_due_date).tz('Asia/Kolkata');

            // Check if current date exceeds final due date
            if (currentDate.isAfter(finalDueDate)) {
                const newDueAmount = saving.due_amount + penaltyAmount;
                const newPenaltyAmount = saving.penalty_amount + penaltyAmount;

                // Update the saving
                await Savings.findByIdAndUpdate(saving._id, {
                    due_amount: newDueAmount,
                    penalty_amount: newPenaltyAmount
                });

                updatedSavings.push({
                    saving_id: saving._id,
                    user_id: saving.user_id,
                    previous_due_amount: saving.due_amount,
                    new_due_amount: newDueAmount,
                    penalty_applied: newPenaltyAmount,
                    final_due_date: saving.final_due_date,
                    days_overdue: currentDate.diff(finalDueDate, 'days')
                });
            }
        }

        logger.info(`Updated penalty for ${updatedSavings.length} overdue savings`);

        return res.status(200).json({
            success: true,
            message: `Penalty updated for ${updatedSavings.length} overdue savings`,
            data: {
                total_savings_checked: pendingAndRejectedSavings.length,
                overdue_savings_updated: updatedSavings.length,
                penalty_amount_applied: penaltyAmount,
                updated_savings: updatedSavings
            }
        });

    } catch (error) {
        logger.error('Error in updatePenaltyForOverdueSavings:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const updatePenaltyByPaymentId = async (req, res) => {
    try {
        logger.info('Updating penalty by payment id:', req.query);
        const { payment_id } = req.query;

        if (!payment_id) {
            return res.status(400).json({
                success: false,
                message: 'payment_id is mandatory field'
            });
        }

        const saving = await Savings.findOne({
            _id: new ObjectId(payment_id)
        });
        const settings = await Settings.findOne({ shg_group_id: new ObjectId(saving.shg_group_id) });

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: 'Settings not found for the group'
            });
        }
        if (!saving) {
            return res.status(404).json({
                success: false,
                message: 'Savings not found'
            });
        }

        if (saving.status == constants.PAYMENT_STATUS.PENDING || saving.status == constants.PAYMENT_STATUS.REJECTED) {
            const currentDate = moment().tz('Asia/Kolkata');
            const finalDueDate = moment(saving.final_due_date).tz('Asia/Kolkata');
            if (currentDate.isAfter(finalDueDate) && !saving.is_penalty_added) {
                const penalty = settings.savings_settings.penalty_amount;
                const newDueAmount = saving.due_amount + penalty;
                const newPenaltyAmount = saving.penalty_amount + penalty;
                await Savings.findByIdAndUpdate(saving._id, {
                    due_amount: newDueAmount,
                    penalty_amount: newPenaltyAmount,
                    is_penalty_added: true
                });
                return res.status(200).json({
                    success: true,
                    message: 'Penalty updated successfully',
                    data: {
                        ...saving.toObject(),
                        due_amount: newDueAmount,
                        penalty_amount: newPenaltyAmount
                    }
                });
            } else if (saving.is_penalty_added) {
                return res.status(400).json({
                    success: false,
                    message: 'Penalty already added'
                });
            } else if (currentDate.isBefore(finalDueDate)) {
                return res.status(400).json({
                    success: false,
                    message: 'Due date is not reached'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Savings is already paid'
            });
        }

    } catch (error) {
        logger.error('Error in updatePenaltyByPaymentId:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}


module.exports = {
    filterSavings,
    initiateSavingsPayment,
    getSavingsByStatus,
    checkSavingsInitiated,
    updateSavingsDetails,
    updatePenaltyForOverdueSavings,
    updatePenaltyByPaymentId
};
