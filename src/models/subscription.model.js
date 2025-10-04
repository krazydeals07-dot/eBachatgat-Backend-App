const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const subscriptionSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },
        starts_on: {
            type: Date,
            required: true
        },
        ends_on: {
            type: Date,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        is_free_trail: {
            type: Boolean,
            default: false
        },
        remarks: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('subscription', subscriptionSchema);
