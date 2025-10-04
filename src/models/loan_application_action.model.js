const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { ROLES, LOAN_APPLICATION_WITNESS_ACTION_STATUS } = require('../assets/constants.json');

const loanApplicationActionSchema = new mongoose.Schema(
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
        role: {
            type: String,
            enum: ROLES.ARRAY,
            required: true
        },
        status: {
            type: String,
            enum: LOAN_APPLICATION_WITNESS_ACTION_STATUS.ARRAY,
            default: LOAN_APPLICATION_WITNESS_ACTION_STATUS.PENDING
        },
        reason: {
            type: String
        },
        action_date: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('loan_application_action', loanApplicationActionSchema); 