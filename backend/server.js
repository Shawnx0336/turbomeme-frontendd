// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Connection, PublicKey, SystemProgram, Transaction } = require('@solana/web3.js');
const nacl = require('tweetnacl'); // For signature verification
require('dotenv').config(); // Load environment variables

// --- Database Connection ---
const connectDB = require('./db');
connectDB();

// --- Mongoose Models ---
const User = require('./models/User');
const Bet = require('./models/Bet');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express
app.use(cors({
    origin: process.env.FRONTEND_URL, // Use environment variable for production URL [cite: 19]
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json()); // For parsing application/json [cite: 20]

// --- JWT Secret (Replace with a strong, random secret in production) ---
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_12345'; // [cite: 20, 21]

// --- Socket.IO Server Setup ---
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // Use environment variable for production URL [cite: 21]
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
        // Fetch user data and attach to socket for easy access [cite: 22, 23]
        const user = await User.findOne({ publicKey: socket.publicKey }); [cite: 23]
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
let betsQueue = []; // Stores bets for the current round [cite: 24, 25]
let currentSpinResult = null; // Stores the result of the current spin [cite: 25, 26]

// --- Solana Connection (for real balance checks and future transactions) ---
const solanaConnection = new Connection('https://api.mainnet-beta.solana.com'); // Mainnet-beta [cite: 26, 27]

// --- Helper: Get Random Multiplier (Server-side RNG for fairness) ---
function getRandomMultiplier() {
    const segments = [
        { multiplier: '1.5x', probability: 0.3 },
        { multiplier: '2x', probability: 0.2 },
        { multiplier: '3x', probability: 0.2 },
        { multiplier: '5x', probability: 0.15 },
        { multiplier: '10x', probability: 0.15 }
    ];
    const totalProbability = segments.reduce((sum, seg) => sum + seg.probability, 0); [cite: 27, 28]
    let random = Math.random() * totalProbability; [cite: 28, 29]
    for (const segment of segments) {
        if (random < segment.probability) {
            return segment.multiplier; [cite: 29, 30]
        }
        random -= segment.probability;
    }
    return '1.5x'; // Fallback [cite: 30, 31]
}

// --- Helper: Resolve Bets ---
async function resolveBet(bet, winningMultiplier) {
    const user = await User.findById(bet.userId); [cite: 31, 32]
    if (!user) {
        console.error(`User not found for bet resolution: ${bet.userId}`);
        return;
    }

    const betMultiplierNumeric = parseFloat(bet.multiplier); [cite: 33]
    const winningMultiplierNumeric = parseFloat(winningMultiplier.replace('x', '')); [cite: 33]
    let won = false; [cite: 33, 34]
    let winnings = 0; [cite: 34]

    if (betMultiplierNumeric === winningMultiplierNumeric) {
        won = true; [cite: 34, 35]
        winnings = bet.amount * betMultiplierNumeric; [cite: 35]
        user.solBalance += winnings; [cite: 35]
        user.winStreak++; [cite: 35]
        if (winningMultiplierNumeric >= 5) { // 5x or 10x [cite: 35, 36]
            user.tenXWins++; [cite: 36]
        }
    } else {
        user.winStreak = 0; [cite: 36, 37]
    }

    user.totalWagered += bet.amount; [cite: 37]
    user.xp += 10; // XP for playing a round [cite: 37, 38]
    if (user.xp >= 100) { // Simple leveling [cite: 38]
        user.level = (user.level || 1) + 1; [cite: 38, 39]
        user.xp -= 100; [cite: 39]
    }
    // Check achievements (simplified, can be more complex) [cite: 39]
    if (user.winStreak >= 3 && !user.achievements.includes('Lucky Streak x3')) user.achievements.push('Lucky Streak x3'); [cite: 39, 40]
    if (user.totalWagered >= 50 && !user.achievements.includes('High Roller')) user.achievements.push('High Roller'); [cite: 40]
    if (user.tenXWins >= 1 && !user.achievements.includes('Hit 10x')) user.achievements.push('Hit 10x'); [cite: 40]


    await user.save(); [cite: 40, 41]
    return {
        publicKey: user.publicKey,
        username: user.username,
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
    io.emit('spinCountdown', { timeLeft: spinTimer }); [cite: 43]

    if (spinTimer <= 0) {
        if (!isSpinning) {
            isSpinning = true;
            console.log('Spinning started!');
            io.emit('spinCountdown', { timeLeft: 'Spinning...' }); // Update UI to spinning state [cite: 43]

            // Determine winning multiplier [cite: 44]
            const winningMultiplier = getRandomMultiplier(); [cite: 44]
            currentSpinResult = winningMultiplier; [cite: 44]

            // Resolve all bets in the queue [cite: 44, 45]
            const betsOutcome = []; [cite: 45]
            for (const bet of betsQueue) {
                const outcome = await resolveBet(bet, winningMultiplier); [cite: 45]
                betsOutcome.push(outcome); [cite: 45]
            }
            betsQueue = []; // Clear queue for next round [cite: 45]

            // Simulate other players' activity for the leaderboard/chat [cite: 45]
            const mockUsers = await User.find({ publicKey: { $ne: 'mock_guest_user' } }).limit(10); // Get some real users [cite: 45, 46]
            const mockLeaderboard = {
                wager: (await User.find().sort({ totalWagered: -1 }).limit(7)).map(u => ({ username: u.username, totalWagered: u.totalWagered, avatar: u.avatar, publicKey: u.publicKey })), [cite: 46]
                streak: (await User.find().sort({ winStreak: -1 }).limit(7)).map(u => ({ username: u.username, winStreak: u.winStreak, avatar: u.avatar, publicKey: u.publicKey })), [cite: 46, 47]
                '10x': (await User.find().sort({ tenXWins: -1 }).limit(7)).map(u => ({ username: u.username, tenXWins: u.tenXWins, avatar: u.avatar, publicKey: u.publicKey })) [cite: 47]
            };
            const totalUsersOnline = await User.countDocuments(); // Simple count of registered users [cite: 47, 48]

            // Broadcast spin result after animation duration (frontend spinDuration is 5s) [cite: 48]
            setTimeout(() => {
                io.emit('spinResult', {
                    winningMultiplier: winningMultiplier, [cite: 48, 49]
                    betsOutcome: betsOutcome, [cite: 49]
                    newLeaderboard: mockLeaderboard, [cite: 49]
                    newUsersOnline: totalUsersOnline [cite: 49]
                });
                isSpinning = false; [cite: 49]
                spinTimer = 25; // Reset timer for next round [cite: 49, 50]
                console.log(`Spin finished. Result: ${winningMultiplier}. Next spin in ${spinTimer}s.`); [cite: 50]
            }, 5000); // Wait for frontend animation to finish [cite: 50, 51]
        }
    } else {
        spinTimer--; [cite: 51, 52]
    }
}, 1000); // Run every second [cite: 52]

// --- API Routes ---

// 1. Wallet Signature Verification and JWT Issuance
app.post('/api/auth/verify-signature', async (req, res) => {
    const { publicKey, message, signature } = req.body; [cite: 52]

    if (!publicKey || !message || !signature) {
        return res.status(400).json({ message: 'Missing required fields: publicKey, message, signature.' });
    }

    try {
        const decodedMessage = new TextEncoder().encode(atob(message)); // Decode base64 message [cite: 52, 53]
        const signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0)); // Decode base64 signature [cite: 53, 54]

        const pubKey = new PublicKey(publicKey); [cite: 53]
        const verified = nacl.sign.detached.verify(decodedMessage, signatureBytes, pubKey.toBytes()); [cite: 53]

        if (!verified) {
            return res.status(401).json({ message: 'Signature verification failed.' });
        }

        // Find or create user [cite: 53]
        let user = await User.findOne({ publicKey }); [cite: 53]

        if (!user) {
            user = new User({
                publicKey,
                username: publicKey.slice(0, 4) + '...' + publicKey.slice(-4),
                solBalance: 0.01, // Welcome bonus for new users [cite: 54, 55]
                totalWagered: 0, [cite: 54, 55]
                winStreak: 0, [cite: 55]
                tenXWins: 0, [cite: 55]
                achievements: [], [cite: 55]
                dailyBonusDay: 0, [cite: 55]
                lastLoginDate: null [cite: 55]
            });
            await user.save(); [cite: 56]
            console.log(`New user created: ${user.username} with welcome bonus.`); [cite: 56]
        }

        // Check for welcome bonus (only if totalWagered is 0 and it's their first time getting this bonus) [cite: 56]
        // This is handled by the initial user creation above. If user already exists, no welcome bonus here. [cite: 57]

        const token = jwt.sign({ userId: user._id, publicKey: user.publicKey }, JWT_SECRET, { expiresIn: '1d' }); [cite: 57, 58]
        res.json({
            token, [cite: 58]
            user: {
                publicKey: user.publicKey,
                username: user.username,
                avatar: user.avatar,
                solBalance: user.solBalance, [cite: 58, 59]
                totalWagered: user.totalWagered, [cite: 59]
                winStreak: user.winStreak, [cite: 59]
                tenXWins: user.tenXWins, [cite: 59]
                xp: user.xp, [cite: 59]
                level: user.level, [cite: 59]
                achievements: user.achievements, [cite: 59, 60]
                dailyBonusDay: user.dailyBonusDay, [cite: 60]
                lastLoginDate: user.lastLoginDate [cite: 60]
            }
        });
    } catch (error) {
        console.error('Error during signature verification:', error); [cite: 61]
        res.status(500).json({ message: 'Server error during authentication.' }); [cite: 62]
    }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; [cite: 62, 63]
    const token = authHeader && authHeader.split(' ')[1]; [cite: 63]

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' }); [cite: 63, 64]
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token.' });
        }
        req.user = user; // Attach decoded user payload [cite: 64]
        next();
    });
};

