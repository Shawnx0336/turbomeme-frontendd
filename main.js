// State Management
let walletBalance = 500;
let tokensEarned = 0;
let currentBet = { multiplier: null, amount: 0 };
let lastInteraction = Date.now();
const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
let firstBetPlaced = false;
let connectedWallet = null;

// Connect Phantom Wallet (with proper deep linking for mobile and desktop popup)
async function connectPhantomWallet() {
    console.log("Attempting Phantom connection...");
    // Assuming playSound and showToast are defined elsewhere in main.js
    // If not, you'll need to define them.
    // Example placeholder for showToast if it's missing:
    // function showToast(message, type) { console.log(`Toast (${type}): ${message}`); }

    playSound('click');
    if (navigator.vibrate) navigator.vibrate(50);

    const connectPhantomBtn = document.getElementById('connectPhantomBtn');
    if (connectPhantomBtn) {
        connectPhantomBtn.textContent = 'Connecting...';
        connectPhantomBtn.disabled = true;
    }

    // Check if Phantom is injected (desktop extension or mobile in-app browser)
    if (window.solana && window.solana.isPhantom) {
        try {
            // Attempt to connect. This will open the popup on desktop.
            // For mobile in-app browser, it should auto-connect if trusted.
            const resp = await window.solana.connect();
            connectedWallet = resp.publicKey.toString();
            document.getElementById("connectWalletBtn").textContent =
                connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
            showToast("Phantom wallet connected!", "success");

            // Update UI for connected state
            document.getElementById('connectWalletBtn').style.display = 'none';
            document.getElementById('placeBetBtn').style.display = 'block';

            // If coming from demo mode, save demo stats before switching
            if (isGuestMode) {
                localStorage.setItem('solroulette_guest_balance', walletBalance);
                localStorage.setItem('solroulette_guest_xp', xp);
                localStorage.setItem('solroulette_guest_tokens', tokensEarned);
                localStorage.setItem('solroulette_guest_total_wagered', totalWagered);
                localStorage.setItem('solroulette_guest_win_streak', winStreak);
                localStorage.setItem('solroulette_guest_ten_x_wins', tenXWins);
                localStorage.setItem('solroulette_guest_achievements', JSON.stringify([...achievementsUnlocked]));
                localStorage.setItem('solroulette_guest_spin_count', guestSpinCount); // Save guest spin count
                localStorage.setItem('solroulette_fake_winnings_total', fakeWinningsTotal); // Save demo winnings
            }

            isGuestMode = false; // Exit demo mode on real wallet connection
            localStorage.setItem('solroulette_is_guest', 'false');
            localStorage.setItem('solroulette_wallet', connectedWallet); // Store wallet address
            user.wallet = connectedWallet; // Update user object
            user.name = connectedWallet.slice(0, 4) + '...' + connectedWallet.slice(-4);
            localStorage.setItem('solroulette_user_name', user.name);

            // Mock balance for new connection if not already set, otherwise load existing real balance
            if (parseFloat(localStorage.getItem('solroulette_wallet_balance') || '0') === 0) {
                 walletBalance = 500; // Example initial balance for new real wallet connection
                 localStorage.setItem('solroulette_wallet_balance', walletBalance);
            } else {
                 walletBalance = parseFloat(localStorage.getItem('solroulette_wallet_balance'));
            }

            // Load other real user data or initialize if first time connecting
            xp = parseInt(localStorage.getItem('solroulette_xp') || '0');
            level = parseInt(localStorage.getItem('solroulette_level') || '1');
            tokensEarned = parseFloat(localStorage.getItem('solroulette_spin_tokens') || '0');
            totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered') || '0');
            winStreak = parseInt(localStorage.getItem('solroulette_win_streak') || '0');
            tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins') || '0');
            achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements') || '[]'));

            firstRealBetPlaced = true;
            localStorage.setItem('solroulette_first_real_bet_placed', 'true');

            updateUIDebounced();
            addChatMessage('System', `${user.name} joined the game!`, '🤝', 'system');
            closeWalletModal();
            checkDailyBonus();
            showMessageBox('Welcome Back!', 'Your real wallet is now live.');
            stopAutoDemo();

        } catch (err) {
            console.error("Phantom connect error:", err);
            showToast("Wallet connection cancelled", "error");
            if (connectPhantomBtn) {
                connectPhantomBtn.textContent = 'Connect Phantom';
                connectPhantomBtn.disabled = false;
            }
        }
    } else {
        // Phantom not detected.
        const dappUrl = encodeURIComponent(window.location.href); // Use current site URL
        const phantomDeepLink = `phantom://browse/${dappUrl}`;

        // Check if on a mobile device to use deep link
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            // For mobile, try deep link
            window.location.href = phantomDeepLink;
            // No need for a toast here, as the deep link will either open the app or redirect to download.
            // The user will be taken away from the page.
        } else {
            // For desktop, Phantom extension not found. Prompt user to install.
            showMessageBox(
                'Phantom Wallet Not Found',
                'Please install the Phantom browser extension to connect your wallet. After installation, refresh this page.'
            );
        }

        if (connectPhantomBtn) {
            connectPhantomBtn.textContent = 'Connect Phantom';
            connectPhantomBtn.disabled = false;
        }
    }
}

// Auto-reconnect on load
window.addEventListener("load", async () => {
    // A small delay to ensure window.solana is injected by the extension/in-app browser
    setTimeout(async () => {
        if (window.solana && window.solana.isPhantom) {
            try {
                // Attempt to auto-connect without user interaction.
                // This is crucial for mobile in-app browser and trusted desktop connections.
                const res = await window.solana.connect({ onlyIfTrusted: true });
                connectedWallet = res.publicKey.toString();

                // Update UI to show connected wallet
                document.getElementById("connectWalletBtn").textContent =
                    connectedWallet.slice(0, 4) + "..." + connectedWallet.slice(-4);
                showToast("Wallet auto-connected", "success");

                // Update internal state and UI for connected user
                document.getElementById('connectWalletBtn').style.display = 'none';
                document.getElementById('placeBetBtn').style.display = 'block';
                isGuestMode = false;
                localStorage.setItem('solroulette_is_guest', 'false');
                localStorage.setItem('solroulette_wallet', connectedWallet);
                user.wallet = connectedWallet;
                user.name = connectedWallet.slice(0, 4) + '...' + connectedWallet.slice(-4);
                localStorage.setItem('solroulette_user_name', user.name);

                // Load real balance if available, otherwise default to 500
                walletBalance = parseFloat(localStorage.getItem('solroulette_wallet_balance') || '500');
                // Ensure other user stats are loaded/initialized
                xp = parseInt(localStorage.getItem('solroulette_xp') || '0');
                level = parseInt(localStorage.getItem('solroulette_level') || '1');
                tokensEarned = parseFloat(localStorage.getItem('solroulette_spin_tokens') || '0');
                totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered') || '0');
                winStreak = parseInt(localStorage.getItem('solroulette_win_streak') || '0');
                tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins') || '0');
                achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements') || '[]'));
                firstRealBetPlaced = true;
                localStorage.setItem('solroulette_first_real_bet_placed', 'true');

                updateUIDebounced();
                checkDailyBonus();
                stopAutoDemo(); // Stop auto demo if auto-connected

            } catch (err) {
                // This catch block handles cases where auto-connect fails (e.g., user denied auto-connect, or not yet connected)
                console.warn("Not yet connected or auto-connect denied:", err);
                // Keep the "Connect Wallet" button visible and enabled
                document.getElementById('connectWalletBtn').style.display = 'block';
                document.getElementById('placeBetBtn').style.display = 'none';
                // Ensure guest mode is active if no wallet is connected
                if (!user.wallet) {
                    isGuestMode = true;
                    localStorage.setItem('solroulette_is_guest', 'true');
                    // Ensure walletBalance is set for guest mode if not already
                    if (parseFloat(localStorage.getItem('solroulette_guest_balance') || '0') === 0) {
                        walletBalance = 500;
                        localStorage.setItem('solroulette_guest_balance', walletBalance);
                    } else {
                        walletBalance = parseFloat(localStorage.getItem('solroulette_guest_balance'));
                    }
                    user.name = 'Guest';
                    user.avatar = '👋';
                    localStorage.setItem('solroulette_user_name', user.name);
                    localStorage.setItem('solroulette_user_avatar', user.avatar);
                }
                updateUIDebounced(); // Update UI to reflect guest/disconnected state
            }
        } else {
            // Phantom not detected on load. Ensure UI reflects disconnected/guest state.
            console.warn("Phantom not detected on load.");
            document.getElementById('connectWalletBtn').style.display = 'block';
            document.getElementById('placeBetBtn').style.display = 'none';
            // Ensure guest mode is active if no wallet is connected
            if (!user.wallet) {
                isGuestMode = true;
                localStorage.setItem('solroulette_is_guest', 'true');
                if (parseFloat(localStorage.getItem('solroulette_guest_balance') || '0') === 0) {
                    walletBalance = 500;
                    localStorage.setItem('solroulette_guest_balance', walletBalance);
                } else {
                    walletBalance = parseFloat(localStorage.getItem('solroulette_guest_balance'));
                }
                user.name = 'Guest';
                user.avatar = '👋';
                localStorage.setItem('solroulette_user_name', user.name);
                localStorage.setItem('solroulette_user_avatar', user.avatar);
            }
            updateUIDebounced(); // Update UI to reflect guest/disconnected state
        }
    }, 2000); // Give a bit more time for injection - INCREASED FROM 500ms TO 2000ms
});


// Open Wallet Modal
function openWalletModal() {
    playSound('click');
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('walletModal').classList.add('visible');
    resetIdleTimer(); // Reset idle timer on modal open
    stopAutoDemo(); // Stop auto demo on modal open
}

// Close Wallet Modal
function closeWalletModal() {
    playSound('click');
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('walletModal').classList.remove('visible');
    resetIdleTimer(); // Reset idle timer on modal close
}

// DOM Loaded Hook
document.addEventListener("DOMContentLoaded", () => {
    // The main "Connect Wallet" button in the header should open the modal
    const connectBtn = document.getElementById("connectWalletBtn");
    if (connectBtn) {
        connectBtn.addEventListener("click", openWalletModal);
    }

    // The "Connect Phantom" button inside the modal should trigger the actual connection
    const connectPhantomBtn = document.getElementById("connectPhantomBtn");
    if (connectPhantomBtn) {
        connectPhantomBtn.addEventListener("click", connectPhantomWallet);
    }
});


// --- Existing functions from your main.js (kept as is, assuming they work) ---
// State Management variables are defined at the top of the file
// let walletBalance = 500;
// let tokensEarned = 0;
// let currentBet = { multiplier: null, amount: 0 };
// let lastInteraction = Date.now();
// const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
// let firstBetPlaced = false;
// let connectedWallet = null;

// User Profile (part of state management)
let user = {
    wallet: localStorage.getItem('solroulette_wallet') || null, // Load wallet from localStorage
    name: localStorage.getItem('solroulette_user_name') || 'Guest', // Load name
    avatar: localStorage.getItem('solroulette_user_avatar') || '😎', // Load avatar
    referral: localStorage.getItem('solroulette_referral_code') || generateReferralCode(), // Load or generate referral code
};

// Daily Bonus State
let lastLoginDate = localStorage.getItem(isGuestMode ? 'solroulette_guest_last_login' : 'solroulette_last_login') || null;
let dailyBonusDay = parseInt(localStorage.getItem(isGuestMode ? 'solroulette_guest_daily_bonus_day' : 'solroulette_daily_bonus_day') || '0');
let dailyRewardClaimedToday = localStorage.getItem('solroulette_daily_reward_claimed') === new Date().toDateString(); // Track daily reward claim

// Idle Timer State
let idleTimer = null;
const IDLE_TIMEOUT = 120000; // 2 minutes in milliseconds

// Auto Demo State
let isAutoDemo = false;
let autoDemoTimer = null;
const AUTO_DEMO_INTERVAL = 25000; // Spin every 25 seconds in auto demo

// Dev Flags
window.autoRefill = false; // Set to true in browser console for auto-refill testing

// Audio Effects (Lazy Loading)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const sounds = {};

// Implement try...catch for sound loading
async function loadSound(name, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
             console.warn(`Failed to fetch sound ${name} from ${url}: ${response.status}`);
             return; // Exit if fetch fails
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        sounds[name] = audioBuffer;
    } catch (e) {
        console.error(`Error loading sound ${name} from ${url}:`, e);
        // Fallback or silent failure for now due to CORS or other issues
    }
}

function playSound(name, volume = 1.0, loop = false) {
    // Ensure audio context is resumed after user interaction
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.error("AudioContext resume failed:", e));
    }

    const audioBuffer = sounds[name];
    // Check if the audio buffer exists before trying to play
    if (!audioBuffer || !audioContext || audioContext.state === 'suspended') {
        // console.warn(`Sound "${name}" not loaded, audio context not available, or suspended.`);
        return; // Exit the function if sound is not available or context is suspended
    }

    try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.value = volume;

        source.connect(gainNode).connect(audioContext.destination);
        source.loop = loop;
        source.start(0);
        return source; // Return source to stop looping sounds later
    } catch (e) {
        console.error(`Error playing sound ${name}:`, e);
        return null; // Return null if playing fails
    }
}

// Preload sounds
loadSound('click', 'https://www.soundjay.com/buttons/button-1.wav'); // Example click sound
loadSound('tick', 'https://www.soundjay.com/mechanical/tick-tock-2.wav'); // Example tick sound
loadSound('whoosh', 'https://www.soundjay.com/transport/train-whoosh-2.wav'); // Example whoosh sound
loadSound('clank', 'https://www.soundjay.com/mechanical/clank-gong-1.wav'); // Example clank sound
loadSound('fanfare', 'https://www.soundjay.com/human/fanfare-1.wav'); // Example fanfare sound
loadSound('sad_trombone', 'https://www.soundjay.com/human/sad-trombone-1.wav'); // Example sad trombone sound
loadSound('win', 'https://www.soundjay.com/human/applause-2.wav'); // Example general win sound
loadSound('win_10x', 'https://www.soundjay.com/misc/magic-chime-1.wav'); // Example 10x win sound

let currentTickSound = null; // To control the looping tick sound

// Debounce function
function debounce(func, delay) {
    let inDebounce;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(inDebounce);
        inDebounce = setTimeout(() => func.apply(context, args), delay);
    }
}

const updateUIDebounced = debounce(updateUI, 50); // Debounce updateUI calls

