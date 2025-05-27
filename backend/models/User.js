// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    publicKey: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
        default: 'Guest' // Default for initial connection before user sets one
    },
    avatar: {
        type: String,
        default: '😎' // Default avatar emoji
    },
    solBalance: {
        type: Number,
        default: 0
    },
    totalWagered: {
        type: Number,
        default: 0
    },
    winStreak: {
        type: Number,
        default: 0
    },
    tenXWins: {
        type: Number,
        default: 0
    },
    xp: {
        type: Number,
        default: 0
    },
    level: {
        type: Number,
        default: 1
    },
    achievements: {
        type: [String], // Array of achievement names
        default: []
    },
    dailyBonusDay: {
        type: Number, // Day of the daily bonus streak (0-6)
        default: 0
    },
    lastLoginDate: {
        type: Date, // Last date daily bonus was claimed
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
