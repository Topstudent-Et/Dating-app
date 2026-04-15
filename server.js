const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '/')));

// የሲስተሙ ዋና ዳታ (Database)
let state = {
    mult: 1.0,
    isRun: false,
    bankInfo: { name: "CBE - Dawit F.", acc: "1000179571815" },
    activeBets: [],
    requests: [],
    totals: { deposit: 0, withdraw: 0, profit: 0 },
    forceCrashNow: false,
    history: []
};

function gameLoop() {
    state.isRun = true;
    state.mult = 1.0;
    state.activeBets = [];
    
    // 20% ትርፍ ለማስጠበቅ የሚደረግ የክራሽ ነጥብ ስሌት
    let target = state.forceCrashNow ? 1.00 : (Math.random() < 0.2 ? 1.00 : (1.05 + Math.random() * 5).toFixed(2));
    state.forceCrashNow = false;

    let timer = setInterval(() => {
        state.mult += 0.01 * (state.mult / 1.5);
        io.emit('tick', { mult: state.mult.toFixed(2) });

        if (state.forceCrashNow || state.mult >= target) {
            clearInterval(timer);
            state.isRun = false;
            state.forceCrashNow = false;
            io.emit('crash', { point: state.mult.toFixed(2) });
            state.history.unshift(state.mult.toFixed(2));
            if(state.history.length > 10) state.history.pop();
            setTimeout(gameLoop, 4000); // 4 ሰከንድ እረፍት
        }
    }, 100);
}

io.on('connection', (socket) => {
    socket.emit('init', state);

    socket.on('placeBet', (data) => {
        state.activeBets.push(data);
        io.emit('updateBets', state.activeBets);
    });

    socket.on('adminAction', (data) => {
        if(data.type === 'CRASH_NOW') state.forceCrashNow = true;
        if(data.type === 'SET_BANK') {
            state.bankInfo = data.val;
            io.emit('bankUpdate', state.bankInfo);
        }
    });

    socket.on('newRequest', (req) => {
        state.requests.push(req);
        io.emit('adminInbox', state.requests);
    });

    socket.on('approveReq', (index) => {
        let req = state.requests[index];
        if(req.type === 'DEP') state.totals.deposit += req.amt;
        state.requests.splice(index, 1);
        io.emit('adminInbox', state.requests);
    });
});

gameLoop();
server.listen(process.env.PORT || 3000);