// Canvas Wheel Drawing
const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');
const segments = [
    { multiplier: '1.5x', color: '--success', probability: 0.3 },
    { multiplier: '2x', color: '--primary', probability: 0.2 },
    { multiplier: '3x', color: '--accent', probability: 0.2 },
    { multiplier: '5x', color: '--success', probability: 0.15 }, // Keeping same as success for visual variety
    { multiplier: '10x', color: '--danger', probability: 0.15 } // Lower chance for 10x
];
const totalProbability = segments.reduce((sum, seg) => sum + seg.probability, 0);
// Calculate angles based on probability
let startAngle = 0;
segments.forEach(segment => {
    segment.startAngle = startAngle;
    segment.endAngle = startAngle + (segment.probability / totalProbability) * 2 * Math.PI;
    segment.middleAngle = segment.startAngle + (segment.endAngle - segment.startAngle) / 2;
    startAngle = segment.endAngle;
});

let currentWheelRotation = 0;
let spinAnimationId = null;
let spinStartTime = null;
let spinDuration = 5000; // 5 seconds
let targetRotation = 0;
let isNearMiss = false;

function drawWheel() {
    const size = Math.min(canvas.width, canvas.height);
    const centerX = size / 2;
    const centerY = size / 2;
    // Ensure radius is not negative
    const radius = Math.max(0, size / 2 - 12); // Account for border, ensure non-negative

    ctx.clearRect(0, 0, size, size);

    // Only attempt to draw if the radius is positive
    if (radius > 0) {
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(currentWheelRotation);

        segments.forEach(segment => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, segment.startAngle, segment.endAngle);
            ctx.closePath();
            // Correctly get CSS variable value
            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(segment.color).trim();
            ctx.fill();

            // Draw text
            ctx.save();
            // Rotate to the middle of the segment
            ctx.rotate(segment.middleAngle);
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 24px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Position text away from the center
            const textRadius = radius * 0.7;
            ctx.fillText(segment.multiplier, textRadius, 0);
            ctx.restore();
        });

        ctx.restore();

        // Draw metallic texture effect (simple overlay)
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Subtle white overlay
        ctx.globalCompositeOperation = 'overlay'; // Blend mode
        ctx.fill();
        ctx.restore();

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.3, 0, 2 * Math.PI);
        ctx.fillStyle = '#222';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#444';
        ctx.stroke();

        // Draw center text
         // Correctly get CSS variable value
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        ctx.font = 'bold 20px "Press Start 2P", cursive'; // Arcade font for center
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SPIN', centerX, centerY);
    } else {
         // Optionally draw a placeholder or message if canvas is too small
         ctx.fillStyle = '#555';
         ctx.font = '12px "Inter", sans-serif';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText('Canvas too small', centerX, centerY);
    }
}

function animateWheel(timestamp) {
    if (!spinStartTime) spinStartTime = timestamp;
    const elapsed = timestamp - spinStartTime;
    const progress = Math.min(elapsed / spinDuration, 1);

    // Easing function (cubic-bezier for spin)
    // This needs to match the CSS transition for the visual pointer effect
    // A simple cubic-bezier(0.25, 0.1, 0.25, 1) can be approximated
    const easedProgress = 1 - Math.pow(1 - progress, 3); // Simple ease-out

    // Calculate rotation based on progress
    // Start fast, slow down towards the end
    // We need to rotate from current position to targetRotation
    // For near-miss, the targetRotation will be adjusted during the spin

    let currentTargetRotation = targetRotation;
     // Apply near-miss fakeout during the last part of the spin
    if (isNearMiss && progress > 0.7 && progress < 0.95) {
         // Calculate target rotation for 10x (with 'x' for the function)
         const nearMissTarget = calculateCanvasTargetRotation('10x') + (Math.random() * 20 - 10); // Aim slightly past 10x
         const nearMissProgress = (progress - 0.7) / (0.95 - 0.7); // Progress within the fakeout phase
         currentTargetRotation = targetRotation + (nearMissTarget - targetRotation) * Math.sin(nearMissProgress * Math.PI / 2); // Ease into near miss
    }


    currentWheelRotation = currentTargetRotation * easedProgress;


    drawWheel();

    if (progress < 1) {
        spinAnimationId = requestAnimationFrame(animateWheel);
    } else {
        // Animation finished
        isSpinning = false;
        spinStartTime = null;
        // Snap to the final target position to avoid floating point issues
        currentWheelRotation = targetRotation;
        drawWheel();
        handleSpinResult(); // Process results after animation
    }
}

 // Function to calculate target rotation for canvas
 // This function maps the winning multiplier (string with 'x') to a rotation angle
 function calculateCanvasTargetRotation(winningMultiplierString) {
     const segment = segments.find(seg => seg.multiplier === winningMultiplierString);
     if (!segment) return 0;

     // We want the pointer to land on the middle of the segment
     // The canvas is rotated, so we need to find the rotation value
     // that brings the segment's middle angle to the pointer position (which is at the top, 0 degrees relative to the container)

     // The pointer is at the top (0 degrees relative to the container).
     // The canvas is rotated. We want the segment's middleAngle to align with the top.
     // If the segment's middle angle is M, we need to rotate the canvas by -M
     // However, the canvas drawing starts at 0 degrees to the right (standard canvas arc).
     // Our segments are defined starting from 0 degrees to the right.
     // The pointer is at the top, which is -PI/2 radians or -90 degrees.

     // So, we need to rotate the wheel such that the middle of the winning segment
     // aligns with the pointer's position (-90 degrees).

     const pointerAngle = -Math.PI / 2; // Pointer is at the top (in radians)
     const segmentMiddleAngle = segment.middleAngle; // Middle of the winning segment (in radians)

     // The rotation needed is the difference between the pointer angle and the segment's middle angle.
     // We need to add full rotations to make it spin multiple times.
     const fullRotations = 5; // Spin at least 5 full times
     const rotationInRadians = (pointerAngle - segmentMiddleAngle) + (fullRotations * 2 * Math.PI);

     return rotationInRadians;
 }


// Update Timer
function updateTimer() {
    const timerElement = document.getElementById('globalTimer');
    const pointerElement = document.getElementById('pointer');
    const preSpinCtaElement = document.getElementById('preSpinCta');
    const rouletteCanvas = document.getElementById('rouletteCanvas');

    // Add console log to check currentBet.multiplier in updateTimer
    console.log('updateTimer running. currentBet.multiplier:', currentBet.multiplier);


    if (isSpinning) {
         timerElement.textContent = `✨ Spinning...`;
         timerElement.style.background = 'linear-gradient(45deg, var(--accent), var(--primary))';
         timerElement.classList.remove('urgent');
         pointerElement.classList.remove('pulse'); // Stop pointer pulse
         document.getElementById('backgroundOverlay').classList.add('intensify-particles'); // Intensify particles
         if (currentTickSound) {
             currentTickSound.stop(); // Stop tick sound when spinning starts
             currentTickSound = null;
         }
         document.getElementById('strobeOverlay').classList.add('active'); // Activate strobe
         preSpinCtaElement.textContent = 'Bets closed. Spinning now...'; // Update CTA

         // Disable Spin Again button during spin
         document.getElementById('resultModalSpinAgainBtn').disabled = true;
         rouletteCanvas.classList.remove('countdown-glow'); // Remove glow while spinning

         return;
    }

    document.getElementById('strobeOverlay').classList.remove('active'); // Deactivate strobe
    document.getElementById('backgroundOverlay').classList.remove('intensify-particles'); // De-intensify particles

    // Enable Spin Again button if betting is allowed
    if (!isSpinning && spinTimer > 3) {
         document.getElementById('resultModalSpinAgainBtn').disabled = false;
    }


    timerElement.textContent = `⏳ Next Spin: ${spinTimer}s`;
    timerElement.style.background = 'linear-gradient(45deg, var(--danger), var(--primary))';
     timerElement.classList.remove('urgent'); // Remove urgent class initially
     pointerElement.classList.remove('pulse'); // Stop pointer pulse
     rouletteCanvas.classList.remove('countdown-glow'); // Remove glow unless countdown is low


    if (spinTimer <= 10 && spinTimer > 0) {
         timerElement.classList.add('urgent'); // Add urgent class for faster pulse and red gradient
         // Play tick sound only if not already playing
         if (!currentTickSound) {
            currentTickSound = playSound('tick', 0.5, true); // Play tick sound on loop
         }
         // Increase pitch as timer nears 0 (mock pitch increase)
         if (currentTickSound && audioContext && currentTickSound.playbackRate) { // Check playbackRate exists
             const pitch = 1 + (10 - spinTimer) * 0.05; // Increase pitch by 0.05 for each second closer to 0
             currentTickSound.playbackRate.setValueAtTime(pitch, audioContext.currentTime);
         }
        if (spinTimer <= 5) {
            preSpinCtaElement.textContent = `${spinTimer}s left...`; // Update CTA
        } else {
             preSpinCtaElement.textContent = 'Place your bets...'; // Default CTA
        }
         // Add glow to wheel during countdown
         rouletteCanvas.classList.add('countdown-glow');


    } else {
         if (currentTickSound) {
             currentTickSound.stop(); // Stop tick sound when timer is above 10 or is 0
             currentTickSound = null;
         }
         preSpinCtaElement.textContent = 'Place your bets...'; // Default CTA
         rouletteCanvas.classList.remove('countdown-glow'); // Remove glow if timer is high or zero
    }

     // Pulse pointer when timer is <= 3s
     if (spinTimer <= 3 && spinTimer > 0) {
         pointerElement.classList.add('pulse');
     } else {
         pointerElement.classList.remove('pulse');
     }


    if (spinTimer <= 0) {
        // Betting closes 3 seconds before spin
        if (!isSpinning) { // Only spin if not already spinning
             spinWheel();
        }
        spinTimer = 25; // Reset timer
        playerBets = []; // Clear bets for the new round
        // Clear bet feed UI (now inside live panel)
        document.getElementById('liveBetsContent').innerHTML = ''; // Clear existing bet entries
        // simulateMultiplayer(); // Simulate new bets for the next round - now handled by interval
    } else {
        spinTimer--;
    }
    // Removed resetting currentBet here
    // currentBet.multiplier = null;
    // currentBet.amount = 0;
    updateUIDebounced(); // Update UI elements that depend on the timer state
}

// Simulate Multiplayer (placing bets for the next round)
function simulateMultiplayer() {
    // Only simulate if not spinning or in auto demo (auto demo handles its own bets)
    if (isSpinning || spinTimer <= 3 || isAutoDemo) return;

    playersOnline += Math.floor(Math.random() * 10 - 5);
    document.getElementById('playersOnline').textContent = playersOnline;

    const fakeUsers = ['SolDegen', 'CryptoChad', 'MoonApe', 'WheelMaster', 'LuckyLuke', 'GambaGuy', 'AnonBets', 'SolSpinner', 'DeFiKing', 'NFTCollector'];
    const multipliers = ['1.5', '2', '3', '5', '10']; // Use numeric strings

    // Simulate fake bets
    if (Math.random() < 0.7) { // 70% chance to add a fake bet
         const newBet = {
            user: fakeUsers[Math.floor(Math.random() * fakeUsers.length)],
            amount: parseFloat((Math.random() * 5).toFixed(2)),
            multiplier: multipliers[Math.floor(Math.random() * multipliers.length)] // Store as numeric string
         };
         // Add to the UI feed immediately to show active bets
         addBetEntry(`@${newBet.user}`, newBet.amount, newBet.multiplier); // Pass amount as number
    }

    // Simulate fake chat messages
    if (Math.random() < 0.5) { // 50% chance to add a fake message
        const fakeMessages = ['Gonna hit 10x this round! 🚀', 'Feeling lucky today!', 'Any big bettors out there?', 'Let\'s gooo!', 'Hope I don\'t bust 😭', 'What multiplier are you guys on?', 'Spin it!', 'To the moon! 🌕', 'Wen 10x?', 'This wheel is rigged! 😉'];
        addChatMessage(fakeUsers[Math.floor(Math.random() * fakeUsers.length)], fakeMessages[Math.floor(Math.random() * fakeMessages.length)], '💬', 'user');
    }

    // Simulate leaderboard updates periodically
    // updateLeaderboard(); // Now called by its own interval

    // Update fake activity banner
    updateFakeActivityBanner();
}

 // Update Fake Activity Banner
 function updateFakeActivityBanner() {
     const watchers = Math.floor(Math.random() * 50) + 20; // 20-70 watchers
     const betting10x = Math.floor(Math.random() * 10); // 0-10 betting 10x
     const winsHit = Math.floor(Math.random() * 5); // 0-5 wins

     document.getElementById('activityWatchers').textContent = `🎯 ${watchers} watching`;
     document.getElementById('activityBetting').textContent = `${betting10x} betting 10x`;
     document.getElementById('activityWins').textContent = `${winsHit} wins just hit!`;
 }

 // Show 10x Hit Banner (Fake)
 function showTenXHitBanner() {
     const banner = document.getElementById('tenXHitBanner');
     banner.style.display = 'block';
     playSound('win_10x'); // Play a sound effect
     setTimeout(() => {
         banner.style.display = 'none';
     }, 3000); // Hide after 3 seconds
 }


// Add Bet Entry to Feed
function addBetEntry(user, amount, multiplier) {
    const feed = document.getElementById('liveBetsContent'); // Append to liveBetsContent
    const entry = document.createElement('div');
    entry.className = 'bet-entry';
    // Display multiplier with 'x' in the feed
    entry.innerHTML = `<i class="fas fa-dice"></i> <span class="user">${user}</span> bet <span class="amount">◎${amount.toFixed(2)}</span> on <span class="multiplier">${multiplier}x</span>`;
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight; // Auto-scroll to bottom

     // Show unread dot if live panel is closed
     const livePanelContainer = document.getElementById('livePanelContainer');
     // Check if the panel is NOT active (i.e., closed)
     if (!livePanelContainer.classList.contains('active')) {
         document.getElementById('livePanelUnreadDot').style.display = 'block';
         document.getElementById('betsUnreadDot').style.display = 'block';
     }
}

// Add Chat Message to Feed
function addChatMessage(user, text, reaction, type) { // Added type parameter
    const chatFeed = document.getElementById('chatFeed'); // Use chatFeed div
    const msg = document.createElement('div');
    msg.className = 'chat-message';
    const userClass = type === 'system' ? 'system' : 'user';
    msg.innerHTML = `<i class="fas ${type === 'system' ? 'fa-robot' : 'fa-user'}"></i> <span class="${userClass}">${user}:</span> ${text} <span class="reaction">${reaction}</span>`;
    chatFeed.appendChild(msg); // Append to chatFeed
    chatFeed.scrollTop = chatFeed.scrollHeight; // Auto-scroll to bottom

    // Show unread dot if live panel is closed or on bets tab
    const livePanelContainer = document.getElementById('livePanelContainer');
    const chatTab = document.querySelector('.live-panel-tab[data-tab="chat"]');
    // Check if the panel is NOT active OR if the chat tab is NOT active
    if (!livePanelContainer.classList.contains('active') || !chatTab.classList.contains('active')) {
        document.getElementById('livePanelUnreadDot').style.display = 'block';
        document.getElementById('chatUnreadDot').style.display = 'block';
    }
}

