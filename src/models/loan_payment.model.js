const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { LOAN_PAYMENT_STATUS } = require('../assets/constants.json');

const loanPaymentSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },
        loan_id: {
            type: ObjectId,
            ref: 'loan',
            required: true
        },
        emi_schedule_id: {
            type: ObjectId,
            ref: 'emi_schedule',
            required: true
        },
        member_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        amount_paid: {
            type: Number,
            required: true,
            min: 0
        },
        payment_date: {
            type: Date,
            required: true
        },
        payment_mode: {
            type: String,
            enum: ['cash', 'upi', 'bank_transfer']
        },
        transaction_id: {
            type: String
        },
        status: {
            type: String,
            enum: LOAN_PAYMENT_STATUS.ARRAY,
            default: LOAN_PAYMENT_STATUS.SUCCESS
        },
        remarks: {
            type: String
        },
        rejectReason: {
            type: String
        },
        proof: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('loan_payment', loanPaymentSchema); 