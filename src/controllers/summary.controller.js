const logger = require('../../logger');

const Loan = require('../models/loan.model');
const Saving = require('../models/savings.model');
const GroupTransaction = require('../models/group_transaction.model');
const User = require('../models/user.model');
const ShgGroup = require('../models/shg_group.model');

const { SAVINGS_STATUS, LOAN_STATUS, GROUP_TRANSACTION_TYPES, GROUP_FLOW_TYPES } = require('../assets/constants.json');
const XLSX = require('xlsx');

const moment = require('moment-timezone');
const { ObjectId } = require('mongoose').Types;

const getHomeScreenSummaryDetails = async (req, res) => {
    try {
        const { shg_group_id, user_id } = req.query;

        if (!shg_group_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id is required'
            });
        }

        let shgTotalAmount = 0, userTotalAmount = 0, currentBalance = 0, loanDisbursed = 0, totalSaving = 0, totalLoan = 0;

        const shgTransactionData = await GroupTransaction.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                }
            },
            {
                $group: {
                    _id: "$flow_type",
                    total_amount: { $sum: "$amount" }
                }
            }
        ]);

        let amtSpent = 0;

        for (const trans of shgTransactionData) {
            if (trans._id === 'in') {
                shgTotalAmount += trans.total_amount;
            } else if (trans._id === 'out') {
                amtSpent += trans.total_amount;
            }
        }

        currentBalance = shgTotalAmount - amtSpent;

        const userTransactionData = await GroupTransaction.aggregate([

            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    member_id: new ObjectId(user_id)
                }
            },
            {
                $group: {
                    _id: "$flow_type",
                    total_amount: { $sum: "$amount" }
                }
            }
        ]);

        for (const trans of userTransactionData) {
            if (trans._id === 'in') {
                userTotalAmount += trans.total_amount;
            } else if (trans._id === 'out') {
                userTotalAmount -= trans.total_amount;
            }
        }

        const savingsData = await Saving.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id),
                    status: SAVINGS_STATUS.APPROVED
                }
            },
            {
                $group: {
                    _id: "$status",
                    total_amount: { $sum: "$paid_amount" }
                }
            }
        ])

        logger.info('savingsData', savingsData);

        for (const saving of savingsData) {
            if (saving._id === SAVINGS_STATUS.APPROVED) {
                totalSaving += saving.total_amount;
            }
        }

        const loanData = await Loan.aggregate([
            {
                $match: {
                    shg_group_id: new ObjectId(shg_group_id)
                }
            },
            {
                $group: {
                    _id: "$status",
                    total_amount: { $sum: "$approved_amount" }
                }
            }
        ])

        for (const loan of loanData) {
            totalLoan += loan.total_amount;
        }

        return res.status(200).json({
            success: true,
            message: 'Home screen summary details fetched successfully',
            data: {
                shgTotalAmount,
                currentBalance,
                userTotalAmount,
                totalSaving,
                totalLoan
            }
        });

    } catch (error) {
        logger.error('Error in getHomeScreenSummaryDetails:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const getBalanceSheetData = async (req, res) => {
    try {
        const { shg_group_id = null, start_date = null, end_date = null, member_id = null } = req.query;

        if (!shg_group_id || !start_date || !end_date || !member_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id, start_date, end_date, and member_id are required'
            });
        }

        let startDate = moment(start_date).tz('Asia/Kolkata').toDate();
        let endDate = moment(end_date).tz('Asia/Kolkata').toDate();

        let filter = {
            shg_group_id: new ObjectId(shg_group_id),
            createdAt: { $gte: startDate, $lte: endDate }
        }

        const balanceSheetData = await GroupTransaction.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: {
                        transaction_type: "$transaction_type",
                        flow_type: "$flow_type"
                    },
                    total_amount: { $sum: "$amount" }
                }
            }
        ])

        logger.info('balanceSheetData', balanceSheetData);

        const result = {
            total_deposit: 0,
            total_savings: 0,
            total_loan_disbursed: 0,
            interest_earned: 0,
            other_income: 0,
            other_expenses: 0
        }

        for (const transaction of balanceSheetData) {

            if (transaction._id.transaction_type === 'savings_deposit') {
                result.total_savings += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'user_deposit') {
                result.total_deposit += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'loan_disbursed') {
                result.total_loan_disbursed += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'loan_installment') {
                result.interest_earned += transaction.total_amount;
            } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'loan_processing_fee' || transaction._id.transaction_type === 'loan_preclose') && transaction._id.flow_type === 'in') {
                result.other_income += transaction.total_amount;
            } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'group_expense' || transaction._id.transaction_type === 'withdrawl_savings') && transaction._id.flow_type === 'out') {
                result.other_expenses += transaction.total_amount;
            }
        }

        let userResult = {
            total_deposit: 0,
            total_savings: 0,
            total_loan_disbursed: 0,
            interest_earned: 0,
            other_income: 0,
            other_expenses: 0
        }

        const user = await User.findById(member_id);

        if (user) {
            userResult.name = user.name;
            filter.member_id = new ObjectId(member_id);

            const userBalanceSheetData = await GroupTransaction.aggregate([
                {
                    $match: filter
                },
                {
                    $group: {
                        _id: {
                            transaction_type: "$transaction_type",
                            flow_type: "$flow_type"
                        },
                        total_amount: { $sum: "$amount" }
                    }
                }
            ]);

            for (const transaction of userBalanceSheetData) {
                if (transaction._id.transaction_type === 'savings_deposit') {
                    userResult.total_savings += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'user_deposit') {
                    userResult.total_deposit += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'loan_disbursed') {
                    userResult.total_loan_disbursed += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'loan_installment') {
                    userResult.interest_earned += transaction.total_amount;
                } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'loan_processing_fee' || transaction._id.transaction_type === 'loan_preclose') && transaction._id.flow_type === 'in') {
                    userResult.other_income += transaction.total_amount;
                } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'group_expense' || transaction._id.transaction_type === 'withdrawl_savings') && transaction._id.flow_type === 'out') {
                    userResult.other_expenses += transaction.total_amount;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Balance sheet data fetched successfully',
            data: result,
            userdata: userResult
        });

    } catch (error) {
        logger.error('Error in getBalanceSheetData:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const downloadBalanceSheet = async (req, res) => {
    try {
        const { shg_group_id = null, start_date = null, end_date = null, member_id = null } = req.query;

        if (!shg_group_id || !start_date || !end_date || !member_id) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id, start_date, end_date, and member_id are required'
            });
        }

        let startDate = moment(start_date).tz('Asia/Kolkata').toDate();
        let endDate = moment(end_date).tz('Asia/Kolkata').toDate();

        // Get SHG group details
        const shgGroup = await ShgGroup.findById(shg_group_id);
        if (!shgGroup) {
            return res.status(404).json({
                success: false,
                message: 'SHG Group not found'
            });
        }

        // Base filter for group transactions
        let groupFilter = {
            shg_group_id: new ObjectId(shg_group_id),
            createdAt: { $gte: startDate, $lte: endDate }
        };

        // Get group-level transactions (all transactions for the group)
        const groupTransactions = await GroupTransaction.aggregate([
            {
                $match: groupFilter
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'member_id',
                    foreignField: '_id',
                    as: 'member'
                }
            },
            {
                $unwind: {
                    path: '$member',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            }
        ]);

        // Get group summary data
        const groupSummaryData = await GroupTransaction.aggregate([
            {
                $match: groupFilter
            },
            {
                $group: {
                    _id: {
                        transaction_type: "$transaction_type",
                        flow_type: "$flow_type"
                    },
                    total_amount: { $sum: "$amount" }
                }
            }
        ]);

        // Calculate group summary
        const groupResult = {
            total_deposit: 0,
            total_savings: 0,
            total_loan_disbursed: 0,
            interest_earned: 0,
            other_income: 0,
            other_expenses: 0
        };

        for (const transaction of groupSummaryData) {
            if (transaction._id.transaction_type === 'savings_deposit') {
                groupResult.total_savings += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'user_deposit') {
                groupResult.total_deposit += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'loan_disbursed') {
                groupResult.total_loan_disbursed += transaction.total_amount;
            } else if (transaction._id.transaction_type === 'loan_installment') {
                groupResult.interest_earned += transaction.total_amount;
            } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'loan_processing_fee' || transaction._id.transaction_type === 'loan_preclose') && transaction._id.flow_type === 'in') {
                groupResult.other_income += transaction.total_amount;
            } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'group_expense' || transaction._id.transaction_type === 'withdrawl_savings') && transaction._id.flow_type === 'out') {
                groupResult.other_expenses += transaction.total_amount;
            }
        }

        // Get member-specific data
        let memberResult = {
            total_deposit: 0,
            total_savings: 0,
            total_loan_disbursed: 0,
            interest_earned: 0,
            other_income: 0,
            other_expenses: 0
        };

        let memberTransactions = [];
        const user = await User.findById(member_id);

        if (user) {
            let memberFilter = {
                ...groupFilter,
                member_id: new ObjectId(member_id)
            };

            // Get member-specific transactions
            memberTransactions = await GroupTransaction.aggregate([
                {
                    $match: memberFilter
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'member_id',
                        foreignField: '_id',
                        as: 'member'
                    }
                },
                {
                    $unwind: {
                        path: '$member',
                        preserveNullAndEmptyArrays: true
                    }
                },
                {
                    $sort: {
                        createdAt: -1
                    }
                }
            ]);

            // Get member summary data
            const memberSummaryData = await GroupTransaction.aggregate([
                {
                    $match: memberFilter
                },
                {
                    $group: {
                        _id: {
                            transaction_type: "$transaction_type",
                            flow_type: "$flow_type"
                        },
                        total_amount: { $sum: "$amount" }
                    }
                }
            ]);

            // Calculate member summary
            for (const transaction of memberSummaryData) {
                if (transaction._id.transaction_type === 'savings_deposit') {
                    memberResult.total_savings += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'user_deposit') {
                    memberResult.total_deposit += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'loan_disbursed') {
                    memberResult.total_loan_disbursed += transaction.total_amount;
                } else if (transaction._id.transaction_type === 'loan_installment') {
                    memberResult.interest_earned += transaction.total_amount;
                } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'loan_processing_fee' || transaction._id.transaction_type === 'loan_preclose') && transaction._id.flow_type === 'in') {
                    memberResult.other_income += transaction.total_amount;
                } else if ((transaction._id.transaction_type === 'others' || transaction._id.transaction_type === 'group_expense' || transaction._id.transaction_type === 'withdrawl_savings') && transaction._id.flow_type === 'out') {
                    memberResult.other_expenses += transaction.total_amount;
                }
            }
        }

        // Create workbook and worksheets
        const workbook = XLSX.utils.book_new();

        // Summary Comparison Sheet
        const summarySheet = [
            ['Balance Sheet Summary'],
            ['SHG Group:', shgGroup.name],
            ['Group Code:', shgGroup.code],
            ['Member:', user ? user.name : 'Not Found'],
            ['Period:', `${moment(startDate).format('DD/MM/YYYY')} to ${moment(endDate).format('DD/MM/YYYY')}`],
            ['Generated On:', moment().tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm:ss')],
            [],
            ['', 'Group Total', 'Member Total'],
            ['Total Deposit', groupResult.total_deposit, memberResult.total_deposit],
            ['Total Savings', groupResult.total_savings, memberResult.total_savings],
            ['Interest Earned', groupResult.interest_earned, memberResult.interest_earned],
            ['Other Income', groupResult.other_income, memberResult.other_income],
            ['Loan Disbursed', groupResult.total_loan_disbursed, memberResult.total_loan_disbursed],
            ['Other Expenses', groupResult.other_expenses, memberResult.other_expenses],
            [],
            ['Total Income',
                groupResult.total_deposit + groupResult.total_savings + groupResult.interest_earned + groupResult.other_income,
                memberResult.total_deposit + memberResult.total_savings + memberResult.interest_earned + memberResult.other_income
            ],
            ['Total Expenses',
                groupResult.total_loan_disbursed + groupResult.other_expenses,
                memberResult.total_loan_disbursed + memberResult.other_expenses
            ],
            ['Net Balance',
                (groupResult.total_deposit + groupResult.total_savings + groupResult.interest_earned + groupResult.other_income) - (groupResult.total_loan_disbursed + groupResult.other_expenses),
                (memberResult.total_deposit + memberResult.total_savings + memberResult.interest_earned + memberResult.other_income) - (memberResult.total_loan_disbursed + memberResult.other_expenses)
            ],
            [],
            ['Transaction Count', groupTransactions.length, memberTransactions.length]
        ];

        const summaryWS = XLSX.utils.aoa_to_sheet(summarySheet);
        summaryWS['!cols'] = [
            { width: 20 },  // Description
            { width: 18 },  // Group Total
            { width: 18 }   // Member Total
        ];
        XLSX.utils.book_append_sheet(workbook, summaryWS, 'Summary');

        // Group Transactions Sheet
        const groupHeaders = [
            'Sr. No.',
            'Date',
            'Member Name',
            'Mobile No',
            'Transaction Type',
            'Flow Type',
            'Amount (₹)',
            'Notes',
            'Created At'
        ];

        const groupTransactionData = [groupHeaders];

        groupTransactions.forEach((transaction, index) => {
            groupTransactionData.push([
                index + 1,
                moment(transaction.createdAt).tz('Asia/Kolkata').format('DD/MM/YYYY'),
                transaction.member ? transaction.member.name : 'Group Transaction',
                transaction.member ? transaction.member.mobile_no : '-',
                transaction.transaction_type.replace(/_/g, ' ').toUpperCase(),
                transaction.flow_type.toUpperCase(),
                transaction.amount,
                transaction.notes || '-',
                moment(transaction.createdAt).tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm:ss')
            ]);
        });

        const groupTransactionWS = XLSX.utils.aoa_to_sheet(groupTransactionData);
        groupTransactionWS['!cols'] = [
            { width: 8 },   // Sr. No.
            { width: 12 },  // Date
            { width: 20 },  // Member Name
            { width: 15 },  // Mobile No
            { width: 20 },  // Transaction Type
            { width: 12 },  // Flow Type
            { width: 15 },  // Amount
            { width: 25 },  // Notes
            { width: 20 }   // Created At
        ];
        XLSX.utils.book_append_sheet(workbook, groupTransactionWS, 'Group Transactions');

        // Member Transactions Sheet
        const memberHeaders = [
            'Sr. No.',
            'Date',
            'Member Name',
            'Mobile No',
            'Transaction Type',
            'Flow Type',
            'Amount (₹)',
            'Notes',
            'Created At'
        ];

        const memberTransactionData = [memberHeaders];

        memberTransactions.forEach((transaction, index) => {
            memberTransactionData.push([
                index + 1,
                moment(transaction.createdAt).tz('Asia/Kolkata').format('DD/MM/YYYY'),
                transaction.member ? transaction.member.name : 'Unknown Member',
                transaction.member ? transaction.member.mobile_no : '-',
                transaction.transaction_type.replace(/_/g, ' ').toUpperCase(),
                transaction.flow_type.toUpperCase(),
                transaction.amount,
                transaction.notes || '-',
                moment(transaction.createdAt).tz('Asia/Kolkata').format('DD/MM/YYYY HH:mm:ss')
            ]);
        });

        const memberTransactionWS = XLSX.utils.aoa_to_sheet(memberTransactionData);
        memberTransactionWS['!cols'] = [
            { width: 8 },   // Sr. No.
            { width: 12 },  // Date
            { width: 20 },  // Member Name
            { width: 15 },  // Mobile No
            { width: 20 },  // Transaction Type
            { width: 12 },  // Flow Type
            { width: 15 },  // Amount
            { width: 25 },  // Notes
            { width: 20 }   // Created At
        ];
        XLSX.utils.book_append_sheet(workbook, memberTransactionWS, 'Member Transactions');

        // Generate Excel file
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers for file download
        const memberName = user ? `_${user.name.replace(/\s+/g, '_')}` : '';
        const fileName = `Balance_Sheet_${shgGroup.name.replace(/\s+/g, '_')}${memberName}_${moment(startDate).format('DD-MM-YYYY')}_to_${moment(endDate).format('DD-MM-YYYY')}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', buffer.length);

        logger.info(`Balance sheet downloaded for group: ${shgGroup.name}, Member: ${user ? user.name : 'N/A'}, Period: ${start_date} to ${end_date}, Group Transactions: ${groupTransactions.length}, Member Transactions: ${memberTransactions.length}`);

        return res.send(buffer);

    } catch (error) {
        logger.error('Error in downloadBalanceSheet:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getHomeScreenSummaryDetails,
    getBalanceSheetData,
    downloadBalanceSheet
}