// Send Chat
function sendChat() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    // Handle /tip command (mock)
    if (text.startsWith('/tip ')) {
         const parts = text.split(' ');
         if (parts.length === 3) {
             const targetUser = parts[1];
             const tipAmount = parseFloat(parts[2]);
             if (!isNaN(tipAmount) && tipAmount > 0 && tokensEarned >= tipAmount && !isGuestMode) { // Cannot tip in guest mode
                 tokensEarned -= tipAmount;
                 localStorage.setItem('solroulette_spin_tokens', tokensEarned);
                 addChatMessage('System', `${user.name} tipped ${targetUser} ${tipAmount.toFixed(3)} $SPIN!`, '💸', 'system');
                 updateUIDebounced();
             } else if (isGuestMode) {
                 showMessageBox('Demo Mode Limitation', 'Connect your wallet to tip $SPIN.');
             }
             else {
                 showMessageBox('Tip Failed', 'Invalid tip amount or insufficient $SPIN.');
             }
         } else {
             showMessageBox('Invalid Command', 'Usage: /tip [username] [amount]');
         }
    } else {
        addChatMessage(user.name, text, '🚀', 'user'); // Use 'user' type
        xp += 5; // Earn XP for chatting
        checkAchievements();
        updateUIDebounced();
    }

    input.value = '';
    resetIdleTimer(); // Reset idle timer on chat
    stopAutoDemo(); // Stop auto demo on chat interaction
}

// Place Bet
function placeBet() {
     // Add console log at the beginning of placeBet
     console.log("Placing bet with:", currentBet);

    // Play bet confirmation sound
    playSound('click');
    if (navigator.vibrate) navigator.vibrate(80); // Haptic feedback on spin start

    // Null Bet Bug - Check for multiplier and amount > 0
    if (currentBet.multiplier === null || currentBet.amount <= 0) {
        showMessageBox('Invalid Bet', 'Please select a multiplier and enter a bet amount greater than 0.');
         if (navigator.vibrate) navigator.vibrate(200);
        return; // Prevent placing bet if conditions not met
    }


    const amount = currentBet.amount; // Use currentBet.amount which is already set by slider input

    // Demo SOL Deduction & Refill Modal
    // Auto Refill Demo SOL if balance is too low in guest mode
    if (isGuestMode && walletBalance < amount) {
         if (window.autoRefill) { // Check autoRefill flag
             refillFakeSol(); // Auto refill
             // Now check if the bet is possible after refill
             if (walletBalance < amount) {
                 showMessageBox('Insufficient Balance', 'Insufficient SOL balance even after refill!');
                 if (navigator.vibrate) navigator.vibrate(200);
                 return;
             }
         } else { // Manual refill needed
             openRefillFakeSolModal();
             return; // Prevent placing bet if balance is too low
         }
    }


    if (walletBalance < amount) {
        // This case should be caught by the previous guest mode check,
        // but keep as a fallback for real wallet mode.
        showMessageBox('Insufficient Balance', 'Insufficient SOL balance!');
         if (navigator.vibrate) navigator.vibrate(200);
        return;
    }
    if (isSpinning || spinTimer <= 3) {
        showMessageBox('Betting Closed', 'Betting is closed for this round!');
         if (navigator.vibrate) navigator.vibrate(200);
        return;
    }

    // Add console log before pushing bet
    console.log('Pushing bet with multiplier:', currentBet.multiplier, 'and amount:', currentBet.amount);

    // Deduct bet amount immediately
    walletBalance -= amount;
    totalWagered += amount;
    // currentBet.amount is already set

    // Add user's bet to the list of bets for the current round
    // Store multiplier as numeric string
    playerBets.push({ user: user.name, amount, multiplier: currentBet.multiplier, isUser: true }); // Store numeric string

    // Add user's bet to the live feed
    // Pass multiplier as numeric string to addBetEntry
    addBetEntry('You', amount, currentBet.multiplier); // Pass amount as number

    xp += 10; // Earn XP for placing a bet
    checkAchievements();
    updateUIDebounced(); // Update UI to show deducted balance and XP


    // Disable bet controls until next round starts
    document.getElementById('placeBetBtn').disabled = true;
    document.getElementById('placeBetBtn').textContent = 'Bet Placed!';
    document.querySelectorAll('.multiplier-btn').forEach(btn => {
         btn.disabled = true;
         btn.title = 'Betting is closed'; // Update tooltip
    });
    document.getElementById('betSlider').disabled = true;
     document.getElementById('betSlider').title = 'Betting is closed'; // Update tooltip

     // Dismiss onboarding tooltip/glow if active
     dismissOnboarding();


    // Show mock transaction feedback (only for real wallet, or maybe simulate for guest?)
    if (!isGuestMode) {
         addChatMessage('System', `Transaction sent: ◎${amount.toFixed(2)} on ${currentBet.multiplier}x!`, '✅', 'system'); // Display with 'x'
         // Mark that a real bet is now possible/wallet is connected
         firstRealBetPlaced = true;
         localStorage.setItem('solroulette_first_real_bet_placed', 'true');
         stopAutoDemo(); // Stop auto demo on first real bet
     } else {
         addChatMessage('System', `Demo transaction sent: ◎${amount.toFixed(2)} on ${currentBet.multiplier}x!`, '✅', 'system'); // Display with 'x'
     }


    // Save state to localStorage based on mode
    if (isGuestMode) {
         localStorage.setItem('solroulette_guest_balance', walletBalance);
         localStorage.setItem('solroulette_guest_xp', xp);
         localStorage.setItem('solroulette_guest_tokens', tokensEarned);
         localStorage.setItem('solroulette_guest_total_wagered', totalWagered);
         localStorage.setItem('solroulette_guest_win_streak', winStreak);
         localStorage.setItem('solroulette_guest_ten_x_wins', tenXWins);
         localStorage.setItem('solroulette_guest_achievements', JSON.stringify([...achievementsUnlocked]));
         guestSpinCount++; // Increment guest spin count
         localStorage.setItem('solroulette_guest_spin_count', guestSpinCount);
         localStorage.setItem('solroulette_fake_winnings_total', fakeWinningsTotal); // Save demo winnings
     } else {
         localStorage.setItem('solroulette_wallet_balance', walletBalance); // Save balance
         localStorage.setItem('solroulette_total_wagered', totalWagered);
         localStorage.setItem('solroulette_xp', xp);
         localStorage.setItem('solroulette_level', level);
         localStorage.setItem('solroulette_spin_tokens', tokensEarned);
         localStorage.setItem('solroulette_win_streak', winStreak);
         localStorage.setItem('solroulette_ten_x_wins', tenXWins);
         localStorage.setItem('solroulette_achievements', JSON.stringify([...achievementsUnlocked]));
         localStorage.setItem('solroulette_wallet', user.wallet);
         localStorage.setItem('solroulette_user_name', user.name);
         localStorage.setItem('solroulette_user_avatar', user.avatar);
     }
     localStorage.setItem('solroulette_is_guest', isGuestMode); // Save guest mode status
     localStorage.setItem('solroulette_first_real_bet_placed', firstRealBetPlaced); // Save real bet flag
     // Clear current bet state in localStorage
     localStorage.removeItem('solroulette_current_multiplier');
     localStorage.removeItem('solroulette_current_amount');
     localStorage.setItem('solroulette_last_spin_result', lastSpinResult); // Save the actual result string


    // Start the spin animation immediately after placing the bet
    spinWheel();
    resetIdleTimer(); // Reset idle timer on spin
    // Auto demo is stopped when placeBet is called
}

 // Function to handle the result of the spin
 function handleSpinResult() {
     let userWinAmount = 0;
     let userLostAmount = 0; // Track lost amount for result modal
     let userWon = false;
     // The winningMultiplier is already determined in spinWheel() and stored in lastSpinResult
     // Use lastSpinResult (string with 'x')
     let winningMultiplierString = lastSpinResult; // e.g., '2x'
     // Use currentBet.multiplier (numeric string)
     // The bet has already been placed and currentBet is reset.
     // We need to find the user's bet from the playerBets array to get their picked multiplier.
     let userBet = playerBets.find(bet => bet.isUser);
     let userPickedMultiplierNumericString = userBet ? userBet.multiplier : null; // e.g., '2'
     let userPickedMultiplierDisplayString = userBet ? userBet.multiplier + 'x' : 'nullx'; // e.g., '2x' or 'nullx'


     // Add outcome to recent spins
     recentSpins.unshift({ multiplier: winningMultiplierString, won: parseFloat(userPickedMultiplierNumericString) === parseFloat(winningMultiplierString.replace('x', '')) }); // Add to the beginning
     if (recentSpins.length > 10) {
         recentSpins.pop(); // Keep only the last 10
     }
     localStorage.setItem('solroulette_recent_spins', JSON.stringify(recentSpins)); // Save recent spins
     updateRecentSpinsDisplay();


     playerBets.forEach(bet => {
         // Use the numeric value of the multiplier for calculation
         const betMultiplierNumeric = parseFloat(bet.multiplier); // Bet multiplier is numeric string
         const winningMultiplierNumeric = parseFloat(winningMultiplierString.replace('x', '')); // Winning multiplier is string with 'x'

         // Show Correct Result - Compare numeric values
         if (betMultiplierNumeric === winningMultiplierNumeric) {
             const winnings = bet.amount * betMultiplierNumeric;
             // If the bet was by the current user
             if (bet.isUser) {
                 walletBalance += winnings;
                 userWinAmount = winnings;
                 userWon = true;
                 addChatMessage('System', `${user.name} won ◎${winnings.toFixed(2)} on ${winningMultiplierString}! 🎉`, '🎉', 'system'); // Win notification in chat
                 if (isGuestMode) {
                     fakeWinningsTotal += winnings - bet.amount; // Track net demo winnings
                     localStorage.setItem('solroulette_fake_winnings_total', fakeWinningsTotal);
                 }
             } else {
                 addChatMessage('System', `@${bet.user} won on ${winningMultiplierString}! 🎉`, '🎉', 'system');
             }
         } else {
             if (bet.isUser) {
                 // Display user's picked multiplier correctly in loss message
                 addChatMessage('System', `${user.name} busted on ${bet.multiplier}x! 💀`, '💀', 'system'); // Loss notification in chat (display user's pick with 'x')
                 lastLossBet = { amount: bet.amount, multiplier: bet.multiplier }; // Store loss details (numeric string)
                 userLostAmount = bet.amount; // Track lost amount
                 // Log lost amount
                 console.log('User lost. Amount:', userLostAmount);
                 if (isGuestMode) {
                     fakeWinningsTotal -= bet.amount; // Deduct lost amount from demo winnings
                     localStorage.setItem('solroulette_fake_winnings_total', fakeWinningsTotal);
                 }
             } else {
                 addChatMessage('System', `@${bet.user} busted! 😭`, '😭', 'system'); // Rage emoji for others' losses
             }
         }
     });

     // Handle user's win/loss feedback
     if (userWon) {
         playSound('win');
         triggerMoneyRain(); // Trigger money rain on win
         if (parseFloat(winningMultiplierString.replace('x', '')) >= 5) { // Check numeric value
             playSound('win_10x'); // Play special sound for 5x+ wins
             showFlash('win-10x'); // Yellow flash for 10x+
             tenXWins++; // Increment 10x wins count
         } else {
              showFlash('win'); // Green flash for other wins
         }
         if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); // Win vibration pattern
         showConfetti(); // Show confetti on win
         winStreak++;
         lastLossBet = null; // Clear loss bet on win
         if (parseFloat(winningMultiplierString.replace('x', '')) >= 5) showShareModal(userWinAmount, winningMultiplierString); // Check numeric value

         // Auto-populate chat input on win
         document.getElementById('chatInput').value = `🔥 Just hit ${winningMultiplierString} on SolRoulette! 👑`;

     } else {
         playSound('sad_trombone'); // Sad trombone for losses
         showFlash('lose'); // Red flash for losses
         if (navigator.vibrate) navigator.vibrate(300); // Loss vibration pattern
         winStreak = 0;
         // Show "Double or Nothing" prompt after a loss (only in real wallet mode)
         if (!isGuestMode && user.wallet && lastLossBet) {
             openDoubleOrNothingModal();
         }
     }

     // Update tokens based on participation or win (only in real wallet mode)
     if (!isGuestMode) {
         updateTokens(userWon ? 0.05 : 0.01);
     } else {
         // Show demo mode toast after each spin in guest mode
         showGuestModeToast();
         // Auto Trigger Demo SOL Refill Modal
         // Check if demo balance is low after the spin result and trigger refill modal
         if (walletBalance < 0.01 && !document.getElementById('refillFakeSolModal').classList.contains('visible')) {
             openRefillFakeSolModal();
         }
     }


     // Reset user's current bet state and enable controls
     currentBet = { multiplier: null, amount: 0 };
     document.getElementById('placeBetBtn').disabled = false;
     document.getElementById('placeBetBtn').textContent = 'Place Bet'; // Reset button text
     document.querySelectorAll('.multiplier-btn').forEach(btn => {
         btn.classList.remove('active'); // Deselect multiplier button
         // Re-enable multiplier buttons for both guest and real users
         btn.disabled = false;
         // Update tooltip based on mode
         btn.title = isGuestMode ? 'Using Demo SOL – Real rewards require a wallet' : (user.wallet ? '' : 'Connect Wallet to Bet');
     });
     document.getElementById('betSlider').disabled = false; // Re-enable slider for both
     // Update tooltip based on mode
     document.getElementById('betSlider').title = isGuestMode ? 'Using Demo SOL – Real rewards require a wallet' : (user.wallet ? '' : 'Connect Wallet to Bet');


     xp += 10; // Earn XP for completing a round
     checkAchievements();
     updateUIDebounced();

     // Save state to localStorage based on mode
     if (isGuestMode) {
         localStorage.setItem('solroulette_guest_balance', walletBalance);
         localStorage.setItem('solroulette_guest_xp', xp);
         localStorage.setItem('solroulette_guest_tokens', tokensEarned);
         localStorage.setItem('solroulette_guest_total_wagered', totalWagered);
         localStorage.setItem('solroulette_guest_win_streak', winStreak);
         localStorage.setItem('solroulette_guest_ten_x_wins', tenXWins);
         localStorage.setItem('solroulette_guest_achievements', JSON.stringify([...achievementsUnlocked]));
         guestSpinCount++; // Increment guest spin count
         localStorage.setItem('solroulette_guest_spin_count', guestSpinCount);
         localStorage.setItem('solroulette_fake_winnings_total', fakeWinningsTotal); // Save demo winnings
     } else {
         localStorage.setItem('solroulette_wallet_balance', walletBalance); // Save balance
         localStorage.setItem('solroulette_total_wagered', totalWagered);
         localStorage.setItem('solroulette_xp', xp);
         localStorage.setItem('solroulette_level', level);
         localStorage.setItem('solroulette_spin_tokens', tokensEarned);
         localStorage.setItem('solroulette_win_streak', winStreak);
         localStorage.setItem('solroulette_ten_x_wins', tenXWins);
         localStorage.setItem('solroulette_achievements', JSON.stringify([...achievementsUnlocked]));
         localStorage.setItem('solroulette_wallet', user.wallet);
         localStorage.setItem('solroulette_user_name', user.name);
         localStorage.setItem('solroulette_user_avatar', user.avatar);
     }
     localStorage.setItem('solroulette_is_guest', isGuestMode); // Save guest mode status
     localStorage.setItem('solroulette_first_real_bet_placed', firstRealBetPlaced); // Save real bet flag
     // Clear current bet state in localStorage
     localStorage.removeItem('solroulette_current_multiplier');
     localStorage.removeItem('solroulette_current_amount');
     localStorage.setItem('solroulette_last_spin_result', winningMultiplierString); // Save the actual result string


     // Check low balance after result (only in real wallet mode)
     if (!isGuestMode) {
         checkLowBalance();
     } else {
         document.getElementById('lowBalanceAlert').style.display = 'none'; // Hide alert in guest mode
     }

     // Loss Popup Appears Without Any Bet - Fix: Only show result modal if user had a bet
     if (userBet) {
        // Show result modal
        // Pass correct values to showResultModal
        showResultModal(userPickedMultiplierDisplayString, winningMultiplierString, userWon, userWinAmount, userLostAmount); // Pass lost amount
     } else {
         // If no user bet, just log the result and update UI
         console.log("No user bet placed this round. Spin result:", winningMultiplierString);
     }


     // Show "Enjoying the game?" modal after 3 guest spins
     if (isGuestMode && guestSpinCount >= 3 && localStorage.getItem('solroulette_guest_modal_shown') === null) {
         showMessageBox('Enjoying the game?', 'Connect your wallet to win real rewards!');
         localStorage.setItem('solroulette_guest_modal_shown', 'true'); // Set flag so it only shows once
     }

     // Restart auto demo after a short delay if it was active
     if (isAutoDemo) {
         setTimeout(startAutoDemo, 3000); // Wait 3 seconds before next auto spin
     }
 }

 // Show Result Modal
 // Update parameters to match handleSpinResult
 function showResultModal(pickedDisplay, landedDisplay, won, winAmount, lostAmount) { // Added lostAmount parameter
     const modal = document.getElementById('resultModal');
     const title = document.getElementById('resultModalTitle');
     const message = document.getElementById('resultModalMessage');
     const spinAgainBtn = document.getElementById('resultModalSpinAgainBtn');

     title.classList.remove('win', 'lose'); // Reset classes

     if (won) {
         title.textContent = 'You Won!';
         title.classList.add('win');
         // Use the actual landed result and the picked multiplier (with 'x' for display)
         message.textContent = `You picked ${pickedDisplay}. Landed on ${landedDisplay}. You won ◎${winAmount.toFixed(2)}.`;
     } else {
         title.textContent = 'You Lost!';
         title.classList.add('lose');
         // Use the actual landed result and the picked multiplier (with 'x' for display)
         message.textContent = `You picked ${pickedDisplay}. Landed on ${landedDisplay}. You lost ◎${lostAmount.toFixed(2)}.`; // Use lostAmount
     }

     // Event listener for "Spin Again" button (already attached)
     // spinAgainBtn.onclick = () => { closeResultModal(); };

     modal.classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeResultModal() {
      playSound('click');
      if (navigator.vibrate) navigator.vibrate(50);
      document.getElementById('resultModal').classList.remove('visible');
      resetIdleTimer(); // Reset idle timer on modal close
 }

 // Refill Demo SOL Modal
 function openRefillFakeSolModal() {
     document.getElementById('refillFakeSolModal').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeRefillFakeSolModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('refillFakeSolModal').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
 }

 function refillFakeSol() {
     playSound('win'); // Use win sound for positive reinforcement
     if (navigator.vibrate) navigator.vibrate([50, 50]);
     walletBalance = 500; // Reset demo balance
     localStorage.setItem('solroulette_guest_balance', walletBalance);
     // Optionally reset other guest stats here if desired
     // localStorage.setItem('solroulette_guest_xp', '0');
     // ... etc.
     showMessageBox('Refilled!', 'Your demo SOL balance has been refilled.');
     updateUIDebounced();
     closeRefillFakeSolModal();
 }


// Wheel Spin (Initiation)
function spinWheel() {
    isSpinning = true;
    playSound('whoosh', 0.7); // Play whoosh sound
    if (navigator.vibrate) navigator.vibrate([80]); // Haptic feedback on spin start


    const wheel = document.getElementById('rouletteCanvas');
    const pointer = document.getElementById('pointer');
    const container = document.getElementById('wheelContainer');

    // Determine the actual winning multiplier (mock logic with psychological bait)
    let actualWinningMultiplierString; // Store the result as string with 'x'
    const lastSpinMultiplier = recentSpins.length > 0 ? recentSpins[0].multiplier : null;

    // Implement psychological bait logic
    if (lastSpinMultiplier === '1.5x' && Math.random() < 0.6) { // 60% chance 3x follows 1.5x
        actualWinningMultiplierString = '3x';
    } else if (lastSpinMultiplier === '10x') { // 10x never lands twice in a row
         // Choose randomly from other multipliers (strings with 'x')
         const otherMultipliers = segments.filter(seg => seg.multiplier !== '10x').map(seg => seg.multiplier);
         actualWinningMultiplierString = otherMultipliers[Math.floor(Math.random() * otherMultipliers.length)];
    }
     else {
        // Default random logic (choose string with 'x')
        const result = Math.random();
        actualWinningMultiplierString = result < 0.3 ? '1.5x' :
                                  result < 0.5 ? '2x' :
                                  result < 0.7 ? '3x' :
                                  result < 0.85 ? '5x' : '10x';
    }

    // Store the actual winning multiplier string
    lastSpinResult = actualWinningMultiplierString;

    // Save the last spin result to localStorage immediately
    localStorage.setItem('solroulette_last_spin_result', lastSpinResult);


    // Determine if it's a near-miss fakeout (20% chance)
    isNearMiss = Math.random() < 0.2 && parseFloat(actualWinningMultiplierString.replace('x', '')) !== 10; // Don't fakeout on actual 10x win

    // Calculate the target rotation based on the actual winning multiplier string
    // Calculate target rotation based on actualWinningMultiplierString
    targetRotation = calculateCanvasTargetRotation(actualWinningMultiplierString);

    spinStartTime = null; // Reset start time for requestAnimationFrame
    spinAnimationId = requestAnimationFrame(animateWheel); // Start the animation loop

    container.classList.add('bounce');
    pointer.classList.add('vibrate');

    // Remove bounce/vibrate after the animation duration
    setTimeout(() => {
         container.classList.remove('bounce');
         pointer.classList.remove('vibrate');
         playSound('clank'); // Play clank sound on landing
    }, spinDuration);

    // Emit spinstart event
    const event = new Event('spinstart');
    document.getElementById('rouletteCanvas').dispatchEvent(event);
}


// Update Tokens
function updateTokens(amount) {
    tokensEarned += amount;
    localStorage.setItem('solroulette_spin_tokens', tokensEarned);
    document.getElementById('tokenCount').textContent = tokensEarned.toFixed(3);
    document.getElementById('shopSpinBalance').textContent = tokensEarned.toFixed(3); // Update shop balance
    document.getElementById('tokenNotification').style.display = 'flex';

    const float = document.createElement('div');
    float.className = 'token-float';
    float.textContent = `+${amount.toFixed(3)} $SPIN`;
    // Position the float near the notification
    const notificationRect = document.getElementById('tokenNotification').getBoundingClientRect();
    float.style.left = `${notificationRect.left + notificationRect.width / 2}px`;
    float.style.top = `${notificationRect.top - 10}px`; // Start above notification
    document.body.appendChild(float); // Append to body to float freely
    setTimeout(() => float.remove(), 1500);
}

// Claim Tokens
function openClaimModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);

    if (isGuestMode) {
         showMessageBox('Demo Mode Limitation', 'Connect your wallet to claim $SPIN tokens.');
         return;
    }
    if (tokensEarned <= 0) {
         showMessageBox('No Tokens', 'No $SPIN tokens to claim.');
         return;
    }
    // In a real app, this would interact with a smart contract
    showMessageBox('Tokens Claimed', `Claimed ${tokensEarned.toFixed(3)} $SPIN! (Mock Claim)`);
    tokensEarned = 0;
    localStorage.setItem('solroulette_spin_tokens', tokensEarned);
    document.getElementById('tokenCount').textContent = tokensEarned.toFixed(3);
    document.getElementById('shopSpinBalance').textContent = tokensEarned.toFixed(3);
    document.getElementById('tokenNotification').style.display = 'none';
    updateUIDebounced();
}

