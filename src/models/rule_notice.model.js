const mongoose = require('mongoose');
const constants = require('../assets/constants.json');

const ruleNoticeSchema = new mongoose.Schema({
    shg_group_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'shg_group',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: constants.RULE_NOTICE_TYPES.ARRAY
    },
    description: {
        type: String,
        required: true
    }
},
    {
        timestamps: true
    }
);

module.exports = mongoose.model('rule_notice', ruleNoticeSchema); 