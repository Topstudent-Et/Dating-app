const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, '/')));

// የሲስተሙ ዋና ዳታ (በMemory ውስጥ የሚቀመጥ)
let state = {
    mult: 1.0,
    isRun: false,
    bankInfo: { name: "ንግድ ባንክ (CBE)", acc: "1000179571815" },
    activeBets: [],
    requests: [], // ለዲፖዚት እና ዊዝድሮው
    totals: { deposit: 0, withdraw: 0, profit: 0 },
    forceCrashNow: false,
    history: []
};

function gameLoop() {
    state.isRun = true;
    state.mult = 1.0;
    state.activeBets = [];
    
    // 20% ትርፍ ለማስጠበቅ እና በአድሚን ለማዘዝ
    let target = state.forceCrashNow ? 1.00 : (Math.random() < 0.15 ? 1.00 : (1.05 + Math.random() * 4).toFixed(2));
    state.forceCrashNow = false;

    let timer = setInterval(() => {
        state.mult += 0.01 * (state.mult / 1.2);
        io.emit('tick', { mult: state.mult.toFixed(2) });

        if (state.forceCrashNow || state.mult >= target) {
            clearInterval(timer);
            state.isRun = false;
            state.forceCrashNow = false;
            io.emit('crash', { point: state.mult.toFixed(2) });
            state.history.unshift(state.mult.toFixed(2));
            if(state.history.length > 15) state.history.pop();
            setTimeout(gameLoop, 5000); // 5 ሰከንድ እረፍት
        }
    }, 100);
}

io.on('connection', (socket) => {
    // ተጫዋቹ ሲገባ ያለውን መረጃ ይልካል
    socket.emit('init', state);

    // ተጫዋች ሲወራረድ
    socket.on('placeBet', (data) => {
        state.activeBets.push({...data, id: socket.id});
        io.emit('updateBets', state.activeBets);
    });

    // አድሚን ትዕዛዝ ሲሰጥ
    socket.on('adminAction', (data) => {
        if(data.type === 'CRASH_NOW') state.forceCrashNow = true;
        if(data.type === 'SET_BANK') {
            state.bankInfo = data.val;
            io.emit('bankUpdate', state.bankInfo);
        }
    });

    // ዲፖዚት እና ዊዝድሮው ጥያቄዎች
    socket.on('newRequest', (req) => {
        state.requests.push(req);
        io.emit('adminInbox', state.requests);
    });

    socket.on('approveReq', (index) => {
        let req = state.requests[index];
        if(req && req.type === 'DEP') state.totals.deposit += req.amt;
        if(req && req.type === 'WIT') state.totals.withdraw += req.amt;
        state.requests.splice(index, 1);
        io.emit('adminInbox', state.requests);
    });
});

gameLoop();
server.listen(process.env.PORT || 3000, () => console.log('Server running on @world_all_gamesbot Engine'));