// Achievements
function checkAchievements() {
    const achievements = [
        { name: 'First Bust', condition: winStreak === 0 && totalWagered > 0, icon: '💀' },
        { name: 'Hit 10x', condition: tenXWins >= 1, icon: '🌟' },
        { name: '10 Spins', condition: guestSpinCount >= 10, icon: '🎡' }, // Use guestSpinCount for this
        { name: 'High Roller', condition: totalWagered >= 50, icon: '💰' },
         { name: 'Lucky Streak x3', condition: winStreak >= 3, icon: '🔥' },
         { name: 'Chatty', condition: xp >= 50, icon: '💬' }, // XP from chatting
         { name: 'Daily Grinder', condition: dailyBonusDay >= 5, icon: '🗓️' } // Based on daily logins
    ];

    achievements.forEach(ach => {
        // Check if condition is met AND achievement is not already unlocked
        if (ach.condition && !achievementsUnlocked.has(ach.name)) {
            unlockAchievement(ach.name, ach.icon);
        }
    });
     localStorage.setItem('solroulette_achievements', JSON.stringify([...achievementsUnlocked]));
}

function unlockAchievement(name, icon) {
    achievementsUnlocked.add(name);
    const container = document.getElementById('achievementContainer');
    const popup = document.createElement('div');
    popup.className = 'achievement-popup';
    popup.innerHTML = `
        <div class="badge-icon">${icon}</div>
        <div>
            <div style="font-weight: bold;">Achievement Unlocked!</div>
            <div>${name}</div>
        </div>
    `;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 4000); // Popup disappears after 4 seconds
     localStorage.setItem('solroulette_achievements', JSON.stringify([...achievementsUnlocked])); // Save updated achievements
}

// Flash Screen
function showFlash(type) {
    const flash = document.getElementById('flashScreen');
    flash.className = `flash-screen ${type}`;
    setTimeout(() => flash.className = 'flash-screen', 100); // Flash duration
}

 // Confetti Effect
 function showConfetti() {
    const confettiColors = ['var(--primary)', 'var(--accent)', 'var(--success)', 'var(--danger)'];
    // Adjust confetti count based on screen width
    const confettiCount = window.innerWidth < 768 ? 50 : 100; // Fewer confetti on mobile
    const confettiShapes = ['square', 'circle', 'triangle', 'star']; // Variable shapes

    for (let i = 0; i < confettiCount; i++) {
         const confetti = document.createElement('div');
         const shape = confettiShapes[Math.floor(Math.random() * confettiShapes.length)];
         confetti.className = `confetti ${shape}`; // Add shape class for styling
         confetti.style.left = `${Math.random() * 100}vw`; // Random horizontal position
         confetti.style.top = `${Math.random() * -20}vh`; // Start above viewport
         // Adjust size based on screen width
         const size = window.innerWidth < 768 ? Math.random() * 8 + 3 : Math.random() * 10 + 5;
         confetti.style.width = `${size}px`; // Variable size
         confetti.style.height = confetti.style.width; // Keep it square/circle initially
         confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
         confetti.style.animationDelay = `${Math.random() * 1}s`; // Random delay
         confetti.style.animationDuration = `${Math.random() * 2 + 1.5}s`; // Variable duration
         document.body.appendChild(confetti);
         // Remove confetti after animation
         confetti.addEventListener('animationend', () => confetti.remove());
     }
 }

// Share Modal
function showShareModal(winnings, multiplier) {
     playSound('win_10x'); // Play a sound when share modal appears (celebration)
     if (navigator.vibrate) navigator.vibrate([50, 50]);

    document.getElementById('shareTitle').textContent = 'Big Win!';
    document.getElementById('shareMessage').textContent = `Just won ◎${winnings.toFixed(2)} on the ${multiplier} multiplier! Share your victory!`;
    const shareText = `Just won ◎${winnings.toFixed(2)} on ${multiplier} at SolRoulette LIVE! Spin now: ${user.referral} #SolRoulette #Solana #Crypto`;
    document.getElementById('shareText').value = shareText;
    document.getElementById('shareModal').classList.add('visible');
}

function copyShareText() {
    playSound('click');
    if (navigator.vibrate) navigator.vibrate(50);
    const shareText = document.getElementById('shareText');
    shareText.select();
    shareText.setSelectionRange(0, 99999); // For mobile devices
    try {
        document.execCommand('copy');
        showMessageBox('Copied!', 'Share link copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showMessageBox('Copy Failed', 'Failed to copy link. Please copy manually.');
    }
}

 function tweetWin() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     const shareText = document.getElementById('shareText').value;
     const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
     window.open(twitterUrl, '_blank');
     closeShareModal();
 }

