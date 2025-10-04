const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { GROUP_TRANSACTION_TYPES } = require('../assets/constants.json');

const groupTransactionSchema = new mongoose.Schema({
    shg_group_id: {
        type: ObjectId,
        ref: 'shg_group',
        required: true
    },
    member_id: {
        type: ObjectId,
        ref: 'user',
        default: null
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    flow_type: {
        type: String,
        enum: ['in', 'out'],
        required: true
    },
    transaction_type: {
        type: String,
        enum: GROUP_TRANSACTION_TYPES.ARRAY,
        default: GROUP_TRANSACTION_TYPES.OTHERS,
        required: true
    },
    reference_model: {
        type: String,
        default: null
    },
    reference_id: {
        type: ObjectId,
        default: null
    },
    is_group_activity: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        maxlength: 500,
        default: null
    },
    created_by_id: {
        type: ObjectId,
        ref: 'user',
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('group_transaction', groupTransactionSchema);