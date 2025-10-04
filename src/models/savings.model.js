const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { SAVINGS_STATUS } = require('../assets/constants.json');

const savingsSchema = new mongoose.Schema({
    shg_group_id: {
        type: ObjectId,
        ref: 'shg_group',
        required: true
    },
    user_id: {
        type: ObjectId,
        ref: 'user',
        required: true
    },
    due_amount: {
        type: Number,
        required: true
    },
    paid_amount: {
        type: Number,
        default: 0
    },
    due_date: {
        type: Date,
        required: true
    },
    final_due_date: {
        type: Date,
        required: true
    },
    penalty_amount: {
        type: Number,
        default: 0
    },
    member_remarks: {
        type: String
    },
    admin_remarks: {
        type: String
    },
    status: {
        type: String,
        enum: SAVINGS_STATUS.ARRAY,
        default: SAVINGS_STATUS.PENDING
    },
    proof: {
        type: String
    },
    cycle_start_date: {
        type: Date,
        required: true
    },
    cycle_end_date: {
        type: Date,
        required: true
    },
    is_penalty_added: {
        type: Boolean,
        default: false
    }
},
    {
        timestamps: true
    }
);


const Savings = mongoose.model('Savings', savingsSchema);
module.exports = Savings;