function closeShareModal() {
    playSound('click');
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('shareModal').classList.remove('visible');
}

 // Message Box (Custom Alert)
 function showMessageBox(title, message) {
     document.getElementById('messageBoxTitle').textContent = title;
     document.getElementById('messageBoxContent').textContent = message;
     document.getElementById('messageBox').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeMessageBox() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('messageBox').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
 }

 // Profile Modal
 function openProfileModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     updateProfileModal(); // Update content before showing
     document.getElementById('profileModal').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeProfileModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('profileModal').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
     // Restart auto demo if it was active before opening the modal (optional, depends on desired flow)
     // if (wasAutoDemoActive) startAutoDemo();
 }

 function updateProfileModal() {
     document.getElementById('profileAvatar').textContent = user.avatar;
     document.getElementById('profileName').textContent = user.name + (isGuestMode ? ' (Guest)' : ''); // Label guest mode
     document.getElementById('profileLevel').textContent = level;
     document.getElementById('profileXpFill').style.width = `${(xp % 100)}%`;
     document.getElementById('profileWallet').textContent = user.wallet ? user.wallet.slice(0, 6) + '...' + user.wallet.slice(-6) : 'Not Connected';
     document.getElementById('profileBalance').textContent = walletBalance.toFixed(2) + ' SOL' + (isGuestMode ? ' (Demo)' : ''); // Label demo balance
     document.getElementById('profileTotalWagered').textContent = totalWagered.toFixed(2) + ' SOL' + (isGuestMode ? ' (Demo)' : ''); // Label demo stats
     document.getElementById('profileWinStreak').textContent = winStreak + (isGuestMode ? ' (Demo)' : '');
     document.getElementById('profileTenXWins').textContent = tenXWins + (isGuestMode ? ' (Demo)' : '');

     // Show demo winnings only in guest mode
     const fakeWinningsElement = document.getElementById('profileFakeWinnings');
     const fakeWinningsTotalElement = document.getElementById('fakeWinningsTotal');
     if (isGuestMode) {
         fakeWinningsElement.style.display = 'block';
         fakeWinningsTotalElement.textContent = fakeWinningsTotal.toFixed(2);
     } else {
         fakeWinningsElement.style.display = 'none';
     }

     // Show/Hide Guest Reset Button
     const resetGuestBtn = document.getElementById('resetGuestProgressBtn');
     if (isGuestMode) {
         resetGuestBtn.style.display = 'block';
     } else {
         resetGuestBtn.style.display = 'none';
     }


     // Update achievements grid
     const achievementsGrid = document.getElementById('profileAchievementsGrid');
     achievementsGrid.innerHTML = ''; // Clear existing
     const allAchievements = [
         { name: 'First Bust', condition: winStreak === 0 && totalWagered > 0, icon: '💀' },
         { name: 'Hit 10x', condition: tenXWins >= 1, icon: '🌟' },
         { name: '10 Spins', condition: guestSpinCount >= 10, icon: '🎡' }, // Use guestSpinCount for this
         { name: 'High Roller', condition: totalWagered >= 50, icon: '💰' },
         { name: 'Lucky Streak x3', condition: winStreak >= 3, icon: '🔥' },
         { name: 'Chatty', condition: xp >= 50, icon: '💬' }, // XP from chatting
         { name: 'Daily Grinder', condition: dailyBonusDay >= 5, icon: '🗓️' } // Based on daily logins
     ];

     allAchievements.forEach(ach => {
         const badge = document.createElement('div');
         badge.className = 'badge-icon'; // Reuse badge-icon style
         if (achievementsUnlocked.has(ach.name)) {
             badge.textContent = ach.icon;
             badge.title = ach.name; // Tooltip for unlocked achievements
         } else {
             badge.textContent = '?'; // Placeholder for locked achievements
             badge.style.opacity = 0.5;
             badge.title = 'Locked';
         }
         achievementsGrid.appendChild(badge);
     });
 }

 function copyReferralLink() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     const referralInput = document.getElementById('referralLinkInput');
     referralInput.select();
     referralInput.setSelectionRange(0, 99999); // For mobile devices
     try {
         document.execCommand('copy');
         showMessageBox('Copied!', 'Referral link copied to clipboard!');
     } catch (err) {
         console.error('Failed to copy referral link: ', err);
         showMessageBox('Copy Failed', 'Failed to copy referral link. Please copy manually.');
     }
 }

 function generateReferralCode() {
     const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
     let code = '';
     for (let i = 0; i < 8; i++) {
         code += chars.charAt(Math.floor(Math.random() * chars.length));
     }
     const referralLink = `https://solroulette.live?ref=${code}`;
     localStorage.setItem('solroulette_referral_code', referralLink);
     return referralLink;
 }

 // Check for referral code in URL on load
 function checkReferralCode() {
     const urlParams = new URLSearchParams(window.location.search);
     const ref = urlParams.get('ref');
     if (ref) {
         localStorage.setItem('solroulette_referred_by', ref);
         console.log(`Referred by: ${ref}`); // Log for tracking
         // You might want to award the referrer here in a real app
     }
 }

 // Reset Guest Progress
 function resetGuestProgress() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     if (confirm('Are you sure you want to reset your demo progress? This cannot be undone.')) {
         // Clear only guest-specific localStorage items
         localStorage.removeItem('solroulette_is_guest');
         localStorage.removeItem('solroulette_guest_balance');
         localStorage.removeItem('solroulette_guest_xp');
         localStorage.removeItem('solroulette_guest_tokens');
         localStorage.removeItem('solroulette_guest_total_wagered');
         localStorage.removeItem('solroulette_guest_win_streak');
         localStorage.removeItem('solroulette_guest_ten_x_wins');
         localStorage.removeItem('solroulette_guest_achievements');
         localStorage.removeItem('solroulette_guest_spin_count');
         localStorage.removeItem('solroulette_guest_last_login');
         localStorage.removeItem('solroulette_guest_daily_bonus_day');
         localStorage.removeItem('solroulette_fake_winnings_total');
         localStorage.removeItem('solroulette_fake_intro_shown'); // Reset onboarding flag too
         localStorage.removeItem('solroulette_guest_modal_shown'); // Reset enjoyment modal flag
         localStorage.removeItem('solroulette_onboarding_shown'); // Reset onboarding tooltip flag
         localStorage.removeItem('solroulette_first_real_bet_placed'); // Reset real bet flag
         localStorage.removeItem('solroulette_current_multiplier'); // Clear current bet state
         localStorage.removeItem('solroulette_current_amount');
         localStorage.removeItem('solroulette_last_spin_result'); // Clear last spin result

         location.reload(); // Reload the page to restart in fresh guest mode
     }
 }


 // Shop Modal
 function openShopModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('shopSpinBalance').textContent = tokensEarned.toFixed(3);
     document.getElementById('shopModal').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeShopModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('shopModal').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
     // Restart auto demo if it was active before opening the modal (optional)
 }

 function buyShopItem(itemId, cost) {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     if (isGuestMode) {
         showMessageBox('Demo Mode Limitation', 'Connect your wallet to buy shop items.');
         return;
     }
     if (tokensEarned >= cost) {
         tokensEarned -= cost;
         localStorage.setItem('solroulette_spin_tokens', tokensEarned);
         document.getElementById('shopSpinBalance').textContent = tokensEarned.toFixed(3);
         showMessageBox('Purchase Successful', `You bought ${itemId}! (Mock Purchase)`);
         updateUIDebounced(); // Update UI including token balance

         // Apply item effect (mock)
         if (itemId === 'rocket_avatar') {
             user.avatar = '🚀';
             localStorage.setItem('solroulette_user_avatar', user.avatar);
             updateUIDebounced(); // Update avatar in header
         } else if (itemId === 'fire_emote') {
             // Unlock fire emote in chat (mock - would need chat input enhancement)
             addChatMessage('System', `${user.name} unlocked the 🔥 emote!`, '🎉', 'system');
         }

     } else {
         showMessageBox('Purchase Failed', 'Not enough $SPIN tokens.');
     }
 }

 // Daily Login Bonus
 function checkDailyBonus() {
     const today = new Date().toDateString();
     const lastBonusDate = localStorage.getItem(isGuestMode ? 'solroulette_guest_last_login' : 'solroulette_last_login');

     if (lastBonusDate !== today) {
         dailyBonusDay++;
         localStorage.setItem(isGuestMode ? 'solroulette_guest_last_login' : 'solroulette_last_login', today);
         localStorage.setItem(isGuestMode ? 'solroulette_guest_daily_bonus_day' : 'solroulette_daily_bonus_day', dailyBonusDay);

         const bonusAmount = isGuestMode ? 25 : (dailyBonusDay === 7 ? 0.1 : 0.01); // 25 demo SOL for guests
         const bonusCurrency = isGuestMode ? 'SOL' : (dailyBonusDay === 7 ? 'SOL' : '$SPIN');

         document.getElementById('dailyBonusDay').textContent = dailyBonusDay;
         document.getElementById('dailyBonusAmount').textContent = `Reward: ◎${bonusAmount.toFixed(bonusCurrency === 'SOL' ? 2 : 3)} ${bonusCurrency}`;

         openDailyBonusModal();
     }
 }

 function openDailyBonusModal() {
     document.getElementById('dailyBonusModal').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeDailyBonusModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('dailyBonusModal').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
     // Restart auto demo if it was active before opening the modal (optional)
 }

 function claimDailyBonus() {
     playSound('win');
     if (navigator.vibrate) navigator.vibrate([50, 50]);
     const bonusAmount = isGuestMode ? 25 : (dailyBonusDay === 7 ? 0.1 : 0.01); // 25 demo SOL for guests
     const bonusCurrency = isGuestMode ? 'SOL' : (dailyBonusDay === 7 ? 'SOL' : '$SPIN');

     if (isGuestMode) {
         walletBalance += bonusAmount; // Add to demo balance
         localStorage.setItem('solroulette_guest_balance', walletBalance);
         showMessageBox('Bonus Claimed!', `Claimed ◎${bonusAmount.toFixed(2)} Demo SOL!`);
     } else if (bonusCurrency === 'SOL') {
         walletBalance += bonusAmount;
         localStorage.setItem('solroulette_wallet_balance', walletBalance); // Save real balance
         showMessageBox('Bonus Claimed!', `Claimed ${bonusAmount} SOL!`);
     } else {
         tokensEarned += bonusAmount;
         localStorage.setItem('solroulette_spin_tokens', tokensEarned); // Save real tokens
         showMessageBox('Bonus Claimed!', `Claimed ${bonusAmount} $SPIN!`);
     }

     // Reset daily bonus day after claiming day 7
     if (dailyBonusDay === 7) {
         dailyBonusDay = 0;
         localStorage.setItem(isGuestMode ? 'solroulette_guest_daily_bonus_day' : 'solroulette_daily_bonus_day', dailyBonusDay);
     }

     checkAchievements(); // Check if daily grinder achievement is unlocked
     updateUIDebounced();
     closeDailyBonusModal();
 }

 // Leaderboard (Mock Data with Tabs)
 let leaderboardScrollTimer = null;
 const LEADERBOARD_SCROLL_INTERVAL = 5000; // Scroll every 5 seconds

 function updateLeaderboard() {
     const leaderboardContent = document.getElementById('leaderboardContent');

     // Mock Leaderboard Data (can be made more dynamic)
     const mockLeaderboard = {
         wager: [
             { name: user.name, value: (isGuestMode ? totalWagered : totalWagered).toFixed(2) + ' SOL', avatar: user.avatar }, // Show demo wager in guest mode
             { name: 'WhaleShark', value: '5000 SOL', avatar: '🐋' },
             { name: 'GambaKing', value: '3000 SOL', avatar: '👑' },
              { name: 'SolDegen', value: '1500 SOL', avatar: '😎' },
              { name: 'CryptoChad', value: '1000 SOL', avatar: '📈' },
              { name: 'DiamondHands', value: '800 SOL', avatar: '💎' },
              { name: 'PaperHands', value: '500 SOL', avatar: '📉' }
         ],
         streak: [
             { name: user.name, value: winStreak, avatar: user.avatar },
             { name: 'LuckyLuke', value: 15, avatar: '🍀' },
             { name: 'StreakMaster', value: 10, avatar: '🔥' },
              { name: 'WinGod', value: 8, avatar: '✨' },
              { name: 'HotHand', value: 6, avatar: '🌶️' },
              { name: 'Consistent', value: 5, avatar: '✅' },
              { name: 'NeverLose', value: 4, avatar: '🛡️' }
         ],
         '10x': [
             { name: user.name, value: tenXWins, avatar: user.avatar },
             { name: 'TenXHunter', value: 25, avatar: '🎯' },
             { name: 'JackpotJoe', value: 18, avatar: '💰' },
              { name: 'BigWinner', value: 12, avatar: '🏆' },
              { name: 'MoonApe', value: 9, avatar: '🌕' },
              { name: 'StarChaser', value: 7, avatar: '🌟' },
              { name: 'Legend', value: 5, avatar: '👑' }
         ]
     };

     // Update content for each tab
     Object.keys(mockLeaderboard).forEach(tabId => {
         const tabContentDiv = leaderboardContent.querySelector(`.leaderboard-content-tab[data-tab="${tabId}"]`);
         if (tabContentDiv) {
             tabContentDiv.innerHTML = ''; // Clear existing content
             mockLeaderboard[tabId].forEach(entry => {
                 const entryDiv = document.createElement('div');
                 entryDiv.className = 'leaderboard-entry';
                 entryDiv.innerHTML = `
                     <span class="user">
                         ${entry.avatar} ${entry.name}:
                     </span>
                     <span class="value">${entry.value}</span>
                 `;
                 tabContentDiv.appendChild(entryDiv);
             }
             );
         }
     });

     // Start auto-scrolling if there are more than 5 entries
     const activeTabContent = leaderboardContent.querySelector('.leaderboard-content-tab.active');
     if (activeTabContent && activeTabContent.children.length > 5) {
         startLeaderboardScroll();
     } else {
         stopLeaderboardScroll();
     }
 }

 function startLeaderboardScroll() {
     if (leaderboardScrollTimer === null) {
         const leaderboardPanel = document.getElementById('leaderboardPanel');
         leaderboardScrollTimer = setInterval(() => {
             // Scroll down by a small amount
             leaderboardPanel.scrollBy({ top: 20, behavior: 'smooth' });
             // If scrolled to the bottom, reset to top
             if (leaderboardPanel.scrollTop + leaderboardPanel.clientHeight >= leaderboardPanel.scrollHeight) {
                 leaderboardPanel.scrollTo({ top: 0, behavior: 'smooth' });
             }
         }, LEADERBOARD_SCROLL_INTERVAL / 5); // Scroll more frequently in smaller steps
     }
 }

 function stopLeaderboardScroll() {
     clearInterval(leaderboardScrollTimer);
     leaderboardScrollTimer = null;
 }


 // Leaderboard Tab Switching
 document.querySelectorAll('.leaderboard-tab').forEach(tab => {
     tab.addEventListener('click', () => {
         document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
         tab.classList.add('active');
         const targetTab = tab.dataset.tab;
         document.querySelectorAll('.leaderboard-content-tab').forEach(content => {
             content.classList.remove('active');
             if (content.dataset.tab === targetTab) {
                 content.classList.add('active');
             }
         });
         updateLeaderboard(); // Update leaderboard content and restart scroll
     });
 });

 // Low Balance Alert
 function checkLowBalance() {
     if (!isGuestMode && user.wallet && walletBalance < 0.5) { // Only show in real wallet mode
         document.getElementById('lowBalanceAlert').style.display = 'block';
     } else {
         document.getElementById('lowBalanceAlert').style.display = 'none';
     }
 }

 function topUpWallet() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     // Mock Top Up
     walletBalance += 5; // Add 5 SOL mock
     localStorage.setItem('solroulette_wallet_balance', walletBalance);
     showMessageBox('Mock Top Up', '5 SOL added to your balance!');
     updateUIDebounced();
     checkLowBalance(); // Re-check balance after top up
 }

 // Double or Nothing
 function openDoubleOrNothingModal() {
     document.getElementById('doubleOrNothingModal').classList.add('visible');
     resetIdleTimer(); // Reset idle timer on modal open
     stopAutoDemo(); // Stop auto demo on modal open
 }

 function closeDoubleOrNothingModal() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     document.getElementById('doubleOrNothingModal').classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
     // Restart auto demo if it was active before opening the modal (optional)
 }

 function tryAgainBet() {
     playSound('click');
     if (navigator.vibrate) navigator.vibrate(50);
     if (lastLossBet) {
         // Attempt to place the same bet again
         // Need to ensure betting is open and user has enough balance
         if (!isSpinning && spinTimer > 3 && walletBalance >= lastLossBet.amount) {
             // Set current bet to the last loss bet details (multiplier is numeric string)
             currentBet.multiplier = lastLossBet.multiplier;
             document.getElementById('betSlider').value = lastLossBet.amount; // Set slider value
             currentBet.amount = lastLossBet.amount; // Ensure amount is set in state
             // Find and activate the corresponding multiplier button (UI only)
             document.querySelectorAll('.multiplier-btn').forEach(btn => {
                 btn.classList.remove('active');
                 // Compare numeric strings
                 if (btn.dataset.multiplier === currentBet.multiplier) {
                     btn.classList.add('active');
                 }
             });
             updateUIDebounced(); // Update bet value display

             // Place the bet
             placeBet();

             lastLossBet = null; // Clear last loss bet after attempting "Try Again"
             closeDoubleOrNothingModal(); // Close the modal
         } else if (isSpinning || spinTimer <= 3) {
             showMessageBox('Betting Closed', 'Betting is closed for this round!');
         } else if (walletBalance < lastLossBet.amount) {
             showMessageBox('Insufficient Balance', 'Not enough SOL to try again.');
         } else {
             // Should not happen with the above checks, but as a fallback
             showMessageBox('Try Again Failed', 'Could not place the bet. Please try manually.');
         }
     } else {
         // Should not happen if modal is shown only after loss
         closeDoubleOrNothingModal();
     }
 }

 // Show Demo Mode Toast
 function showGuestModeToast() {
     const toast = document.getElementById('guestModeToast');
     toast.style.display = 'block';
     setTimeout(() => {
         toast.style.display = 'none';
     }, 5000); // Hide after 5 seconds
 }

 // Onboarding Modal for Guest Mode
 function showOnboardingModal() {
     const modal = document.getElementById('onboardingModal');
     modal.classList.add('visible');
     stopAutoDemo(); // Stop auto demo during onboarding


     document.getElementById('onboardingStartBtn').onclick = () => {
         localStorage.setItem('solroulette_fake_intro_shown', 'true');
         isGuestMode = true; // Explicitly set guest mode
         localStorage.setItem('solroulette_is_guest', 'true');
         // walletBalance is already set to 500 on initial load if fakeIntroShown is false
         // Ensure currentBet is reset when starting guest mode from onboarding
         currentBet = { multiplier: null, amount: 0 };
         localStorage.removeItem('solroulette_current_multiplier');
         localStorage.removeItem('solroulette_current_amount');


         // Initialize other guest stats if they don't exist
         if (localStorage.getItem('solroulette_guest_xp') === null) localStorage.setItem('solroulette_guest_xp', '0');
         if (localStorage.getItem('solroulette_guest_tokens') === null) localStorage.setItem('solroulette_guest_tokens', '0');
         if (localStorage.getItem('solroulette_guest_total_wagered') === null) localStorage.setItem('solroulette_guest_total_wagered', '0');
         if (localStorage.getItem('solroulette_guest_win_streak') === null) localStorage.setItem('solroulette_guest_win_streak', '0');
         if (localStorage.getItem('solroulette_guest_ten_x_wins') === null) localStorage.setItem('solroulette_guest_ten_x_wins', '0');
         if (localStorage.getItem('solroulette_guest_achievements') === null) localStorage.setItem('solroulette_guest_achievements', '[]');
         if (localStorage.getItem('solroulette_guest_spin_count') === null) localStorage.setItem('solroulette_guest_spin_count', '0');
         if (localStorage.getItem('solroulette_guest_last_login') === null) localStorage.setItem('solroulette_guest_last_login', new Date().toDateString()); // Initialize guest login date
         if (localStorage.getItem('solroulette_guest_daily_bonus_day') === null) localStorage.setItem('solroulette_guest_daily_bonus_day', '0');
         if (localStorage.getItem('solroulette_fake_winnings_total') === null) localStorage.setItem('solroulette_fake_winnings_total', '0');

         // Load guest stats after setting them
         xp = parseInt(localStorage.getItem('solroulette_guest_xp'));
         tokensEarned = parseFloat(localStorage.getItem('solroulette_guest_tokens'));
         totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered'));
         winStreak = parseInt(localStorage.getItem('solroulette_win_streak'));
         tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins'));
         achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements')));
         guestSpinCount = parseInt(localStorage.getItem('solroulette_guest_spin_count'));
         dailyBonusDay = parseInt(localStorage.getItem('solroulette_guest_daily_bonus_day'));
         fakeWinningsTotal = parseFloat(localStorage.getItem('solroulette_fake_winnings_total'));


         user.name = 'Guest'; // Ensure name is Guest
         user.avatar = '👋'; // Ensure avatar is Guest avatar
         localStorage.setItem('solroulette_user_name', user.name);
         localStorage.setItem('solroulette_user_avatar', user.avatar);


         closeOnboardingModal();
         updateUIDebounced(); // Update UI to show the new balance and guest state
         showMessageBox('Demo SOL Added', '◎500 Demo SOL added. Start spinning!'); // Show toast
         showOnboardingTooltip(); // Show the onboarding tooltip after modal
         resetIdleTimer(); // Start idle timer after onboarding
     };

     document.getElementById('onboardingConnectBtn').onclick = () => {
         localStorage.setItem('solroulette_fake_intro_shown', 'true');
         isGuestMode = false; // Explicitly set guest mode to false
         localStorage.setItem('solroulette_is_guest', 'false');
         closeOnboardingModal();
         openWalletModal(); // Open the real wallet connection modal
         dismissOnboarding(); // Dismiss the onboarding tooltip/glow
         resetIdleTimer(); // Start idle timer after onboarding
     };
 }

 function closeOnboardingModal() {
     document.getElementById('onboardingModal').classList.remove('visible');
 }

 // Onboarding Tooltip
 function showOnboardingTooltip() {
     if (!onboardingShown && isGuestMode) {
         const tooltip = document.getElementById('onboardingTooltip');
         const multiplierOptions = document.getElementById('multiplierOptions');

         // Add glow to multiplier options
         multiplierOptions.classList.add('onboarding-glow');

         // Show tooltip
         tooltip.classList.add('visible');

         // Auto-dismiss after 10 seconds
         setTimeout(() => {
             dismissOnboarding();
         }, 10000);
     }
 }

 function dismissOnboarding() {
     const tooltip = document.getElementById('onboardingTooltip');
     const multiplierOptions = document.getElementById('multiplierOptions');

     // Remove glow and hide tooltip
     multiplierOptions.classList.remove('onboarding-glow');
     tooltip.classList.remove('visible');

     // Mark onboarding as shown
     onboardingShown = true;
     localStorage.setItem('solroulette_onboarding_shown', 'true');
 }


 // Update Recent Spins Display
 function updateRecentSpinsDisplay() {
     const recentSpinsDiv = document.getElementById('recentSpins');
     recentSpinsDiv.innerHTML = '<span class="label">Recent:</span>'; // Reset content

     recentSpins.forEach(spin => {
         const outcomeSpan = document.createElement('span');
         // Determine color class based on the multiplier value
         const multiplierValue = parseFloat(spin.multiplier.replace('x', ''));
         let colorClass = 'lose'; // Default to lose (danger color)
         if (multiplierValue === 1.5 || multiplierValue === 5) {
             colorClass = 'success'; // Use 'success' class for 1.5x and 5x
         } else if (multiplierValue === 2) {
             colorClass = 'primary'; // Use 'primary' color for 2x
         } else if (multiplierValue === 3) {
             colorClass = 'accent'; // Use 'accent' color for 3x
         } else if (multiplierValue === 10) {
              colorClass = 'danger'; // Use 'danger' color for 10x
         }
         outcomeSpan.className = `outcome ${colorClass}`;
         outcomeSpan.textContent = spin.multiplier; // Display with 'x'
         recentSpinsDiv.appendChild(outcomeSpan);
     });
 }

 // Update Bet Summary Display
 function updateBetSummary() {
     const betSummaryDiv = document.getElementById('betSummary');
     // Check if multiplier is set (numeric string)
     if (currentBet.multiplier !== null && currentBet.amount > 0) {
         const potentialWin = currentBet.amount * parseFloat(currentBet.multiplier); // Use numeric value
         betSummaryDiv.innerHTML = `
             🧾 You bet ◎${currentBet.amount.toFixed(2)} on ${currentBet.multiplier}x
             <br>
             🎯 Potential Win: ◎${potentialWin.toFixed(2)}
         `;
         betSummaryDiv.style.display = 'block';
     } else {
         betSummaryDiv.style.display = 'none';
     }
 }

 // Auto Demo Mode Functions
 function startAutoDemo() {
     // Only start auto demo if in guest mode, no real bet placed, not spinning, and no modal is open
     if (!isGuestMode || firstRealBetPlaced || isSpinning || document.querySelector('.modal-overlay.visible')) {
         isAutoDemo = false;
         document.getElementById('autoDemoBanner').style.display = 'none';
         return;
     }

     isAutoDemo = true;
     document.getElementById('autoDemoBanner').style.display = 'block';

     // Select a random multiplier (numeric string)
     const multipliers = ['1.5', '2', '3', '5', '10']; // Use numeric strings
     const randomMultiplier = multipliers[Math.floor(Math.random() * multipliers.length)];

     // Select the multiplier button in the UI (visual only)
     document.querySelectorAll('.multiplier-btn').forEach(btn => {
         btn.classList.remove('active');
         if (btn.dataset.multiplier === randomMultiplier) { // Compare numeric strings
             btn.classList.add('active');
         }
     });
     currentBet.multiplier = randomMultiplier; // Set the state (numeric string)

     // Set a random bet amount (e.g., between 0.1 and 2 SOL)
     const randomAmount = parseFloat((Math.random() * 1.9 + 0.1).toFixed(2));
     document.getElementById('betSlider').value = randomAmount; // Update slider
     currentBet.amount = randomAmount; // Set the state
     updateUIDebounced(); // Update UI to show selected bet

     // Place the bet after a short delay
     setTimeout(() => {
         // Double check state before placing bet in auto demo
         if (isAutoDemo && !isSpinning && spinTimer > 3) {
             placeBet();
         } else {
             // If conditions aren't met, try starting demo again later
             autoDemoTimer = setTimeout(startAutoDemo, AUTO_DEMO_INTERVAL);
         }
     }, 1000); // Wait 1 second before placing the bet in auto demo
 }

 function stopAutoDemo() {
     clearTimeout(autoDemoTimer);
     isAutoDemo = false;
     document.getElementById('autoDemoBanner').style.display = 'none';
     // Reset selected multiplier and amount in UI if needed, but keep state for manual play
     document.querySelectorAll('.multiplier-btn').forEach(btn => btn.classList.remove('active'));
     // Do NOT reset currentBet here, it should persist unless a spin happens
     // currentBet = { multiplier: null, amount: 0 };
     // document.getElementById('betSlider').value = 0.5; // Reset slider visually
     updateUIDebounced(); // Update UI
 }

 // Keyboard Detection for Mobile Sticky Bet Button
 let initialViewportHeight = window.innerHeight;
 let keyboardOpen = false;

 function checkKeyboard() {
     const currentViewportHeight = window.innerHeight;
     const heightDifference = initialViewportHeight - currentViewportHeight;
     // A common heuristic: keyboard is open if viewport height decreases significantly (e.g., > 150px)
     const keyboardThreshold = 150;

     if (heightDifference > keyboardThreshold && !keyboardOpen) {
         // Keyboard opened
         keyboardOpen = true;
         document.body.classList.add('keyboard-open');
     } else if (heightDifference <= keyboardThreshold && keyboardOpen) {
         // Keyboard closed
         keyboardOpen = false;
         document.body.classList.remove('keyboard-open');
     }
 }

 // Add event listeners to check keyboard state
 window.addEventListener('resize', checkKeyboard);
 // Also check on focus/blur of input fields as resize might not fire consistently
 document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(input => {
     input.addEventListener('focus', checkKeyboard);
     input.addEventListener('blur', checkKeyboard);
 });


 // Daily Reward Prompt
 let activeUseTimer = null;
 let activeUseDuration = 0; // Track active use time in seconds
 const DAILY_REWARD_THRESHOLD = 180; // 3 minutes in seconds (180)

 function startActiveUseTimer() {
     if (activeUseTimer === null) {
         activeUseTimer = setInterval(() => {
             activeUseDuration++;
             // console.log('Active use duration:', activeUseDuration); // For debugging
             if (activeUseDuration >= DAILY_REWARD_THRESHOLD && isGuestMode && !dailyRewardClaimedToday) {
                 showDailyRewardModal();
                 stopActiveUseTimer(); // Stop the timer once threshold is met
             }
         }, 1000); // Check every second
     }
 }

 function stopActiveUseTimer() {
     clearInterval(activeUseTimer);
     activeUseTimer = null;
 }

 function resetActiveUseTimer() {
     activeUseDuration = 0;
     stopActiveUseTimer();
     startActiveUseTimer();
 }

 function showDailyRewardModal() {
     const modal = document.getElementById('dailyRewardModal');
      // Only show if no other modal is visible and in guest mode and not claimed today
     const anyModalVisible = document.querySelector('.modal-overlay.visible');
     if (!anyModalVisible && isGuestMode && !dailyRewardClaimedToday) {
        modal.classList.add('visible');
        resetIdleTimer(); // Reset idle timer on modal open
        stopAutoDemo(); // Stop auto demo on modal open
     }
 }

 function closeDailyRewardModal() {
     const modal = document.getElementById('dailyRewardModal');
     modal.classList.remove('visible');
     resetIdleTimer(); // Reset idle timer on modal close
 }

 function claimDailyReward() {
     playSound('win');
     if (navigator.vibrate) navigator.vibrate([50, 50]);
     const rewardAmount = 0.05; // 0.05 $SPIN
     tokensEarned += rewardAmount;
     localStorage.setItem('solroulette_spin_tokens', tokensEarned);
     dailyRewardClaimedToday = true;
     localStorage.setItem('solroulette_daily_reward_claimed', new Date().toDateString()); // Mark as claimed today
     showMessageBox('Reward Claimed!', `You claimed ${rewardAmount.toFixed(2)} $SPIN!`);
     updateUIDebounced();
     closeDailyRewardModal();
 }