// 2. Profile Editing - Update Username
app.post('/api/profile/update-username', authenticateToken, async (req, res) => {
    const { username } = req.body; [cite: 65]
    if (!username || username.length < 3) {
        return res.status(400).json({ message: 'Username must be at least 3 characters.' });
    }

    try {
        const user = await User.findById(req.user.userId); [cite: 65]
        if (!user) {
            return res.status(404).json({ message: 'User not found.' }); [cite: 65, 66]
        }

        user.username = username; [cite: 66]
        await user.save(); [cite: 66]

        // Broadcast username change to all connected clients [cite: 66]
        io.emit('profileUpdate', { publicKey: user.publicKey, username: user.username, avatar: user.avatar }); [cite: 66]

        res.json({
            message: 'Username updated successfully.',
            username: user.username, [cite: 66, 67]
            avatar: user.avatar // Return avatar as well for consistency [cite: 67]
        });
    } catch (error) {
        console.error('Error updating username:', error); [cite: 67, 68]
        res.status(500).json({ message: 'Failed to update username.' }); [cite: 68]
    }
});

// 3. Mock Top Up (for testing purposes, not real SOL)
app.post('/api/mock-top-up', authenticateToken, async (req, res) => {
    const { amount } = req.body; [cite: 68]
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Invalid top-up amount.' });
    }

    try {
        const user = await User.findById(req.user.userId); [cite: 68, 69]
        if (!user) {
            return res.status(404).json({ message: 'User not found.' }); [cite: 69, 70]
        }

        user.solBalance += amount; [cite: 69]
        await user.save(); [cite: 69]

        res.json({
            message: `Successfully topped up ${amount} SOL.`,
            solBalance: user.solBalance
        });
    } catch (error) {
        console.error('Error during mock top-up:', error); [cite: 70]
        res.status(500).json({ message: 'Failed to process mock top-up.' }); [cite: 70]
    }
});
// 4. Claim Daily Bonus [cite: 71]
app.post('/api/claim-daily-bonus', authenticateToken, async (req, res) => {
    const { amount, day } = req.body; [cite: 71]
    if (typeof amount !== 'number' || amount <= 0 || typeof day !== 'number') {
        return res.status(400).json({ message: 'Invalid bonus data.' });
    }

    try {
        const user = await User.findById(req.user.userId); [cite: 71, 72]
        if (!user) {
            return res.status(404).json({ message: 'User not found.' }); [cite: 72]
        }

        const today = new Date().toDateString(); [cite: 72]
        if (user.lastLoginDate && new Date(user.lastLoginDate).toDateString() === today) {
            return res.status(400).json({ message: 'Daily bonus already claimed today.' });
        }

        user.solBalance += amount; [cite: 72]
        user.lastLoginDate = new Date(); [cite: 72]
        user.dailyBonusDay = day; // Sync daily bonus day from frontend [cite: 72, 73, 74]

        if (day === 7) { // Reset after day 7 [cite: 73]
            user.dailyBonusDay = 0; [cite: 73]
        }

        // Check for 'Daily Grinder' achievement [cite: 73]
        if (user.dailyBonusDay >= 5 && !user.achievements.includes('Daily Grinder')) {
            user.achievements.push('Daily Grinder'); [cite: 74]
        }

        await user.save(); [cite: 74, 75]
        res.json({
            message: `Daily bonus of ${amount} SOL claimed!`,
            solBalance: user.solBalance,
            dailyBonusDay: user.dailyBonusDay,
            achievements: user.achievements
        });
    } catch (error) {
        console.error('Error claiming daily bonus:', error); [cite: 76]
        res.status(500).json({ message: 'Failed to claim daily bonus.' }); [cite: 77]
    }
});


