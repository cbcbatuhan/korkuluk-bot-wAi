const mongoose = require('mongoose');

const guildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: '!' },
    welcomeChannelId: { type: String, default: null },
    goodbyeChannelId: { type: String, default: null },
    moderation: {
        logChannel: { type: String, default: null },
        enableKick: { type: Boolean, default: false },
        enableBan: { type: Boolean, default: false },
        enableWarn: { type: Boolean, default: false },
        enableMute: { type: Boolean, default: false },
        enableUnban: { type: Boolean, default: false },
        enableAutoMod: { type: Boolean, default: false },
        enableSpamProtection: { type: Boolean, default: false },
        enableSwearFilter: { type: Boolean, default: false },
        warningLimits: {
            kick: { type: Number, default: 3 },
            ban: { type: Number, default: 5 }
        },
        muteRole: { type: String, default: null },
        muteDurations: {
            default: { type: Number, default: 3600 },
            max: { type: Number, default: 2592000 }
        }
    },
    customCommands: [{
        name: { type: String, required: true },
        response: { type: String, required: true },
        createdBy: { type: String },
        createdAt: { type: Date, default: Date.now }
    }],
    settings: {
        language: { type: String, default: 'tr' },
        memberCountChannel: { type: String, default: null },
        timezone: { type: String, default: 'Europe/Istanbul' }
    },
    autoRole: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String, default: null }
    },
    leveling: {
        enabled: { type: Boolean, default: false },
        channelId: { type: String, default: null }
    },
    giveaway: {
        channelId: { type: String, default: null }
    }
});

module.exports = mongoose.model('Guild', guildSchema); 