// models/Bet.js
const mongoose = require('mongoose');

const betSchema = new mongoose.Schema({
    // Reference to the User who placed the bet.
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Public key of the user's wallet at the time of the bet.
    publicKey: {
        type: String, // Store public key for easy lookup and display in live feeds
        required: true
    },
    // The amount of SOL wagered in this bet.
    amount: {
        type: Number,
        required: true
    },
    // The multiplier chosen by the user (e.g., "1.5x", "10x"). Stored as a string.
    multiplier: {
        type: String,
        required: true
    },
    // The actual result the wheel landed on (e.g., "1.5x", "10x").
    spinResult: {
        type: String
    },
    // Boolean indicating whether the user won this bet.
    won: {
        type: Boolean
    },
    // The amount of SOL won from this bet (0 if lost).
    winnings: {
        type: Number,
        default: 0
    },
    // Timestamp when the bet was placed.
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Bet', betSchema);
