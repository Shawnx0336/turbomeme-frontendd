const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { Connection, PublicKey } = require('@solana/web3.js');
const nacl = require('tweetnacl');
require('dotenv').config();

const connectDB = require('./db');
const User = require('./models/User');
const Bet = require('./models/Bet');

connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:8000';

app.use(cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key';

const io = new Server(server, {
    cors: {
        origin: allowedOrigin,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error: No token provided.'));
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.userId;
        socket.publicKey = decoded.publicKey;
        const user = await User.findOne({ publicKey: socket.publicKey });
        if (!user) return next(new Error('Authentication error: User not found.'));
        socket.userData = user;
        next();
    } catch (err) {
        console.error('JWT verification error:', err);
        next(new Error('Authentication error: Invalid token.'));
    }
});

const solanaConnection = new Connection('https://api.mainnet-beta.solana.com');

let spinTimer = 25;
let isSpinning = false;
let betsQueue = [];
let currentSpinResult = null;

function getRandomMultiplier() {
    const segments = [
        { multiplier: '1.5x', probability: 0.3 },
        { multiplier: '2x', probability: 0.2 },
        { multiplier: '3x', probability: 0.2 },
        { multiplier: '5x', probability: 0.15 },
        { multiplier: '10x', probability: 0.15 }
    ];
    let random = Math.random();
    for (const seg of segments) {
        if (random < seg.probability) return seg.multiplier;
        random -= seg.probability;
    }
    return '1.5x';
}

async function resolveBet(bet, winningMultiplier) {
    const user = await User.findById(bet.userId);
    if (!user) return;

    const betMultiplier = parseFloat(bet.multiplier.replace('x', ''));
    const resultMultiplier = parseFloat(winningMultiplier.replace('x', ''));
    let won = false, winnings = 0;

    if (betMultiplier === resultMultiplier) {
        won = true;
        winnings = bet.amount * betMultiplier;
        user.solBalance += winnings;
        user.winStreak++;
        if (betMultiplier >= 5) user.tenXWins++;
    } else {
        user.winStreak = 0;
    }

    user.totalWagered += bet.amount;
    user.xp += 10;
    if (user.xp >= 100) {
        user.level = (user.level || 1) + 1;
        user.xp -= 100;
    }

    if (user.winStreak >= 3 && !user.achievements.includes('Lucky Streak x3')) user.achievements.push('Lucky Streak x3');
    if (user.totalWagered >= 50 && !user.achievements.includes('High Roller')) user.achievements.push('High Roller');
    if (user.tenXWins >= 1 && !user.achievements.includes('Hit 10x')) user.achievements.push('Hit 10x');

    await user.save();

    return {
        publicKey: user.publicKey,
        username: user.username,
        amount: bet.amount,
        multiplier: bet.multiplier,
        winningMultiplier,
        won,
        winnings,
        solBalance: user.solBalance,
        totalWagered: user.totalWagered,
        winStreak: user.winStreak,
        tenXWins: user.tenXWins,
        xp: user.xp,
        level: user.level,
        achievements: user.achievements
    };
}

setInterval(async () => {
    io.emit('spinCountdown', { timeLeft: spinTimer });

    if (spinTimer <= 0 && !isSpinning) {
        isSpinning = true;
        const result = getRandomMultiplier();
        currentSpinResult = result;
        const outcomes = [];

        for (const bet of betsQueue) {
            const outcome = await resolveBet(bet, result);
            if (outcome) outcomes.push(outcome);
        }

        betsQueue = [];

        const leaderboard = {
            wager: (await User.find().sort({ totalWagered: -1 }).limit(7)).map(u => ({ username: u.username, totalWagered: u.totalWagered })),
            streak: (await User.find().sort({ winStreak: -1 }).limit(7)).map(u => ({ username: u.username, winStreak: u.winStreak })),
            '10x': (await User.find().sort({ tenXWins: -1 }).limit(7)).map(u => ({ username: u.username, tenXWins: u.tenXWins }))
        };

        setTimeout(() => {
            io.emit('spinResult', {
                winningMultiplier: result,
                betsOutcome: outcomes,
                newLeaderboard: leaderboard
            });
            isSpinning = false;
            spinTimer = 25;
        }, 5000);
    } else {
        spinTimer--;
    }
}, 1000);

// --- API Routes ---

app.post('/api/auth/verify-signature', async (req, res) => {
    const { publicKey, message, signature } = req.body;
    if (!publicKey || !message || !signature) return res.status(400).json({ message: 'Missing fields.' });

    try {
        const msg = new TextEncoder().encode(atob(message));
        const sig = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        const pubKey = new PublicKey(publicKey);
        const valid = nacl.sign.detached.verify(msg, sig, pubKey.toBytes());

        if (!valid) return res.status(401).json({ message: 'Invalid signature.' });

        let user = await User.findOne({ publicKey });
        if (!user) {
            user = new User({
                publicKey,
                username: publicKey.slice(0, 4) + '...' + publicKey.slice(-4),
                solBalance: 0.01,
                totalWagered: 0,
                winStreak: 0,
                tenXWins: 0,
                achievements: [],
                xp: 0,
                level: 1
            });
            await user.save();
        }

        const token = jwt.sign({ userId: user._id, publicKey: user.publicKey }, JWT_SECRET, { expiresIn: '1d' });

        return res.json({
            token,
            user: {
                publicKey: user.publicKey,
                username: user.username,
                avatar: user.avatar,
                solBalance: user.solBalance,
                totalWagered: user.totalWagered,
                winStreak: user.winStreak,
                tenXWins: user.tenXWins,
                xp: user.xp,
                level: user.level,
                achievements: user.achievements
            }
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error.' });
    }
});

// --- Socket.IO Events ---

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.emit('initialState', {
        spinTimer,
        isSpinning,
        leaderboard: {},
        playersOnline: io.engine.clientsCount
    });

    socket.on('placeBet', async ({ amount, multiplier }) => {
        if (!socket.userData) return socket.emit('betError', 'Not authenticated.');
        if (typeof amount !== 'number' || amount <= 0 || !multiplier) return;

        if (amount > socket.userData.solBalance) {
            return socket.emit('betError', 'Insufficient funds.');
        }

        if (spinTimer > 3 || isSpinning) {
            return socket.emit('betError', 'Betting closed.');
        }

        try {
            socket.userData.solBalance -= amount;
            await socket.userData.save();
            betsQueue.push({
                userId: socket.userData._id,
                publicKey: socket.userData.publicKey,
                username: socket.userData.username,
                amount,
                multiplier
            });
            io.emit('betPlacedConfirmation', { username: socket.userData.username, amount, multiplier });
            socket.emit('balanceUpdate', { solBalance: socket.userData.solBalance });
        } catch (err) {
            console.error('Bet error:', err);
        }
    });
});

// --- Server Start ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
