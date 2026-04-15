const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '/')));

// የጋራ መረጃዎች (Global State)
let gameState = {
    mult: 1.0,
    isRun: false,
    bankInfo: { name: "CBE - Dawit F.", acc: "1000179571815" },
    adminRequests: [],
    forceNext: null,
    totalIn: 0
};

function startNewRound() {
    gameState.isRun = true;
    gameState.mult = 1.0;
    
    // 20% ትርፍ ስሌት
    let crashPoint = gameState.forceNext || (Math.random() < 0.2 ? 1.00 : (1.01 + Math.random() * 5.0).toFixed(2));
    gameState.forceNext = null;

    let loop = setInterval(() => {
        gameState.mult += 0.01 * (gameState.mult / 2);
        io.emit('tick', { mult: gameState.mult.toFixed(2) });

        if (gameState.mult >= crashPoint) {
            clearInterval(loop);
            gameState.isRun = false;
            io.emit('crash', { point: gameState.mult.toFixed(2) });
            setTimeout(startNewRound, 5000); // 5 ሴኮንድ እረፍት
        }
    }, 100);
}

io.on('connection', (socket) => {
    // አዲስ ሰው ሲገባ የባንክ መረጃ እና ያለውን ሁኔታ መላክ
    socket.emit('init', gameState);

    // አድሚን የባንክ ቁጥር ሲቀይር ለሁሉም መላክ
    socket.on('updateBank', (data) => {
        gameState.bankInfo = data;
        io.emit('bankChanged', data);
    });

    // የዲፖዚት ጥያቄ ለአድሚን መላክ
    socket.on('newRequest', (req) => {
        gameState.adminRequests.push(req);
        io.emit('updateAdminBox', gameState.adminRequests);
    });

    // Force Crash ትእዛዝ
    socket.on('setForce', (val) => {
        gameState.forceNext = val;
    });
});

startNewRound();
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