// Update UI elements
function updateUI() {
    // Add console log to check state in updateUI
    console.log('updateUI running. currentBet.multiplier:', currentBet.multiplier, 'currentBet.amount:', currentBet.amount, 'spinTimer:', spinTimer, 'isGuestMode:', isGuestMode, 'user.wallet:', user.wallet ? 'Connected' : 'Not Connected');

    // Update XP bar and level
    const xpPercentage = (xp % 100);
    // Check for level up
    if (xp >= 100) {
        level++;
        xp -= 100; // Reset XP for the new level
        addChatMessage('System', `${user.name} leveled up to ${level}!`, '🎉', 'system');
        localStorage.setItem('solroulette_level', level); // Save new level
        localStorage.setItem('solroulette_xp', xp); // Save remaining XP
        // Recursively check if multiple levels were gained
        if (xp >= 100) updateUIDebounced(); // Re-run updateUI if still enough XP for next level
    }
     localStorage.setItem('solroulette_xp', xp); // Save current XP


    // Update the entire user profile block in the header
    document.getElementById('userProfile').innerHTML = `
        <div class="avatar" id="userAvatar">${user.avatar}</div>
        <div class="user-info">
            <div id="userName">${user.name} ${isGuestMode ? '(Guest)' : ''} (Lv. ${level})</div>
            <div class="xp-bar"><div class="xp-fill" id="xpFill" style="width: ${(xp % 100)}%"></div></div>
        </div>
        <div class="sol-balance-display"><i class="fas fa-wallet"></i> <span id="solBalance">${walletBalance.toFixed(2)}</span> SOL ${isGuestMode ? '(Demo)' : ''}</div>
         <div id="fakeWinningsDisplay" class="fake-winnings-display" style="${isGuestMode ? 'display: block;' : 'display: none;'}" title="Your total demo winnings so far.">
             ◎<span id="fakeWinningsTotalDisplay">${fakeWinningsTotal.toFixed(2)}</span> (Demo)
         </div>
    `;
     // Re-attach event listener to the new user profile element
     document.getElementById('userProfile').addEventListener('click', openProfileModal);


    // Update button states based on timer and wallet connection/guest mode
    const placeBetBtn = document.getElementById('placeBetBtn');
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const multiplierBtns = document.querySelectorAll('.multiplier-btn');
    const betSlider = document.getElementById('betSlider');
    const spinAgainBtn = document.getElementById('resultModalSpinAgainBtn');
    const guestModeBanner = document.getElementById('guestModeBanner');


    const bettingAllowedByTimer = !isSpinning && spinTimer > 3;
    // Check for multiplier (numeric string) and amount > 0
    const betIsValid = currentBet.multiplier !== null && currentBet.amount > 0;


    // Enable Place Bet in Guest Mode
    if (user.wallet && !isGuestMode) { // Connected with real wallet
         connectWalletBtn.style.display = 'none';
         placeBetBtn.style.display = 'block';
         guestModeBanner.style.display = 'none'; // Hide guest banner for real users

         // Place Bet button requires multiplier selected, amount > 0, and betting allowed by timer
         placeBetBtn.disabled = !bettingAllowedByTimer || !betIsValid;
         placeBetBtn.title = bettingAllowedByTimer ? '' : 'Betting is closed';

         multiplierBtns.forEach(btn => {
             btn.disabled = !bettingAllowedByTimer;
             btn.title = bettingAllowedByTimer ? '' : 'Betting is closed';
         });
         betSlider.disabled = !bettingAllowedByTimer;
         betSlider.title = bettingAllowedByTimer ? '' : 'Betting is closed';

    } else { // Guest Mode or not connected
         // Show Connect Wallet button only when not connected
         if (!user.wallet) {
             connectWalletBtn.style.display = 'block';
         } else {
             connectWalletBtn.style.display = 'none'; // Hide if wallet is connected (even in guest mode)
         }

         // Show Place Bet button in Guest Mode
         placeBetBtn.style.display = 'block'; // Always show place bet button in guest mode
         guestModeBanner.style.display = 'block'; // Show guest banner for guest users

         // In guest mode, placeBetBtn is ENABLED if bettingAllowedByTimer is true and a multiplier is selected and amount > 0
         // It does NOT require user.wallet to be connected.
         placeBetBtn.disabled = !bettingAllowedByTimer || !betIsValid;
         placeBetBtn.title = 'Demo SOL bets. Connect wallet to win real rewards.'; // Tooltip for guest mode Place Bet


         // Multiplier buttons and slider are ENABLED in guest mode for fake bets, but disabled by timer
         multiplierBtns.forEach(btn => {
             btn.disabled = !bettingAllowedByTimer; // Disable based on timer
             btn.title = bettingAllowedByTimer ? 'Using Demo SOL – Real rewards require a wallet' : 'Betting is closed';
         });
         betSlider.disabled = !bettingAllowedByTimer; // Disable based on timer
         betSlider.title = bettingAllowedByTimer ? 'Using Demo SOL – Real rewards require a wallet' : 'Betting is closed';
    }

     // Disable Spin Again button if betting is not allowed by timer
     spinAgainBtn.disabled = !bettingAllowedByTimer;

    // Apply active class to multiplier button based on currentBet.multiplier (numeric string)
    multiplierBtns.forEach(btn => {
        btn.classList.remove('active');
        if (currentBet.multiplier !== null && btn.dataset.multiplier === currentBet.multiplier) {
            btn.classList.add('active');
        }
    });

    // Log the disabled state of the place bet button
    console.log('Place Bet button disabled state:', placeBetBtn.disabled);


     // Update token notification visibility (only in real wallet mode)
     if (tokensEarned > 0 && !isGuestMode) {
         document.getElementById('tokenNotification').style.display = 'flex';
     } else {
          document.getElementById('tokenNotification').style.display = 'none';
     }

     // Check and show low balance alert (only in real wallet mode)
     if (!isGuestMode) {
         checkLowBalance();
     } else {
         document.getElementById('lowBalanceAlert').style.display = 'none'; // Hide alert in guest mode
     }


     // Update shop balance
     document.getElementById('shopSpinBalance').textContent = tokensEarned.toFixed(3);

     // Update bet summary
     updateBetSummary();

     // Update demo winnings display in header
     document.getElementById('fakeWinningsTotalDisplay').textContent = fakeWinningsTotal.toFixed(2);

}

