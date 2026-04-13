const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// የጨዋታ ሁኔታ (ለሁሉም ተጫዋቾች አንድ ነው)
let gameState = {
    isRunning: false,
    multiplier: 1.00,
    crashPoint: null,
    nextCrash: null,
    timer: null,
    history: []
};

// ክራሽ ነጥብ ማመንጫ (20% እድል 1.00x ላይ ክራሽ)
function generateCrashPoint() {
    if (Math.random() < 0.20) return 1.00;
    return 1.05 + Math.random() * 3.5;
}

// አዲስ ዙር መጀመር
function startNewRound() {
    if (gameState.timer) clearInterval(gameState.timer);
    const newCrash = gameState.nextCrash || generateCrashPoint();
    gameState.nextCrash = null;
    gameState.crashPoint = newCrash;
    gameState.multiplier = 1.00;
    gameState.isRunning = true;
    
    io.emit('round_start', { multiplier: 1.00, crashPoint: newCrash });
    
    let startTime = Date.now();
    gameState.timer = setInterval(() => {
        if (!gameState.isRunning) return;
        let elapsed = (Date.now() - startTime) / 1000;
        let mult = 1.00 + (elapsed * 0.8);
        if (mult > 10) mult = 10;
        gameState.multiplier = parseFloat(mult.toFixed(2));
        io.emit('multiplier_update', gameState.multiplier);
        
        if (gameState.multiplier >= gameState.crashPoint) {
            clearInterval(gameState.timer);
            gameState.isRunning = false;
            io.emit('crash', { multiplier: gameState.multiplier, crashPoint: gameState.crashPoint });
            gameState.history.unshift(gameState.crashPoint);
            if (gameState.history.length > 20) gameState.history.pop();
            setTimeout(() => startNewRound(), 4000);
        }
    }, 50);
}

// Socket.io ግንኙነቶች
io.on('connection', (socket) => {
    console.log('ተጫዋች ተገናኘ:', socket.id);
    
    // አሁን ያለውን ሁኔታ ላክ
    socket.emit('current_state', {
        isRunning: gameState.isRunning,
        multiplier: gameState.multiplier,
        crashPoint: gameState.crashPoint,
        history: gameState.history
    });
    
    // አድሚን ቀጣይ ክራሽ ማዘጋጀት (ለሙከራ ቀላል ሚስጥር ቃል)
    socket.on('admin_force_crash', (data) => {
        if (data.secret === 'admin123' && data.crashPoint > 1.00 && data.crashPoint <= 10) {
            gameState.nextCrash = data.crashPoint;
            io.emit('admin_message', `⚡ አድሚን ቀጣዩን ክራሽ በ ${data.crashPoint}x ላይ አዘጋጅቷል`);
        }
    });
});

// የማይንቀሳቀሱ ፋይሎችን አገልግል
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌍 World Game ሰርቨር በ ፖርት ${PORT} ላይ ተጀምሯል`);
    startNewRound();
});
