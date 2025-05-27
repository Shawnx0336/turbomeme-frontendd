// models/Bet.js
const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    publicKey: {
        type: String, // Store public key for easy lookup
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    multiplier: {
        type: String, // Store as string, e.g., "1.5x", "10x"
        required: true
    },
    spinResult: {
        type: String // What the wheel actually landed on
    },
    won: {
        type: Boolean
    },
    winnings: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Bet', betSchema);
