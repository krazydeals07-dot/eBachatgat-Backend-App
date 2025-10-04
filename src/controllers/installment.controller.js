const Installment = require("../models/emi_schedule.model");
const logger = require('../../logger');
const mongoose = require('mongoose');

const fetchInstallmentByLoanId = async (req, res) => {
    try {
        logger.info('Payload to fetch installment by loan id', req.query);
        const { loan_id } = req.query;
        if (!loan_id) {
            return res.status(400).json({ message: 'Loan ID is required' });
        }
        const installment = await Installment.find({ loan_id }).sort({ installment_number: 1 });
        const currentInstallment = await Installment.find({ loan_id, status: { $in: ['pending', 'submitted'] } })
            .sort({ installment_number: 1 })
            .limit(1);

        res.status(200).json({
            message: 'Installments fetched sucessfully',
            data: {
                installment,
                currentInstallment: currentInstallment[0] || {}
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const fetchInstallmentByStatus = async (req, res) => {
    try {
        logger.info('Payload to fetch installment by status', req.query);
        const { status, shg_group_id } = req.query;
        if (!status) {
            return res.status(400).json({ message: 'SHG group id and Status are required' });
        }
        
        const installment = await Installment.aggregate([
            {
                $match: {
                    shg_group_id: new mongoose.Types.ObjectId(shg_group_id),
                    status
                }
            },
            {
                $lookup: {
                    from: 'loans',
                    localField: 'loan_id',
                    foreignField: '_id',
                    as: 'loan'
                }
            },
            {
                $unwind: {
                    path: '$loan',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'loan.member_id',
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
                $lookup: {
                    from: 'shg_groups',
                    localField: 'shg_group_id',
                    foreignField: '_id',
                    as: 'shg_group'
                }
            },
            {
                $unwind: {
                    path: '$shg_group',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'loan_payments',
                    localField: '_id',
                    foreignField: 'emi_schedule_id',
                    as: 'payments'
                }
            },
            {
                $unwind: {
                    path: '$payments',
                    preserveNullAndEmptyArrays: true
                }
            }
        ])

        return res.status(200).json({
            message: 'Installments fetched sucessfully',
            data: installment
        });

    } catch (error) {
        logger.error('Error fetching installment by status', error);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

module.exports = {
    fetchInstallmentByLoanId,
    fetchInstallmentByStatus
}