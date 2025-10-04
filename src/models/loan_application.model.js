const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { LOAN_APPLICATION_STATUS } = require('../assets/constants.json');

const loanApplicationSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },
        member_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        amount_requested: {
            type: Number,
            required: true,
            min: 0
        },
        purpose: {
            type: String,
            required: true
        },
        collateral: {
            type: String
        },
        tenure: {
            type: Number,
            required: true,
            min: 0
        },
        interest_rate: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        interest_type: {
            type: String,
            enum: ['fixed', 'variable'],
            required: true
        },
        installment_type: {
            type: String,
            enum: ['flat', 'reducing'],
            required: true
        },
        installment_frequency: {
            type: String,
            enum: ['monthly', 'weekly'],
            required: true
        },
        status: {
            type: String,
            enum: LOAN_APPLICATION_STATUS.ARRAY,
            default: LOAN_APPLICATION_STATUS.PENDING
        },
        rejected_reason: {
            type: String
        },
        installment_amount: {
            type: Number,
            required: true,
            min: 0
        },
        total_interest_amount: {
            type: Number,
            required: true,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('loan_application', loanApplicationSchema); 