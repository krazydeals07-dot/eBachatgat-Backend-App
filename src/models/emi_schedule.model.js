const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { EMI_SCHEDULE_STATUS } = require('../assets/constants.json');

const emiScheduleSchema = new mongoose.Schema(
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
        installment_number: {
            type: Number,
            required: true,
            min: 1
        },
        due_date: {
            type: Date,
            required: true
        },
        final_due_date: {
            type: Date,
            required: true
        },
        principal_component: {
            type: Number,
            required: true,
            // min: 0
        },
        interest_component: {
            type: Number,
            required: true,
            // min: 0
        },
        remaining_principal: {
            type: Number,
            required: true,
            // min: 0
        },
        total_installment_amount: {
            type: Number,
            required: true,
            // min: 0
        },
        status: {
            type: String,
            enum: EMI_SCHEDULE_STATUS.ARRAY,
            default: EMI_SCHEDULE_STATUS.PENDING
        },
        is_penalty_added: {
            type: Boolean,
            default: false
        },
        penalty_amount: {
            type: Number,
            default: 0,
            // min: 0
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('emi_schedule', emiScheduleSchema); 