const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { LOAN_STATUS } = require('../assets/constants.json');

const loanSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },
        loan_application_id: {
            type: ObjectId,
            ref: 'loan_application',
            required: true
        },
        member_id: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        approved_amount: {
            type: Number,
            required: true,
            min: 0
        },
        processing_fee: {
            type: Number,
            required: true,
            min: 0
        },
        tenure: {
            type: Number,
            required: true,
            min: 0
        },
        interest_type: {
            type: String,
            enum: ['fixed', 'variable'],
            required: true
        },
        interest_rate: {
            type: Number,
            required: true,
            min: 0,
            max: 100
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
        installment_amount: {
            type: Number,
            required: true,
            min: 0
        },
        loan_disbursed_date: {
            type: Date
        },
        loan_start_date: {
            type: Date,
            required: true
        },
        loan_end_date: {
            type: Date,
            required: true
        },
        total_interest: {
            type: Number,
            required: true,
            min: 0
        },
        total_repayment_amount: {
            type: Number,
            required: true,
            min: 0
        },
        principal_balance: {
            type: Number,
            required: true,
            min: 0
        },
        status: {
            type: String,
            enum: LOAN_STATUS.ARRAY,
            default: LOAN_STATUS.ACTIVE
        },
        collateral: {
            type: String
        },
        no_of_installments: {
            type: Number,
            required: true
        },
        is_loan_preclosed_yn: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('loan', loanSchema); 