// --- Socket.IO Event Handlers ---

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id} (PublicKey: ${socket.publicKey})`);

    // Emit initial state to the newly connected client [cite: 77]
    socket.emit('initialState', {
        spinTimer, [cite: 78]
        isSpinning, [cite: 78]
        user: socket.userData ? {
            publicKey: socket.userData.publicKey,
            username: socket.userData.username,
            avatar: socket.userData.avatar, [cite: 78, 79]
            solBalance: socket.userData.solBalance, [cite: 78, 79]
            totalWagered: socket.userData.totalWagered, [cite: 78, 79]
            winStreak: socket.userData.winStreak, [cite: 78, 79]
            tenXWins: socket.userData.tenXWins, [cite: 78, 79]
            xp: socket.userData.xp, [cite: 78, 79]
            level: socket.userData.level, [cite: 79]
            achievements: socket.userData.achievements, [cite: 79, 80]
            dailyBonusDay: socket.userData.dailyBonusDay, [cite: 79, 80]
            lastLoginDate: socket.userData.lastLoginDate [cite: 79, 80]
        } : null, // Send user data if authenticated [cite: 79]
        recentSpins: [], // Fetch from DB if storing, otherwise empty [cite: 79]
        leaderboard: {}, // Fetch from DB [cite: 79]
        playersOnline: io.engine.clientsCount // Number of connected sockets [cite: 79]
    });
    // Handle 'authenticate' event from frontend (after token is received on client) [cite: 80]
    socket.on('authenticate', async ({ token }) => {
        try {
            const decoded = jwt.verify(token, JWT_SECRET); [cite: 80]
            const user = await User.findById(decoded.userId); [cite: 80]
            if (!user) {
                return socket.emit('authError', 'User not found.'); [cite: 80, 81]
            }
            socket.userId = user._id; [cite: 81]
            socket.publicKey = user.publicKey; [cite: 81]
            socket.userData = user; [cite: 81]
            socket.emit('authenticated', {
                publicKey: user.publicKey,
                username: user.username,
                avatar: user.avatar, [cite: 81, 82]
                solBalance: user.solBalance, [cite: 82]
                totalWagered: user.totalWagered, [cite: 82]
                winStreak: user.winStreak, [cite: 82]
                tenXWins: user.tenXWins, [cite: 82]
                xp: user.xp, [cite: 82, 83]
                level: user.level, [cite: 83]
                achievements: user.achievements, [cite: 83]
                dailyBonusDay: user.dailyBonusDay, [cite: 83]
                lastLoginDate: user.lastLoginDate [cite: 83]
            });
            console.log(`User ${user.username} re-authenticated via Socket.IO.`); [cite: 84]
        } catch (err) {
            socket.emit('authError', 'Invalid or expired token.'); [cite: 84]
            console.error('Socket.IO authentication error:', err); [cite: 85]
        }
    });

    // Handle 'placeBet' event [cite: 85]
    socket.on('placeBet', async (betData) => {
        if (!socket.userData) {
            return socket.emit('betError', 'Not authenticated to place bets.');
        }

        const { amount, multiplier } = betData; [cite: 85]

        // Server-side validation [cite: 86]
        if (typeof amount !== 'number' || amount <= 0 || !multiplier) {
            return socket.emit('betError', 'Invalid bet amount or multiplier.'); [cite: 86]
        }
        // Validate multiplier value
        const allowedMultipliers = ['1.5', '2', '3', '5', '10'];
        if (!allowedMultipliers.includes(multiplier.toString())) {
            return socket.emit('betError', 'Invalid multiplier selected.');
        }
        if (amount > socket.userData.solBalance) {
            return socket.emit('betError', 'Insufficient SOL balance.');
        }
        // Ensure betting window is open (last 3 seconds of timer) [cite: 86]
        if (spinTimer > 3 || isSpinning) {
            return socket.emit('betError', 'Betting is currently closed.'); [cite: 87]
        }

        try {
            // Deduct amount from user's balance immediately [cite: 87]
            socket.userData.solBalance -= amount; [cite: 87]
            await socket.userData.save(); [cite: 87]

            // Add bet to queue [cite: 88]
            betsQueue.push({
                userId: socket.userData._id,
                publicKey: socket.userData.publicKey,
                username: socket.userData.username,
                amount: amount,
                multiplier: multiplier
            });
            // Emit confirmation to all clients (including self) [cite: 89]
            io.emit('betPlacedConfirmation', {
                username: socket.userData.username,
                amount: amount,
                multiplier: multiplier
            });
            // Update client's balance immediately (optional, but good for UX) [cite: 90]
            socket.emit('balanceUpdate', { solBalance: socket.userData.solBalance }); [cite: 90]
            console.log(`${socket.userData.username} placed a bet of ${amount} on ${multiplier}.`); [cite: 91]
        } catch (error) {
            console.error('Error placing bet:', error); [cite: 91]
            socket.emit('betError', 'Failed to place bet due to server error.'); [cite: 92]
        }
    });
    // Handle chat messages [cite: 93]
    socket.on('chatMessage', async (data) => {
        if (!socket.userData) {
            return socket.emit('chatError', 'Not authenticated to chat.');
        }
        const message = data.text.trim(); // Changed from data.message to data.text as per frontend emit
        if (!message) return;

        // Sanitize message (basic example) [cite: 93]
        const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;"); [cite: 93]
        // Add length limit for chat messages
        if (sanitizedMessage.length > 200) { // Example limit
            return socket.emit('chatError', 'Chat message too long.');
        }

        // Save chat message to DB (optional, if you want chat history) [cite: 94]
        // For now, just broadcast
        console.log(`Chat from ${socket.userData.username}: ${sanitizedMessage}`); [cite: 94]
        io.emit('chatMessage', {
            username: socket.userData.username,
            text: sanitizedMessage, // Changed from message to text for consistency with frontend
            reaction: data.reaction || '💬', // Include reaction if provided
            type: 'user' // Explicitly set type to 'user' for client
        });
    });
    // Handle profile updates (e.g., avatar changes - not implemented in frontend yet, but structure is here) [cite: 95]
    socket.on('profileUpdate', async (data) => {
        if (!socket.userData) return;

        // Example: If avatar is updated [cite: 95]
        if (data.avatar && typeof data.avatar === 'string' && data.avatar.length < 5) { // Simple validation [cite: 95]
            socket.userData.avatar = data.avatar; [cite: 95]
            await socket.userData.save(); [cite: 95]

            io.emit('profileUpdate', { publicKey: socket.userData.publicKey, username: socket.userData.username, avatar: socket.userData.avatar }); [cite: 96]
        }
    });
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`); [cite: 97]
        // Update players online count [cite: 97]
        io.emit('playersOnlineUpdate', io.engine.clientsCount); [cite: 97]
    });
});

// --- Leaderboard Update Loop ---
setInterval(async () => {
    try {
        const leaderboard = {
            wager: (await User.find().sort({ totalWagered: -1 }).limit(7)).map(u => ({ username: u.username, totalWagered: u.totalWagered, avatar: u.avatar, publicKey: u.publicKey })), [cite: 98]
            streak: (await User.find().sort({ winStreak: -1 }).limit(7)).map(u => ({ username: u.username, winStreak: u.winStreak, avatar: u.avatar, publicKey: u.publicKey })), [cite: 98]
            '10x': (await User.find().sort({ tenXWins: -1 }).limit(7)).map(u => ({ username: u.username, tenXWins: u.tenXWins, avatar: u.avatar, publicKey: u.publicKey })) [cite: 98, 99]
        };
        io.emit('leaderboardUpdate', leaderboard); [cite: 99]
        io.emit('playersOnlineUpdate', io.engine.clientsCount); // Also send updated player count [cite: 99]
    } catch (error) {
        console.error('Error updating leaderboard:', error); [cite: 99]
    }
}, 15000); // Update every 15 seconds [cite: 100]

// --- Start Server ---
const PORT = process.env.PORT || 3000; [cite: 100]
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`); [cite: 101]
});
