const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        mobile_no: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true
        },
        iv: {
            type: String,
            required: true
        },
        last_login_date: {
            type: Date
        },
        password_changed_date: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('admin', adminSchema);