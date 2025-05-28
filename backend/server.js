// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Connection, PublicKey, SystemProgram, Transaction } = require('@solana/web3.js');
const nacl = require('tweetnacl'); // For signature verification
const bs58 = require("bs58"); // Required for base58 encoding/decoding of Solana data
require('dotenv').config(); // Load environment variables

// --- Database Connection ---
const connectDB = require('./db');
connectDB();

// --- Mongoose Models ---
const User = require('./models/User'); // Ensure this is the expanded User model
const Bet = require('./models/Bet');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express
app.use(cors({
    origin: process.env.FRONTEND_URL, // Use environment variable for production URL
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json()); // For parsing application/json - Ensure this is at the top of middleware setup

// --- JWT Secret (Replace with a strong, random secret in production) ---
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_12345';

// --- Socket.IO Server Setup ---
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // Use environment variable for production URL
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// --- Middleware to authenticate Socket.IO connections ---
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: No token provided.'));
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.publicKey = decoded.publicKey;
        // Fetch user data and attach to socket for easy access
        const user = await User.findOne({ publicKey: socket.publicKey });
        if (!user) {
            return next(new Error('Authentication error: User not found.'));
        }
        socket.userData = user;
        next();
    } catch (err) {
        console.error('JWT verification error:', err);
        next(new Error('Authentication error: Invalid token.'));
    }
});

// --- Global Game State ---
let spinTimer = 25;
let isSpinning = false;
let betsQueue = []; // Stores bets for the current round
let currentSpinResult = null; // Stores the result of the current spin

// --- Solana Connection (for real balance checks and future transactions) ---
const solanaConnection = new Connection('https://api.mainnet-beta.solana.com'); // Mainnet-beta

// --- Helper: Get Random Multiplier (Server-side RNG for fairness) ---
function getRandomMultiplier() {
    const segments = [
        { multiplier: '1.5x', probability: 0.3 },
        { multiplier: '2x', probability: 0.2 },
        { multiplier: '3x', probability: 0.2 },
        { multiplier: '5x', probability: 0.15 },
        { multiplier: '10x', probability: 0.15 }
    ];
    const totalProbability = segments.reduce((sum, seg) => sum + seg.probability, 0);
    let random = Math.random() * totalProbability;
    for (const segment of segments) {
        if (random < segment.probability) {
            return segment.multiplier;
        }
        random -= segment.probability;
    }
    return '1.5x'; // Fallback
}

// --- Helper: Resolve Bets ---
async function resolveBet(bet, winningMultiplier) {
    const user = await User.findById(bet.userId);
    if (!user) {
        console.error(`User not found for bet resolution: ${bet.userId}`);
        return;
    }

    const betMultiplierNumeric = parseFloat(bet.multiplier);
    const winningMultiplierNumeric = parseFloat(winningMultiplier.replace('x', ''));
    let won = false;
    let winnings = 0;

    if (betMultiplierNumeric === winningMultiplierNumeric) {
        won = true;
        winnings = bet.amount * betMultiplierNumeric;
        user.solBalance += winnings; // Use solBalance as per updated User model
        user.winStreak++;
        if (winningMultiplierNumeric >= 5) { // 5x or 10x
            user.tenXWins++;
        }
    } else {
        user.winStreak = 0;
    }

    user.totalWagered += bet.amount;
    user.xp += 10; // XP for playing a round
    if (user.xp >= 100) { // Simple leveling
        user.level = (user.level || 1) + 1;
        user.xp -= 100;
    }
    // Check achievements (simplified, can be more complex)
    if (user.winStreak >= 3 && !user.achievements.includes('Lucky Streak x3')) user.achievements.push('Lucky Streak x3');
    if (user.totalWagered >= 50 && !user.achievements.includes('High Roller')) user.achievements.push('High Roller');
    if (user.tenXWins >= 1 && !user.achievements.includes('Hit 10x')) user.achievements.push('Hit 10x');


    await user.save();
    return {
        publicKey: user.publicKey,
        username: user.username,
        avatar: user.avatar, // Include avatar for frontend consistency
        amount: bet.amount,
        multiplier: bet.multiplier,
        winningMultiplier: winningMultiplier,
        won: won,
        winnings: winnings,
        solBalance: user.solBalance,
        totalWagered: user.totalWagered,
        winStreak: user.winStreak,
        tenXWins: user.tenXWins,
        xp: user.xp,
        level: user.level,
        achievements: user.achievements
    };
}

