const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true
    },
    moderatorId: {
        type: String,
        required: true
    },
    reason: String,
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Warning', warningSchema); 