// Initial Canvas Setup
function setupCanvas() {
    const container = document.getElementById('wheelContainer');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    drawWheel(); // Initial draw
}

// Idle Timer Functions
function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showIdleModalOrAutoDemo, IDLE_TIMEOUT); // Use a combined function


     // Stop auto demo if it's running when user interacts
     if (isAutoDemo) {
         stopAutoDemo();
     }
     // Restart active use timer on interaction
     resetActiveUseTimer();
}

function showIdleModalOrAutoDemo() {
     const anyModalVisible = document.querySelector('.modal-overlay.visible');
     // If no modal is open and in guest mode with no real bet placed, start auto demo
     if (!anyModalVisible && isGuestMode && !firstRealBetPlaced) {
         startAutoDemo();
     } else if (!anyModalVisible) {
         // Otherwise, show the idle modal if no modal is open
         showIdleModal();
     }
     // Reset timer regardless
     resetIdleTimer();
}

function showIdleModal() {
    const idleModal = document.getElementById('idleModal');
    // Only show if no other modal is visible
    const anyModalVisible = document.querySelector('.modal-overlay.visible');
    if (!anyModalVisible) {
        idleModal.classList.add('visible');
    }
     // Reset timer even if modal wasn't shown, to prevent immediate re-trigger
    resetIdleTimer();
}

function closeIdleModal() {
    document.getElementById('idleModal').classList.remove('visible');
    resetIdleTimer(); // Reset timer after closing modal
}


// Event Listeners
// Bet Slider Fix - Update currentBet.amount and display
document.getElementById('betSlider').addEventListener('input', (e) => {
     currentBet.amount = parseFloat(e.target.value);
     localStorage.setItem('solroulette_current_amount', currentBet.amount); // Save to localStorage
     updateUIDebounced(); // Update the displayed bet value and button state
     // Dismiss onboarding tooltip/glow if active and user interacts with slider
     dismissOnboarding();
     resetIdleTimer(); // Reset idle timer on slider change
     stopAutoDemo(); // Stop auto demo on manual selection
});

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChat();
        e.preventDefault(); // Prevent default form submission if input is inside a form
    }
});

document.querySelectorAll('.multiplier-btn').forEach(btn => {
    btn.addEventListener('click', () => {
         // Multiplier Button Click Not Working (Guest Mode) - Add console log
         console.log('Multiplier button clicked:', btn.dataset.multiplier);

         // Multiplier buttons are enabled even in guest mode, but placeBetBtn handles real betting
         if (isSpinning || spinTimer <= 3) {
             console.log('Betting closed, ignoring multiplier click.');
             return; // Cannot select during spin or countdown
         }

        playSound('click');
        if (navigator.vibrate) navigator.vibrate(50);

        // Remove active class from all buttons
        document.querySelectorAll('.multiplier-btn').forEach(b => b.classList.remove('active'));
        // Add active class to the clicked button
        btn.classList.add('active');
        // Multiplier Selection Fix - Set currentBet.multiplier correctly (numeric string)
        currentBet.multiplier = btn.dataset.multiplier; // Set the multiplier as numeric string (e.g., "1.5")
        localStorage.setItem('solroulette_current_multiplier', currentBet.multiplier); // Save to localStorage
        console.log('currentBet.multiplier set to:', currentBet.multiplier);


         // Enable place bet button if amount > 0 and wallet is connected and betting is allowed
         // This logic is now handled in updateUI based on user.wallet and isSpinning/spinTimer
         // Multiplier Button Click Not Working (Guest Mode) - Trigger updateUI
         updateUIDebounced(); // Update UI to reflect button state and potentially enable Place Bet

         // Dismiss onboarding tooltip/glow if active
         dismissOnboarding();
         resetIdleTimer(); // Reset idle timer on multiplier selection
         stopAutoDemo(); // Stop auto demo on manual selection
    });
});

// Event listener for the user profile div to open profile modal
// This is handled within the updateUI function now.

 // Event listeners for new modals
 document.getElementById('walletModal').addEventListener('click', (e) => {
     // Close modal if clicking outside the content
     if (e.target === document.getElementById('walletModal')) {
         // closeWalletModal(); // Keep wallet modal open until user chooses or clicks close button
     }
 });
  document.getElementById('profileModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('profileModal')) {
         closeProfileModal();
     }
 });
  document.getElementById('shopModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('shopModal')) {
         closeShopModal();
     }
 });
  document.getElementById('dailyBonusModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('dailyBonusModal')) {
         closeDailyBonusModal();
     }
 });
  document.getElementById('doubleOrNothingModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('doubleOrNothingModal')) {
         // closeDoubleOrNothingModal(); // Keep double or nothing modal open until user chooses
     }
 });
 document.getElementById('resultModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('resultModal')) {
         // closeResultModal(); // Keep result modal open until user clicks button
     }
 });
 document.getElementById('messageBox').addEventListener('click', (e) => {
     if (e.target === document.getElementById('messageBox')) {
         closeMessageBox();
     }
 });
  document.getElementById('shareModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('shareModal')) {
         closeShareModal();
     }
 });
 document.getElementById('onboardingModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('onboardingModal')) {
         // Do not close onboarding modal by clicking outside, force button click
     }
 });
  document.getElementById('refillFakeSolModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('refillFakeSolModal')) {
         // Do not close refill modal by clicking outside
     }
 });
 document.getElementById('idleModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('idleModal')) {
         // closeIdleModal(); // Keep idle modal open until user clicks button
     }
 });
 document.getElementById('dailyRewardModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('dailyRewardModal')) {
         // Keep daily reward modal open until user clicks button
     }
 });


// Add event listeners for buttons that had inline onclick
// document.getElementById('connectWalletBtn').addEventListener('click', openWalletModal); // Already handled in DOMContentLoaded
document.getElementById('placeBetBtn').addEventListener('click', placeBet);
// document.getElementById('sendChatBtn').addEventListener('click', sendChat); // Moved to Chat Toggle JS
document.getElementById('claimModalBtn').addEventListener('click', openClaimModal);
document.getElementById('closeWalletModalBtn').addEventListener('click', closeWalletModal);
document.getElementById('justWatchingBtn').addEventListener('click', closeWalletModal); // "Just Watching" button
// document.getElementById('connectPhantomBtn').addEventListener('click', connectWallet); // Actual connect button inside modal - Now handled by handleWalletConnection
document.getElementById('closeProfileModalBtn').addEventListener('click', closeProfileModal);
document.getElementById('copyReferralLinkBtn').addEventListener('click', copyReferralLink);
document.getElementById('resetGuestProgressBtn').addEventListener('click', resetGuestProgress); // Guest Reset Button
document.getElementById('closeShopModalBtn').addEventListener('click', closeShopModal);
document.querySelectorAll('.buy-item-btn').forEach(btn => { // Event listeners for buy buttons
    btn.addEventListener('click', () => {
        buyShopItem(btn.dataset.itemId, parseFloat(btn.dataset.cost));
    });
});
document.getElementById('closeDailyBonusModalBtn').addEventListener('click', closeDailyBonusModal);
document.getElementById('claimDailyBonusBtn').addEventListener('click', claimDailyBonus);
document.getElementById('tryAgainBetBtn').addEventListener('click', tryAgainBet);
document.getElementById('cancelDoubleOrNothingBtn').addEventListener('click', closeDoubleOrNothingModal);
 // Added close button for result modal