// --- Global Spin Timer Loop ---
setInterval(async () => {
    // Broadcast countdown
    io.emit('spinCountdown', { timeLeft: spinTimer });

    if (spinTimer <= 0) {
        if (!isSpinning) {
            isSpinning = true;
            console.log('Spinning started!');
            io.emit('spinCountdown', { timeLeft: 'Spinning...' }); // Update UI to spinning state

            // Determine winning multiplier
            const winningMultiplier = getRandomMultiplier();
            currentSpinResult = winningMultiplier;

            // Resolve all bets in the queue
            const betsOutcome = [];
            for (const bet of betsQueue) {
                const outcome = await resolveBet(bet, winningMultiplier);
                betsOutcome.push(outcome);
            }
            betsQueue = []; // Clear queue for next round

            // Fetch updated leaderboard and online players (using actual User model fields)
            const updatedLeaderboard = {
                wager: (await User.find().sort({ totalWagered: -1 }).limit(7)).map(u => ({ username: u.username, totalWagered: u.totalWagered, avatar: u.avatar, publicKey: u.publicKey })),
                streak: (await User.find().sort({ winStreak: -1 }).limit(7)).map(u => ({ username: u.username, winStreak: u.winStreak, avatar: u.avatar, publicKey: u.publicKey })),
                '10x': (await User.find().sort({ tenXWins: -1 }).limit(7)).map(u => ({ username: u.username, tenXWins: u.tenXWins, avatar: u.avatar, publicKey: u.publicKey }))
            };
            const totalUsersOnline = io.engine.clientsCount; // Actual connected sockets

            // Broadcast spin result after animation duration (frontend spinDuration is 5s)
            setTimeout(() => {
                io.emit('spinResult', {
                    winningMultiplier: winningMultiplier,
                    betsOutcome: betsOutcome,
                    newLeaderboard: updatedLeaderboard,
                    newUsersOnline: totalUsersOnline
                });
                isSpinning = false;
                spinTimer = 25; // Reset timer for next round
                console.log(`Spin finished. Result: ${winningMultiplier}. Next spin in ${spinTimer}s.`);
            }, 5000); // Wait for frontend animation to finish
        }
    } else {
        spinTimer--;
    }
}, 1000); // Run every second

// --- API Routes ---

// Wallet Signature Verification Endpoint
// This endpoint verifies wallet ownership via signed messages.
app.post('/auth/verify', async (req, res) => {
  try {
    const { address, signature, message } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Missing fields.' });
    }

    // Convert message string to Uint8Array
    const msgUint8 = new TextEncoder().encode(message);
    // Decode base58 signature string to Uint8Array
    const sigUint8 = bs58.decode(signature);
    // Decode base58 public key (address) string to Uint8Array
    const pubKeyUint8 = bs58.decode(address);

    // Verify the signature using nacl.sign.detached.verify
    const isValid = nacl.sign.detached.verify(msgUint8, sigUint8, pubKeyUint8);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Create/find user in DB based on the verified wallet address
    let user = await User.findOne({ wallet: address });
    if (!user) {
      // If user does not exist, create a new user with the wallet address and a default balance
      user = new User({
          wallet: address,
          publicKey: address, // Store wallet address as publicKey for consistency with existing code
          username: address.slice(0, 4) + '...' + address.slice(-4), // Default username
          solBalance: 0.01, // Welcome bonus (using solBalance field)
          totalWagered: 0,
          winStreak: 0,
          tenXWins: 0,
          achievements: [],
          dailyBonusDay: 0,
          lastLoginDate: null,
          xp: 0, // Initialize XP
          level: 1 // Initialize level
      });
      await user.save();
      console.log(`New user created via /auth/verify: ${user.username} with welcome bonus.`);
    }

    // Generate a JWT token for the authenticated user
    const token = jwt.sign({ userId: user._id, publicKey: user.publicKey }, JWT_SECRET, { expiresIn: '1d' });

    // Respond with success and user data (all fields from the expanded User model)
    return res.json({
      success: true,
      token: token, // Include the token in the response
      user: {
        wallet: user.wallet,
        publicKey: user.publicKey,
        username: user.username,
        avatar: user.avatar,
        solBalance: user.solBalance,
        totalWagered: user.totalWagered,
        winStreak: user.winStreak,
        tenXWins: user.tenXWins,
        xp: user.xp,
        level: user.level,
        achievements: user.achievements,
        dailyBonusDay: user.dailyBonusDay,
        lastLoginDate: user.lastLoginDate
      }
    });
  } catch (err) {
    console.error('Signature verification failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user; // Attach decoded user payload
        next();
    });
};

