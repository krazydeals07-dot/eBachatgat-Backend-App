const mongoose = require('mongoose');
const constants = require('../assets/constants.json');

const govtSchemesSchema = new mongoose.Schema(
    {
        scheme_name: {
            type: String,
            required: true
        },
        details: {
            type: String,
            required: true
        },
        benefits: {
            type: String,
            required: false
        },
        eligibility: {
            type: String,
            required: false
        },
        application_process: {
            type: String,
            required: false
        },
        documents_required: {
            type: String,
            required: false
        },
        clear_source_of_information: {
            type: String,
            required: true
        },
        disclaimer: {
            type: String,
            required: true
        },
        lang: {
            type: String,
            required: true,
            enum: constants.GOVT_SCHEMES_LANG.ARRAY
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('govt_schemes', govtSchemesSchema);
