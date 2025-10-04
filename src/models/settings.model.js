const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { SETTINGS } = require('../assets/constants.json');

const settingsSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },
        savings_settings: {
            frequency: {
                type: String,
                enum: SETTINGS.FREQUENCY.ARRAY
            },
            amount: {
                type: Number
            },
            due_day: {
                type: Number,
                min: 1,
                max: 31
            },
            grace_period_days: {
                type: Number,
                min: 0
            },
            penalty_amount: {
                type: Number,
                min: 0
            }
        },
        loan_settings: {
            weekly_due_day: {
                type: Number,
                min: 1,
                max: 7
            },
            monthly_due_day: {
                type: Number,
                min: 1,
                max: 31
            },
            grace_period_days: {
                type: Number,
                min: 0
            },
            penalty_amount: {
                type: Number,
                min: 0
            },
            interest_type: {
                type: String,
                enum: SETTINGS.LOAN_SETTINGS.INTEREST_TYPE.ARRAY
            },
            installment_type: {
                type: String,
                enum: SETTINGS.LOAN_SETTINGS.INSTALLMENT_TYPE.ARRAY
            },
            interest_rate: {
                type: Number,
                min: 0,
                max: 100
            },
            processing_fee: {
                type: Number,
                min: 0
            },
            loan_limit: {
                type: Number,
                min: 0
            },
            tenure_limit: {
                type: Number,
                min: 0
            },
            preclose_penalty_rate: {
                type: Number,
                min: 0,
                max: 100
            }
        },
        meeting_settings: {
            frequency: {
                type: String,
                enum: SETTINGS.FREQUENCY.ARRAY
            },
            due_day: {
                type: Number,
                min: 1,
                max: 31
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('settings', settingsSchema); 