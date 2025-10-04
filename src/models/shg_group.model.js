const mongoose = require('mongoose');

const shgGroupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true
        },
        start_date: {
            type: Date,
            required: true
        },
        state: {
            type: String
        },
        code: {
            type: String,
            required: true,
            unique: true
        },
        is_active_yn: {
            type: Boolean,
            default: true
        },
        secret: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('shg_group', shgGroupSchema); 