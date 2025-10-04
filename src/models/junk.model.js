const mongoose = require('mongoose');

const junkSchema = new mongoose.Schema(
    {
        playstore_link: {
            type: String
        },
        subscription_expired_content: {
            type: {
                en: {
                    type: String
                },
                hi: {
                    type: String
                },
                mr: {
                    type: String
                }
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('junk', junkSchema);