// 2. Profile Editing - Update Username
app.post('/api/profile/update-username', authenticateToken, async (req, res) => {
    const { username } = req.body;
    if (!username || username.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.username = username;
        await user.save();

        // Broadcast username change to all connected clients
        io.emit('profileUpdate', { publicKey: user.publicKey, username: user.username, avatar: user.avatar });

        res.json({
            message: 'Username updated successfully.',
            username: user.username,
            avatar: user.avatar // Return avatar as well for consistency
        });
    } catch (error) {
        console.error('Error updating username:', error);
        res.status(500).json({ message: 'Failed to update username.' });
    }
});

// 3. Mock Top Up (for testing purposes, not real SOL)
app.post('/api/mock-top-up', authenticateToken, async (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid top-up amount.' });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.solBalance += amount; // Use solBalance
        await user.save();

        res.json({
            message: `Successfully topped up ${amount} SOL.`,
            solBalance: user.solBalance
        });
    } catch (error) {
        console.error('Error during mock top-up:', error);
        res.status(500).json({ message: 'Failed to process mock top-up.' });
    }
});
// 4. Claim Daily Bonus
app.post('/api/claim-daily-bonus', authenticateToken, async (req, res) => {
    const { amount, day } = req.body;
    if (typeof amount !== 'number' || amount <= 0 || typeof day !== 'number') {
        return res.status(400).json({ message: 'Invalid bonus data.' });
    }

    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const today = new Date().toDateString();
        if (user.lastLoginDate && new Date(user.lastLoginDate).toDateString() === today) {
            return res.status(400).json({ message: 'Daily bonus already claimed today.' });
        }

        user.solBalance += amount; // Use solBalance
        user.lastLoginDate = new Date();
        user.dailyBonusDay = day; // Sync daily bonus day from frontend

        if (day === 7) { // Reset after day 7
            user.dailyBonusDay = 0;
        }

        // Check for 'Daily Grinder' achievement
        if (user.dailyBonusDay >= 5 && !user.achievements.includes('Daily Grinder')) {
            user.achievements.push('Daily Grinder');
        }

        await user.save();
        res.json({
            message: `Daily bonus of ${amount} SOL claimed!`,
            solBalance: user.solBalance,
            dailyBonusDay: user.dailyBonusDay,
            achievements: user.achievements
        });
    } catch (error) {
        console.error('Error claiming daily bonus:', error);
        res.status(500).json({ message: 'Failed to claim daily bonus.' });
    }
});


