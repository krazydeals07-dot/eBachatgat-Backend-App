const logger = require('../../logger');
const LoanPayment = require('../models/loan_payment.model');
const EmiSchedule = require('../models/emi_schedule.model');
const Loan = require('../models/loan.model');
const User = require('../models/user.model');
const uploadFile = require('../utils/vercel_blob');
const moment = require('moment-timezone');
const { ObjectId } = require('mongoose');
const { saveGroupTransaction } = require('../utils/commonFunctions');
const { GROUP_FLOW_TYPES, GROUP_TRANSACTION_TYPES, EMI_SCHEDULE_STATUS, LOAN_PAYMENT_STATUS } = require('../assets/constants.json');
const handlebars = require('handlebars');
const transactionTemplates = require('../assets/transaction_templates.json');

const createLoanPayment = async (req, res) => {
    try {
        const {
            shg_group_id,
            loan_id,
            emi_schedule_id,
            member_id,
            amount_paid,
            payment_mode = 'cash',
            transaction_id,
            remarks
        } = req.body;

        let files = req.files || [];

        // Validate required fields
        if (!shg_group_id || !loan_id || !emi_schedule_id || !member_id || !amount_paid) {
            return res.status(400).json({
                success: false,
                message: 'shg_group_id, loan_id, emi_schedule_id, member_id, and amount_paid are required'
            });
        }


        // Check if EMI schedule exists and is pending
        const emiSchedule = await EmiSchedule.findOne({
            _id: emi_schedule_id,
            loan_id: loan_id,
            shg_group_id: shg_group_id,
            status: { $in: [EMI_SCHEDULE_STATUS.PENDING] }
        });

        if (!emiSchedule) {
            return res.status(404).json({
                success: false,
                message: 'EMI schedule not found or already paid'
            });
        }

        // Validate payment amount
        const totalAmount = emiSchedule.total_installment_amount + emiSchedule.penalty_amount;
        if (amount_paid < totalAmount) {
            return res.status(400).json({
                success: false,
                message: `Payment amount must be at least ${totalAmount}. Required: ${totalAmount}, Paid: ${amount_paid}`
            });
        }

        // Handle file upload for payment proof
        let proofUrl = null;
        if (files && files.length > 0) {
            let temp = files[0];
            const path = `${process.env.APP_ENV}/loan_payment/proof/${temp.originalname}`;
            logger.info('Uploading file to:', path, temp);
            const url = await uploadFile(path, temp);
            if (url) proofUrl = path;
        }

        // Create payment payload
        const paymentPayload = {
            shg_group_id,
            loan_id,
            emi_schedule_id,
            member_id,
            amount_paid,
            payment_date: moment().tz('Asia/Kolkata').toDate(),
            payment_mode,
            transaction_id: transaction_id || null,
            status: LOAN_PAYMENT_STATUS.SUCCESS,
            proof: proofUrl,
            remarks: remarks || null
        };

        logger.info('Creating loan payment with payload:', paymentPayload);

        // Create the payment
        const payment = await LoanPayment.create(paymentPayload);

        // Update EMI schedule status
        await EmiSchedule.findByIdAndUpdate(emi_schedule_id, {
            status: EMI_SCHEDULE_STATUS.SUBMITTED
        });

        logger.info('Loan payment created successfully:', payment);

        return res.status(200).json({
            success: true,
            message: 'Loan payment created successfully',
            data: payment
        });

    } catch (error) {
        logger.error('Error in createLoanPayment:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const approveOrRejectPayment = async (req, res) => {
    try {
        logger.info('Payload to approve or reject payment', req.body);
        const { payment_id, status, reason = '' } = req.body;
        if (!payment_id || !status) {
            return res.status(400).json({ message: 'Payment id and status are required' });
        }

        let loanPayment = await LoanPayment.findById(payment_id);
        if (!loanPayment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        let emi_schedule_id = loanPayment.emi_schedule_id;
        let emiSchedule = await EmiSchedule.findById(emi_schedule_id);
        if (!emiSchedule) {
            return res.status(404).json({ message: 'EMI schedule not found' });
        }

        if (status?.toLowerCase() === 'approved') {
            emiSchedule.status = EMI_SCHEDULE_STATUS.COMPLETED;
            loanPayment.status = LOAN_PAYMENT_STATUS.SUCCESS
        } else if (status?.toLowerCase() === 'rejected') {
            emiSchedule.status = EMI_SCHEDULE_STATUS.PENDING;
            loanPayment.status = LOAN_PAYMENT_STATUS.FAILED;
            loanPayment.rejectReason = reason;
        } else {
            return res.status(400).json({ message: 'Invalid status' });
        }

        await loanPayment.save();
        await emiSchedule.save();

        if (status?.toLowerCase() === 'approved') {

            // update loan model
            const loanData = await Loan.findById(loanPayment.loan_id);
            loanData.principal_balance = parseInt(loanData?.principal_balance || 0) - parseInt(loanPayment.amount_paid);
            await loanData.save();

            let user = await User.findById(loanPayment.member_id);
            let template = emiSchedule.is_penalty_added ? transactionTemplates.LOAN_INSTALLMENT_WITH_PENALTY : transactionTemplates.LOAN_INSTALLMENT_WITHOUT_PENALTY;

            let handlebarsTemplate = handlebars.compile(template);
            let notes = handlebarsTemplate({
                member_name: user.name,
                amount: loanPayment.amount_paid,
                loan_id: loanPayment.loan_id,
                installment_number: emiSchedule.installment_number,
                penalty_amount: emiSchedule.penalty_amount
            });

            let gtPayload = {
                shg_group_id: loanPayment.shg_group_id,
                // member_id: loanPayment.member_id,
                amount: loanPayment.amount_paid,
                flow_type: GROUP_FLOW_TYPES.IN,
                transaction_type: GROUP_TRANSACTION_TYPES.LOAN_INSTALLMENT,
                reference_model: 'loan',
                reference_id: loanPayment.loan_id,
                is_group_activity: false,
                notes: notes
            }

            await saveGroupTransaction(gtPayload).catch(err => {
                logger.error('Error in saveGroupTransaction:', err);
            });
        }

        return res.status(200).json({ message: 'Payment approved or rejected sucessfully', data: loanPayment });

    } catch (error) {
        logger.error('Error approving or rejecting payment', error);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

module.exports = {
    createLoanPayment,
    approveOrRejectPayment
};
