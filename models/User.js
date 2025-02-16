const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: String,
    guildId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    messages: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema); 