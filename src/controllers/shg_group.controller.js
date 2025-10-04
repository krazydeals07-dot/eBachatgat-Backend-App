const logger = require('../../logger');
const { ObjectId } = require('mongoose').Types;

const ShgGroup = require('../models/shg_group.model');
const User = require('../models/user.model');
const GroupTransaction = require('../models/group_transaction.model');
const Savings = require('../models/savings.model');
const Loan = require('../models/loan.model');
const LoanApplication = require('../models/loan_application.model');
const EmiSchedule = require('../models/emi_schedule.model');

const {
    ROLES,
    GROUP_FLOW_TYPES,
    GROUP_TRANSACTION_TYPES,
    SAVINGS_STATUS,
    LOAN_STATUS,
    LOAN_APPLICATION_STATUS,
    EMI_SCHEDULE_STATUS
} = require('../assets/constants.json');

function getStartAndEndOfCurrentMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

function calculateDiffInMonths(fromDate, toDate) {
    if (!fromDate) return 0;
    const start = new Date(fromDate);
    const end = new Date(toDate || new Date());
    let months = (end.getFullYear() - start.getFullYear()) * 12;
    months += end.getMonth() - start.getMonth();
    if (end.getDate() < start.getDate()) {
        months -= 1;
    }
    return months < 0 ? 0 : months;
}

const getShgGroupDetails = async (req, res) => {
    try {
        const { shg_group_id } = req.query;

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        const group = await ShgGroup.findById(shg_group_id);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'SHG group not found'
            });
        }

        // Team members
        const [membersCount, president, vicePresident] = await Promise.all([
            User.countDocuments({ shg_group_id: group._id }),
            User.findOne({ shg_group_id: group._id, role: ROLES.PRESIDENT }).select('name mobile_no email'),
            User.findOne({ shg_group_id: group._id, role: ROLES.VICE_PRESIDENT }).select('name mobile_no email')
        ]);

        // Financial aggregates
        const transactionsAgg = await GroupTransaction.aggregate([
            { $match: { shg_group_id: new ObjectId(shg_group_id) } },
            { $group: { _id: '$flow_type', total: { $sum: '$amount' } } }
        ]);

        let totalInflow = 0;
        let totalOutflow = 0;
        for (const row of transactionsAgg) {
            if (row._id === GROUP_FLOW_TYPES.IN) totalInflow += row.total;
            if (row._id === GROUP_FLOW_TYPES.OUT) totalOutflow += row.total;
        }

        const loanDisbursedAgg = await GroupTransaction.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    transaction_type: GROUP_TRANSACTION_TYPES.LOAN_DISBURSED,
                    flow_type: GROUP_FLOW_TYPES.OUT
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalLoanDisbursed = loanDisbursedAgg.length ? loanDisbursedAgg[0].total : 0;

        const savingsAgg = await GroupTransaction.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    transaction_type: GROUP_TRANSACTION_TYPES.SAVINGS_DEPOSIT,
                    flow_type: GROUP_FLOW_TYPES.IN
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalSavings = savingsAgg.length ? savingsAgg[0].total : 0;

        const [activeLoanCount, closedLoanCount] = await Promise.all([
            Loan.countDocuments({ shg_group_id: group._id, status: LOAN_STATUS.ACTIVE }),
            Loan.countDocuments({ shg_group_id: group._id, status: LOAN_STATUS.CLOSED })
        ]);

        // Quick statistics
        const { start: monthStart, end: monthEnd } = getStartAndEndOfCurrentMonth();
        const thisMonthCollectionAgg = await GroupTransaction.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    flow_type: GROUP_FLOW_TYPES.IN,
                    createdAt: { $gte: monthStart, $lte: monthEnd }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const thisMonthCollection = thisMonthCollectionAgg.length ? thisMonthCollectionAgg[0].total : 0;

        const now = new Date();
        const [pendingLoanApplications, overdueSavingsCount, overdueInstallmentsCount] = await Promise.all([
            LoanApplication.countDocuments({ shg_group_id: group._id, status: LOAN_APPLICATION_STATUS.PENDING }),
            Savings.countDocuments({ shg_group_id: group._id, status: SAVINGS_STATUS.PENDING, final_due_date: { $lt: now } }),
            EmiSchedule.countDocuments({ shg_group_id: group._id, status: EMI_SCHEDULE_STATUS.PENDING, final_due_date: { $lt: now } })
        ]);

        const groupAgeMonths = calculateDiffInMonths(group.start_date, new Date());

        return res.status(200).json({
            success: true,
            message: 'SHG group details fetched successfully',
            data: {
                basicInfo: {
                    groupName: group.name,
                    shgId: group.code,
                    startDate: group.start_date,
                    state: group.state,
                    status: group.is_active_yn ? 'active' : 'inactive',
                    groupAgeMonths
                },
                teamMembers: {
                    count: membersCount,
                    president: president ? { name: president.name, mobile: president.mobile_no, email: president.email } : null,
                    vicePresident: vicePresident ? { name: vicePresident.name, mobile: vicePresident.mobile_no, email: vicePresident.email } : null
                },
                financialSummary: {
                    totalInflow,
                    totalOutflow,
                    totalLoanDisbursed,
                    totalSavings,
                    activeLoanCount,
                    closedLoanCount
                },
                quickStatistics: {
                    thisMonthCollection,
                    pendingLoanApplications,
                    overdueSavingsCount,
                    overdueInstallmentsCount
                }
            }
        });
    } catch (error) {
        logger.error('Error in getShgGroupDetails:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const listShgGroups = async (req, res) => {
    try {
        logger.info("Listing SHG groups payload : ", req.query);
        const { limit = 100, offset = 0 } = req.query;

        let skipNum = offset ? parseInt(offset) : 0;
        let limitNum = limit ? parseInt(limit) : 100;

        const shgGroups = await ShgGroup.aggregate([
            { $skip: skipNum },
            { $limit: limitNum },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: 'shg_group_id',
                    as: 'users'
                }
            }
        ]);
        return res.status(200).json({
            success: true,
            message: 'SHG groups fetched successfully',
            data: shgGroups
        });
    }
    catch (error) {
        logger.error('Error in listShgGroups:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deactivateShgGroup = async (req, res) => {
    try {
        const { shg_group_id = null, is_active_yn = true } = req.body;

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        const shgGroup = await ShgGroup.findById(shg_group_id);
        if (!shgGroup) {
            return res.status(404).json({
                success: false,
                message: 'SHG group not found'
            });
        }

        shgGroup.is_active_yn = is_active_yn;
        await shgGroup.save();

        return res.status(200).json({
            success: true,
            message: is_active_yn ? 'SHG group activated successfully' : 'SHG group deactivated successfully'
        });

    } catch (error) {
        logger.error('Error in deactivateShgGroup:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    getShgGroupDetails,
    listShgGroups,
    deactivateShgGroup
};


