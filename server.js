const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '/')));

let state = {
    mult: 1.0,
    isRun: false,
    startTime: null,
    history: [],
    bankInfo: { name: "CBE - Dawit F.", acc: "1000179571815" },
    activeBets: [],
    requests: [],
    totals: { deposit: 0, withdraw: 0, profit: 0 },
    forceCrashNow: false,
    nextCrashPoint: null
};

function gameLoop() {
    state.isRun = true;
    state.mult = 1.0;
    state.startTime = Date.now();
    state.activeBets = [];
    
    // 20% ትርፍ ለማስጠበቅ የሚደረግ ስሌት
    let target = state.nextCrashPoint || (Math.random() < 0.2 ? 1.00 : (1.05 + Math.random() * 4).toFixed(2));
    state.nextCrashPoint = null;

    let timer = setInterval(() => {
        state.mult += 0.01 * (state.mult / 1.5);
        io.emit('tick', { mult: state.mult.toFixed(2), bets: state.activeBets });

        // አድሚን "ክራሽ አድርግ" ካለ ወይም የታለመው ነጥብ ላይ ከደረሰ
        if (state.forceCrashNow || state.mult >= target) {
            clearInterval(timer);
            state.isRun = false;
            state.forceCrashNow = false;
            io.emit('crash', { point: state.mult.toFixed(2) });
            state.history.unshift(state.mult.toFixed(2));
            if(state.history.length > 10) state.history.pop();
            setTimeout(gameLoop, 5000); // 5 ሴኮንድ እረፍት
        }
    }, 100);
}

io.on('connection', (socket) => {
    socket.emit('init', state);

    socket.on('placeBet', (data) => {
        if(!state.isRun || state.mult < 1.05) {
            state.activeBets.push({...data, socketId: socket.id});
            io.emit('updateBets', state.activeBets);
        }
    });

    socket.on('adminAction', (data) => {
        if(data.type === 'CRASH_NOW') state.forceCrashNow = true;
        if(data.type === 'SET_BANK') { state.bankInfo = data.val; io.emit('bankUpdate', state.bankInfo); }
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
        io.emit('statsUpdate', state.totals);
    });
});

gameLoop();
server.listen(process.env.PORT || 3000);
