const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

app.use(express.static(path.join(__dirname, 'public')));

// Game state
let gameActive = false;
let currentMultiplier = 1.00;
let crashPoint = 1.00;
let gameInterval = null;
let countdown = 5;
let countdownInterval = null;
let totalRealPool = 0;      // ጠቅላላ የሪል ውርርድ ገንዘብ
let totalPayout = 0;        // ተጫዋቾች ያወጡት ጠቅላላ ገንዘብ
let players = new Map();     // socket.id -> { realBet, betAmount, autoCash, username }

// Admin profit (20% of total pool at crash)
let adminProfit = 0;

function broadcast(event, data) {
    io.emit(event, data);
}

function resetRound() {
    totalRealPool = 0;
    totalPayout = 0;
    for (let [id, p] of players.entries()) {
        p.realBet = false;
        p.betAmount = 0;
        p.autoCash = 0;
    }
}

function startCountdown() {
    countdown = 5;
    broadcast('countdown', { seconds: countdown });
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown >= 0) {
            broadcast('countdown', { seconds: countdown });
        }
        if (countdown < 0) {
            clearInterval(countdownInterval);
            startGame();
        }
    }, 1000);
}

function startGame() {
    gameActive = true;
    currentMultiplier = 1.00;
    // ክራሽ ነጥብ በዘፈቀደ (1.2 - 20)
    crashPoint = 1.2 + Math.random() * 15;
    if (crashPoint > 20) crashPoint = 20;
    crashPoint = parseFloat(crashPoint.toFixed(2));
    
    broadcast('game_start', { crashPoint });
    
    gameInterval = setInterval(() => {
        if (!gameActive) return;
        currentMultiplier += 0.02;
        broadcast('multiplier_update', { multiplier: currentMultiplier });
        
        // አውቶ ካሽ አውት ለእያንዳንዱ ተጫዋች
        for (let [socketId, p] of players.entries()) {
            if (p.realBet && p.autoCash > 0 && currentMultiplier >= p.autoCash) {
                const win = p.betAmount * currentMultiplier;
                totalPayout += win;
                io.to(socketId).emit('force_cashout', { winAmount: win, multiplier: currentMultiplier });
                p.realBet = false;
                broadcast('player_win', { username: p.username, amount: win });
            }
        }
        
        // የ20% ትርፍ ማረጋገጫ – ክፍያ ከ80% በላይ ከሆነ ክራሽ አድርግ
        if (totalRealPool > 0 && totalPayout >= totalRealPool * 0.8) {
            crash();
        } else if (currentMultiplier >= crashPoint) {
            crash();
        }
    }, 50);
}

function crash() {
    gameActive = false;
    clearInterval(gameInterval);
    
    // የአድሚን ትርፍ = 20% ከጠቅላላው ሪል ገንዳ
    const profit = totalRealPool * 0.2;
    adminProfit += profit;
    console.log(`Round crashed. Admin profit: ${profit} ETB. Total admin profit: ${adminProfit}`);
    
    broadcast('game_crash', { crashPoint });
    
    setTimeout(() => {
        resetRound();
        startCountdown();
    }, 3000);
}

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New client:', socket.id);
    let username = 'Guest';
    
    // Get user info from client
    socket.on('register', (data) => {
        username = data.username;
        players.set(socket.id, { realBet: false, betAmount: 0, autoCash: 0, username });
        socket.emit('registered', { success: true });
    });
    
    // Send current game state
    if (gameActive) {
        socket.emit('game_start', { crashPoint });
        socket.emit('multiplier_update', { multiplier: currentMultiplier });
    } else if (countdownInterval) {
        socket.emit('countdown', { seconds: countdown });
    }
    
    // Place bet
    socket.on('place_bet', (data) => {
        const { amount, isRealMode } = data;
        const player = players.get(socket.id);
        if (!player) return;
        if (isRealMode && !player.realBet) {
            player.realBet = true;
            player.betAmount = amount;
            totalRealPool += amount;
        }
        socket.emit('bet_confirmed', { success: true, amount });
    });
    
    // Set auto cashout
    socket.on('set_auto_cash', (data) => {
        const player = players.get(socket.id);
        if (player) player.autoCash = data.multiplier;
    });
    
    // Manual cashout
    socket.on('cashout_request', () => {
        if (!gameActive) return;
        const player = players.get(socket.id);
        if (player && player.realBet) {
            const win = player.betAmount * currentMultiplier;
            totalPayout += win;
            socket.emit('cashout_result', { won: win, multiplier: currentMultiplier });
            player.realBet = false;
            broadcast('player_win', { username: player.username, amount: win });
        }
    });
    
    socket.on('disconnect', () => {
        const player = players.get(socket.id);
        if (player && player.realBet) {
            totalRealPool -= player.betAmount;
        }
        players.delete(socket.id);
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
