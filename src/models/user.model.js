const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const { ROLES } = require('../assets/constants.json');

const userSchema = new mongoose.Schema(
    {
        shg_group_id: {
            type: ObjectId,
            ref: 'shg_group',
            required: true
        },  
        name: {
            type: String,
            required: true
        },
        role: {
            type: String,
            required: true,
            enum: ROLES.ARRAY
        },
        deposit_amount: {
            type: Number,
            required: true
        },
        joining_date: {
            type: Date,
            required: true
        },
        mobile_no: {
            type: String,
            required: true
        },
        email: {
            type: String
        },
        password: {
            type: String,
            required: true
        },
        pan_card: {
            type: String
        },
        aadhar_no: {
            type: String
        },
        gender: {
            type: String
        },
        address: {
            type: String
        },
        nominee: {
            type: String
        },
        nominee_relation: {
            type: String
        },
        is_completed_yn: {
            type: Boolean,
            default: false
        },
        iv: {
            type: String
        },
        pincode: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('user', userSchema); 