// --- Socket.IO Event Handlers ---

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id} (PublicKey: ${socket.publicKey})`);

    // Emit initial state to the newly connected client
    socket.emit('initialState', {
        spinTimer,
        isSpinning,
        user: socket.userData ? {
            publicKey: socket.userData.publicKey,
            username: socket.userData.username,
            avatar: socket.userData.avatar,
            solBalance: socket.userData.solBalance,
            totalWagered: socket.userData.totalWagered,
            winStreak: socket.userData.winStreak,
            tenXWins: socket.userData.tenXWins,
            xp: socket.userData.xp,
            level: socket.userData.level,
            achievements: socket.userData.achievements,
            dailyBonusDay: socket.userData.dailyBonusDay,
            lastLoginDate: socket.userData.lastLoginDate
        } : null, // Send user data if authenticated
        recentSpins: [], // This would ideally be fetched from a 'Spin' or 'Bet' history collection
        leaderboard: {}, // This will be updated by the setInterval below
        playersOnline: io.engine.clientsCount // Number of connected sockets
    });
    // Handle 'authenticate' event from frontend (after token is received on client)
    socket.on('authenticate', async ({ token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await User.findById(decoded.userId);
            if (!user) {
                return socket.emit('authError', 'User not found.');
            }
            socket.userId = user._id;
            socket.publicKey = user.publicKey;
            socket.userData = user;
            socket.emit('authenticated', {
                publicKey: user.publicKey,
                username: user.username,
                avatar: user.avatar,
                solBalance: user.solBalance,
                totalWagered: user.totalWagered,
                winStreak: user.winStreak,
                tenXWins: user.tenXWins,
                xp: user.xp,
                level: user.level,
                achievements: user.achievements,
                dailyBonusDay: user.dailyBonusDay,
                lastLoginDate: user.lastLoginDate
            });
            console.log(`User ${user.username} re-authenticated via Socket.IO.`);
        } catch (err) {
            socket.emit('authError', 'Invalid or expired token.');
            console.error('Socket.IO authentication error:', err);
        }
    });

    // Handle 'placeBet' event
    socket.on('placeBet', async (betData) => {
        if (!socket.userData) {
            return socket.emit('betError', 'Not authenticated to place bets.');
        }

        const { amount, multiplier } = betData;

        // Server-side validation
        if (typeof amount !== 'number' || amount <= 0 || !multiplier) {
            return socket.emit('betError', 'Invalid bet amount or multiplier.');
        }
        // Validate multiplier value
        const allowedMultipliers = ['1.5', '2', '3', '5', '10'];
        if (!allowedMultipliers.includes(multiplier.toString())) {
            return socket.emit('betError', 'Invalid multiplier selected.');
        }
        if (amount > socket.userData.solBalance) {
            return socket.emit('betError', 'Insufficient SOL balance.');
        }
        // Ensure betting window is open (last 3 seconds of timer)
        if (spinTimer > 3 || isSpinning) {
            return socket.emit('betError', 'Betting is currently closed.');
        }

        try {
            // Deduct amount from user's balance immediately
            socket.userData.solBalance -= amount;
            await socket.userData.save();

            // Add bet to queue
            betsQueue.push({
                userId: socket.userData._id,
                publicKey: socket.userData.publicKey,
                username: socket.userData.username,
                amount: amount,
                multiplier: multiplier
            });
            // Emit confirmation to all clients (including self)
            io.emit('betPlacedConfirmation', {
                username: socket.userData.username,
                amount: amount,
                multiplier: multiplier
            });
            // Update client's balance immediately (optional, but good for UX)
            socket.emit('balanceUpdate', { solBalance: socket.userData.solBalance });
            console.log(`${socket.userData.username} placed a bet of ${amount} on ${multiplier}.`);
        } catch (error) {
            console.error('Error placing bet:', error);
            socket.emit('betError', 'Failed to place bet due to server error.');
        }
    });
    // Handle chat messages
    socket.on('chatMessage', async (data) => {
        if (!socket.userData) {
            return socket.emit('chatError', 'Not authenticated to chat.');
        }
        const message = data.text.trim(); // Changed from data.message to data.text as per frontend emit
        if (!message) return;

        // Sanitize message (basic example)
        const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        // Add length limit for chat messages
        if (sanitizedMessage.length > 200) { // Example limit
            return socket.emit('chatError', 'Chat message too long.');
        }

        // Save chat message to DB (optional, if you want chat history)
        // For now, just broadcast
        console.log(`Chat from ${socket.userData.username}: ${sanitizedMessage}`);
        io.emit('chatMessage', {
            username: socket.userData.username,
            text: sanitizedMessage, // Changed from message to text for consistency with frontend
            reaction: data.reaction || '💬', // Include reaction if provided
            type: 'user' // Explicitly set type to 'user' for client
        });
    });
    // Handle profile updates (e.g., avatar changes - not implemented in frontend yet, but structure is here)
    socket.on('profileUpdate', async (data) => {
        if (!socket.userData) return;

        // Example: If avatar is updated
        if (data.avatar && typeof data.avatar === 'string' && data.avatar.length < 5) { // Simple validation
            socket.userData.avatar = data.avatar;
            await socket.userData.save();

            io.emit('profileUpdate', { publicKey: socket.userData.publicKey, username: socket.userData.username, avatar: socket.userData.avatar });
        }
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Update players online count
        io.emit('playersOnlineUpdate', io.engine.clientsCount);
    });
});

// --- Leaderboard Update Loop ---
setInterval(async () => {
    try {
        const leaderboard = {
            wager: (await User.find().sort({ totalWagered: -1 }).limit(7)).map(u => ({ username: u.username, totalWagered: u.totalWagered, avatar: u.avatar, publicKey: u.publicKey })),
            streak: (await User.find().sort({ winStreak: -1 }).limit(7)).map(u => ({ username: u.username, winStreak: u.winStreak, avatar: u.avatar, publicKey: u.publicKey })),
            '10x': (await User.find().sort({ tenXWins: -1 }).limit(7)).map(u => ({ username: u.username, tenXWins: u.tenXWins, avatar: u.avatar, publicKey: u.publicKey }))
        };
        io.emit('leaderboardUpdate', leaderboard);
        io.emit('playersOnlineUpdate', io.engine.clientsCount); // Also send updated player count
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}, 15000); // Update every 15 seconds

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