document.getElementById('closeResultModalBtn').addEventListener('click', closeResultModal);
document.getElementById('closeShareModalBtn').addEventListener('click', closeShareModal);
document.getElementById('copyShareTextBtn').addEventListener('click', copyShareText);
document.getElementById('tweetWinBtn').addEventListener('click', tweetWin);
document.getElementById('closeMessageBoxBtn').addEventListener('click', closeMessageBox);
document.getElementById('topUpWalletBtn').addEventListener('click', topUpWallet);
 document.getElementById('resultModalSpinAgainBtn').addEventListener('click', closeResultModal); // Spin Again button in result modal
 // Added close button for refill modal
 document.getElementById('closeRefillFakeSolModalBtn').addEventListener('click', closeRefillFakeSolModal);
 document.getElementById('refillFakeSolBtn').addEventListener('click', refillFakeSol); // Refill demo SOL button
 document.getElementById('closeIdleModalBtn').addEventListener('click', closeIdleModal); // Close Idle Modal button
 // Added close button for daily reward modal
 document.getElementById('closeDailyRewardModalBtn').addEventListener('click', closeDailyRewardModal);
 document.getElementById('claimDailyRewardBtn').addEventListener('click', claimDailyReward); // Claim Daily Reward button


// Live Panel Tab Switching Functionality
const livePanelTabs = document.querySelectorAll('.live-panel-tab');
const livePanelContents = document.querySelectorAll('.live-panel-content-tab');

livePanelTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Remove active class from all tabs and content
        livePanelTabs.forEach(t => t.classList.remove('active'));
        livePanelContents.forEach(c => c.classList.remove('active'));

        // Add active class to the clicked tab and corresponding content
        tab.classList.add('active');
        const targetTabId = tab.dataset.tab;
        const targetContent = document.getElementById(`live${targetTabId.charAt(0).toUpperCase() + targetTabId.slice(1)}Content`); // e.g., liveBetsContent, liveChatContent

        if (targetContent) {
            targetContent.classList.add('active');
            // Scroll to bottom of chat when chat tab is activated
            if (targetTabId === 'chat') {
                 const chatFeed = document.getElementById('chatFeed');
                 chatFeed.scrollTop = chatFeed.scrollHeight;
                 document.getElementById('chatUnreadDot').style.display = 'none'; // Hide chat unread dot
            } else if (targetTabId === 'bets') {
                 document.getElementById('betsUnreadDot').style.display = 'none'; // Hide bets unread dot
            }
            // Hide main live panel unread dot if either tab is active
            if (document.querySelector('.live-panel-tab.active')) {
                 document.getElementById('livePanelUnreadDot').style.display = 'none';
            }
        }
         resetIdleTimer(); // Reset idle timer on tab switch
         stopAutoDemo(); // Stop auto demo on tab switch
    });
});

// Initially activate the 'Live Bets' tab
document.querySelector('.live-panel-tab[data-tab="bets"]').classList.add('active');
document.getElementById('liveBetsContent').classList.add('active');


// Add particle effects to the background overlay
function createParticle() {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = `${Math.random() * 100}vw`;
    particle.style.top = `${Math.random() * 100}vh`;
    particle.style.animationDelay = `${Math.random() * 5}s`; // Random delay
    document.getElementById('backgroundOverlay').appendChild(particle);
    // Remove particle after animation
    particle.addEventListener('animationend', () => particle.remove());
}

function spawnParticles(count) {
    for (let i = 0; i < count; i++) {
        createParticle();
    }
}

// Add money rain effect on win
function triggerMoneyRain() {
     const moneyCount = 50;
     for (let i = 0; i < moneyCount; i++) {
         const money = document.createElement('div');
         money.className = 'money-rain';
         money.style.left = `${Math.random() * 100}vw`;
         money.style.animationDelay = `${Math.random() * 0.5}s`;
         document.body.appendChild(money);
         money.addEventListener('animationend', () => money.remove());
     }
}


// Start Simulation
setInterval(updateTimer, 1000); // Update timer every second
// Simulate multiplayer activity periodically (bets for the next round)
setInterval(simulateMultiplayer, 5000); // Simulate fake bets and chat every 5 seconds
 setInterval(updateLeaderboard, 15000); // Update leaderboard every 15 seconds
 setInterval(checkLowBalance, 30000); // Check low balance every 30 seconds
 setInterval(updateFakeActivityBanner, 7000); // Update fake activity banner periodically
 setInterval(() => { // Randomly show 10x hit banner
     if (Math.random() < 0.3) { // 30% chance every 30-60 seconds
         showTenXHitBanner();
     }
 }, Math.random() * 30000 + 30000); // Between 30 and 60 seconds


// Initial setup on page load
window.onload = function() {
    setupCanvas(); // Setup canvas size and initial draw

     // Guest Mode Initialization and Onboarding
     const fakeIntroShown = localStorage.getItem('solroulette_fake_intro_shown');

     if (!user.wallet && !fakeIntroShown) {
         // First time guest user: Immediately set guest mode and balance, then show onboarding
         isGuestMode = true;
         localStorage.setItem('solroulette_is_guest', 'true');
         walletBalance = 500; // Set initial demo balance immediately
         localStorage.setItem('solroulette_guest_balance', walletBalance);

         // Initialize other guest stats if they don't exist
         if (localStorage.getItem('solroulette_guest_xp') === null) localStorage.setItem('solroulette_guest_xp', '0');
         if (localStorage.getItem('solroulette_guest_tokens') === null) localStorage.setItem('solroulette_guest_tokens', '0');
         if (localStorage.getItem('solroulette_guest_total_wagered') === null) localStorage.setItem('solroulette_guest_total_wagered', '0');
         if (localStorage.getItem('solroulette_guest_win_streak') === null) localStorage.setItem('solroulette_guest_win_streak', '0');
         if (localStorage.getItem('solroulette_guest_ten_x_wins') === null) localStorage.setItem('solroulette_guest_ten_x_wins', '0');
         if (localStorage.getItem('solroulette_guest_achievements') === null) localStorage.setItem('solroulette_guest_achievements', '[]');
         if (localStorage.getItem('solroulette_guest_spin_count') === null) localStorage.setItem('solroulette_guest_spin_count', '0');
         if (localStorage.getItem('solroulette_guest_last_login') === null) localStorage.setItem('solroulette_guest_last_login', new Date().toDateString()); // Initialize guest login date
         if (localStorage.getItem('solroulette_guest_daily_bonus_day') === null) localStorage.setItem('solroulette_guest_daily_bonus_day', '0');
         if (localStorage.getItem('solroulette_fake_winnings_total') === null) localStorage.setItem('solroulette_fake_winnings_total', '0');

         // Load guest stats after setting them
         xp = parseInt(localStorage.getItem('solroulette_guest_xp'));
         tokensEarned = parseFloat(localStorage.getItem('solroulette_guest_tokens'));
         totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered'));
         winStreak = parseInt(localStorage.getItem('solroulette_win_streak'));
         tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins'));
         achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements')));
         guestSpinCount = parseInt(localStorage.getItem('solroulette_guest_spin_count'));
         dailyBonusDay = parseInt(localStorage.getItem('solroulette_guest_daily_bonus_day'));
         fakeWinningsTotal = parseFloat(localStorage.getItem('solroulette_fake_winnings_total'));


         user.name = 'Guest'; // Ensure name is Guest
         user.avatar = '👋'; // Ensure avatar is Guest avatar
         localStorage.setItem('solroulette_user_name', user.name);
         localStorage.setItem('solroulette_user_avatar', user.avatar);


         updateUIDebounced(); // Update UI to show the initial balance and guest state
         showOnboardingModal(); // Show onboarding modal

     } else if (!user.wallet && fakeIntroShown) {
         // Returning guest user
         isGuestMode = true;
         localStorage.setItem('solroulette_is_guest', 'true');
         // Load guest stats (defaulting balance to 500 if it's 0 or null)
         walletBalance = parseFloat(localStorage.getItem('solroulette_guest_balance') || '500');
         if (walletBalance <= 0) { // Ensure balance is at least 500 for returning guests if they zeroed out
            walletBalance = 500;
            localStorage.setItem('solroulette_guest_balance', walletBalance);
         }

         xp = parseInt(localStorage.getItem('solroulette_guest_xp') || '0');
         tokensEarned = parseFloat(localStorage.getItem('solroulette_guest_tokens') || '0');
         totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered') || '0');
         winStreak = parseInt(localStorage.getItem('solroulette_win_streak') || '0');
         tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins') || '0');
         achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements') || '[]'));
         guestSpinCount = parseInt(localStorage.getItem('solroulette_guest_spin_count') || '0');
         dailyBonusDay = parseInt(localStorage.getItem('solroulette_guest_daily_bonus_day') || '0');
         fakeWinningsTotal = parseFloat(localStorage.getItem('solroulette_fake_winnings_total') || '0');


         user.name = 'Guest';
         user.avatar = '👋';
         localStorage.setItem('solroulette_user_name', user.name);
         localStorage.setItem('solroulette_user_avatar', user.avatar);

         updateUIDebounced(); // Initial UI update
         showGuestModeToast(); // Show guest mode toast on returning guest visit
         // Show onboarding tooltip if it hasn't been dismissed
         showOnboardingTooltip();
         resetIdleTimer(); // Start idle timer for returning guests


     } else {
         // Connected user
         isGuestMode = false;
         localStorage.setItem('solroulette_is_guest', 'false');
         // Load real user stats (already handled at top, but ensure consistency)
         walletBalance = parseFloat(localStorage.getItem('solroulette_wallet_balance') || '0');
         xp = parseInt(localStorage.getItem('solroulette_xp') || '0');
         tokensEarned = parseFloat(localStorage.getItem('solroulette_spin_tokens') || '0');
         totalWagered = parseFloat(localStorage.getItem('solroulette_total_wagered') || '0');
         winStreak = parseInt(localStorage.getItem('solroulette_win_streak') || '0');
         tenXWins = parseInt(localStorage.getItem('solroulette_ten_x_wins') || '0');
         achievementsUnlocked = new Set(JSON.parse(localStorage.getItem('solroulette_achievements') || '[]'));
         dailyBonusDay = parseInt(localStorage.getItem('solroulette_daily_bonus_day') || '0');

         // user.name and user.wallet are already loaded at the top
         updateUIDebounced(); // Initial UI update
         resetIdleTimer(); // Start idle timer for connected users
     }

     // Initialization on Page Load (Guest Mode)
     // Default multiplier selection and bet amount for new/returning users if not already set
     // These are now loaded from localStorage at the top.
     // Ensure the UI reflects the loaded state.
     if (currentBet.multiplier !== null) {
          const defaultMultiplierBtn = document.querySelector(`.multiplier-btn[data-multiplier="${currentBet.multiplier}"]`); // Use numeric data-multiplier
          if (defaultMultiplierBtn) {
              defaultMultiplierBtn.classList.add('active');
          }
     }
     if (currentBet.amount > 0) {
          document.getElementById('betSlider').value = currentBet.amount;
     }


     // Ensure UI is updated with the initial/loaded state
     updateUIDebounced();


    // simulateMultiplayer(); // Initial fake bets and chat messages - now handled by interval
    spawnParticles(50); // Start background particles
    checkReferralCode(); // Check for referral code in URL
    updateRecentSpinsDisplay(); // Display recent spins on load
    updateFakeActivityBanner(); // Initial fake activity banner update
    updateLeaderboard(); // Initial leaderboard population


     // Check daily bonus on load
     checkDailyBonus();

     // Start auto demo after a delay if in guest mode, no real bet placed, and idle timer is running (user hasn't interacted yet)
     // This is handled by the idle timer now. When the idle timer triggers, it checks if a modal is open.
     // If no modal is open, it shows the idle modal. If the user closes the idle modal without interacting,
     // the idle timer will reset and eventually trigger again.
     // To start auto demo after initial load inactivity, we use the idle timer's timeout.
     if (isGuestMode && !firstRealBetPlaced) {
         autoDemoTimer = setTimeout(showIdleModalOrAutoDemo, IDLE_TIMEOUT); // Use the combined function
     }

     // Start active use timer
     startActiveUseTimer();
};

// Ensure canvas resizes with window
window.addEventListener('resize', setupCanvas);
window.addEventListener('resize', checkKeyboard); // Check keyboard on resize


// Reset idle timer on user activity
document.addEventListener('mousemove', resetIdleTimer);
document.addEventListener('keypress', resetIdleTimer);
document.addEventListener('touchstart', resetIdleTimer);
document.addEventListener('click', resetIdleTimer); // Also reset on click anywhere
document.addEventListener('scroll', resetIdleTimer); // Also reset on scroll


 // Event listener for daily reward modal close and claim buttons
 document.getElementById('claimDailyRewardBtn').addEventListener('click', claimDailyReward);
 document.getElementById('dailyRewardModal').addEventListener('click', (e) => {
     if (e.target === document.getElementById('dailyRewardModal')) {
         closeDailyRewardModal();
     }
 });

 // Removed Chat Toggle Event Listener (as the separate chat bubble is removed)

 // Live Panel Toggle Logic
 document.getElementById('toggleLivePanel').addEventListener('click', function() {
     const livePanelContainer = document.getElementById('livePanelContainer');
     const toggleBtn = document.getElementById('toggleLivePanel');
     const icon = toggleBtn.querySelector('i');

     // Toggle the 'active' class
     livePanelContainer.classList.toggle('active');

     // Change arrow direction based on 'active' class
     if (livePanelContainer.classList.contains('active')) {
         icon.classList.remove('fa-chevron-left');
         icon.classList.add('fa-chevron-right'); // Arrow points right when panel is open (pushed left)
         // Hide unread dots when panel is opened
         document.getElementById('livePanelUnreadDot').style.display = 'none';
         document.getElementById('betsUnreadDot').style.display = 'none';
         document.getElementById('chatUnreadDot').style.display = 'none';
     } else {
         icon.classList.remove('fa-chevron-right');
         icon.classList.add('fa-chevron-left'); // Arrow points left when panel is closed (on the right)
     }
     resetIdleTimer(); // Reset idle timer on panel toggle
     stopAutoDemo(); // Stop auto demo on panel toggle
 });

 // Event listener for Send Chat button (moved from general listeners)
 document.getElementById('sendChatBtn').addEventListener('click', sendChat);

// Collapse Multiplier Options on Spin
document.getElementById('rouletteCanvas').addEventListener('spinstart', () => {
    const multiplierOptions = document.getElementById('multiplierOptions');
    multiplierOptions.style.display = 'none';
    // Show multiplier options again after 4 seconds
    setTimeout(() => {
        multiplierOptions.style.display = 'grid';
    }, 4000);
});
