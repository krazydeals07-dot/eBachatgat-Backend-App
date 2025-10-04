const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const loanPrecloseSchema = new mongoose.Schema(
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
        total_preclose_amount: {
            type: Number,
            required: true,
            min: 0
        },
        principal_amount: {
            type: Number,
            required: true,
            min: 0
        },
        preclose_charge_amount: {
            type: Number,
            required: true,
            min: 0
        },
        approved_by: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        close_on_installment_no: {
            type: Number,
            required: true,
            min: 1
        },
        notes: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('loan_preclose', loanPrecloseSchema);
