// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // The wallet address of the user, required and must be unique.
  // Indexed for faster lookups in the database.
  wallet: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Public key, kept for consistency with existing frontend code that might use it.
  // It will typically be the same as 'wallet'.
  publicKey: {
    type: String,
    required: true,
    unique: true,
  },
  // User's chosen username, with a default for new connections.
  username: {
    type: String,
    required: true,
    default: 'Guest'
  },
  // User's chosen avatar emoji.
  avatar: {
    type: String,
    default: '😎'
  },
  // User's balance in SOL (stored as a Number, representing SOL units).
  // Defaults to 0 and cannot be negative.
  solBalance: {
    type: Number,
    default: 0,
    min: 0,
  },
  // Total amount of SOL wagered by the user.
  totalWagered: {
    type: Number,
    default: 0
  },
  // Current consecutive win streak.
  winStreak: {
    type: Number,
    default: 0
  },
  // Count of 10x multiplier wins.
  tenXWins: {
    type: Number,
    default: 0
  },
  // Experience points for leveling up.
  xp: {
    type: Number,
    default: 0
  },
  // User's current level.
  level: {
    type: Number,
    default: 1
  },
  // Array of achievement names unlocked by the user.
  achievements: {
    type: [String],
    default: []
  },
  // Day of the daily bonus streak (0-6).
  dailyBonusDay: {
    type: Number,
    default: 0
  },
  // Last date the daily bonus was claimed.
  lastLoginDate: {
    type: Date,
    default: null
  },
  // Timestamp for when the user account was created, defaults to the current date and time.
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('User', userSchema);
