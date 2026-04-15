const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// ------------------ ውሂብ ------------------
let users = {};          // { userId: { name, bal, games, totalDeposited, totalWithdrawn } }
let pendingRequests = []; // { id, userId, type, amt, ref, name }
let bankInfo = { name: "CBE Bank", acc: "1000179571815" };
const adminIds = [777, 123456]; // የአስተዳዳሪ ቴሌግራም አይዲ

// ጨዋታ ሁኔታ (የሰዓት መርሐግብር)
let gameStatus = 'waiting'; // 'waiting', 'playing'
let nextRoundTime = null;   // ቀጣዩ ዙር የሚጀመርበት ጊዜ (milliseconds)
let currentMultiplier = 1.00;
let crashPoint = 1.00;
let roundBets = [];          // { socketId, userId, amount }
let roundActive = false;
let timerInterval = null;
let countdownInterval = null;

// የ20% ትርፍ ተግባር -> አሸናፊ የሚያገኘው ገንዘብ 80% ብቻ ነው
const HOUSE_COMMISSION = 0.20; // 20%

function getNextHourTimestamp() {
    const now = Date.now();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour.getTime();
}

// የዘፈቀደ ክራሽ ነጥብ (ምንም ተጨማሪ ትርፍ አያስፈልግም ምክንያቱም ኮሚሽኑ ከአሸናፊዎች ላይ ይቀንሳል)
function generateCrashPoint() {
    let r = Math.random();
    let point = Math.max(1.05, 0.98 / (1 - r));
    return Math.floor(point * 100) / 100;
}

async function startRound() {
    if (roundActive) return;
    roundActive = true;
    gameStatus = 'playing';
    currentMultiplier = 1.00;
    crashPoint = generateCrashPoint();

    // ለሁሉም ክራሽ ነጥብ እና ጅምር ማሳወቅ
    io.emit('round_start', { crashPoint, startMult: 1.00 });

    // በየ0.1 ሰከንድ ማባዣ መጨመር
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!roundActive) return;
        currentMultiplier = parseFloat((currentMultiplier + 0.02).toFixed(2));
        if (currentMultiplier >= crashPoint) {
            endRound();
        } else {
            io.emit('tick', { mult: currentMultiplier.toFixed(2) });
        }
    }, 100);
}

function endRound() {
    if (!roundActive) return;
    roundActive = false;
    gameStatus = 'waiting';
    clearInterval(timerInterval);

    io.emit('crash', { point: crashPoint.toFixed(2) });

    // ማንም ያልተወጡ ውርርዶች ይሰረዛሉ (ተጫዋቾች አያጡም ምክንያቱም ቀድሞ ገንዘባቸው ተቀንሷል)
    // ግን ለማጣራት ከሆነ ውርርዱ እንደ ተሸናፊ ይቆጠራል (ገንዘብ አይመለስም)
    roundBets = [];

    // ቀጣዩን ዙር ለማቀድ
    scheduleNextRound();
}

function scheduleNextRound() {
    const now = Date.now();
    let nextTime = getNextHourTimestamp();
    if (nextTime <= now) nextTime = getNextHourTimestamp() + 3600000;

    nextRoundTime = nextTime;
    const waitMs = nextTime - now;
    const waitSeconds = Math.floor(waitMs / 1000);

    io.emit('next_round_time', { seconds: waitSeconds, time: nextTime });

    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((nextRoundTime - Date.now()) / 1000));
        io.emit('countdown', remaining);
        if (remaining <= 0 && !roundActive) {
            clearInterval(countdownInterval);
            startRound();
        }
    }, 1000);
}

// መጀመሪያ ላይ ቀጣዩን ዙር ማቀድ
scheduleNextRound();

// ------------------ ሶኬት አያያዝ ------------------
io.on('connection', (socket) => {
    console.log('New client:', socket.id);

    socket.on('init', (userData) => {
        const uid = userData.id;
        if (!users[uid]) {
            users[uid] = {
                name: userData.first_name || "Player",
                bal: 100.0,
                games: 0,
                totalDeposited: 0,
                totalWithdrawn: 0,
            };
        }
        socket.userId = uid;
        socket.emit('balance', { bal: users[uid].bal, games: users[uid].games });
        socket.emit('bankInfo', bankInfo);
        sendTopList(socket);
        // የወቅቱን ጨዋታ ሁኔታ ላክ
        if (gameStatus === 'playing') {
            socket.emit('round_start', { crashPoint, startMult: currentMultiplier });
            socket.emit('tick', { mult: currentMultiplier.toFixed(2) });
        } else if (nextRoundTime) {
            const remaining = Math.max(0, Math.floor((nextRoundTime - Date.now()) / 1000));
            socket.emit('next_round_time', { seconds: remaining, time: nextRoundTime });
            socket.emit('countdown', remaining);
        }
    });

    socket.on('placeBet', ({ amount }) => {
        if (gameStatus !== 'waiting') {
            return socket.emit('error', 'ውርርድ ማድረግ የሚቻለው ከጨዋታ በፊት ባለው የመጠባበቂያ ጊዜ ብቻ ነው');
        }
        const user = users[socket.userId];
        if (!user || user.bal < amount) return socket.emit('error', 'በቂ ገንዘብ የለም');
        user.bal -= amount;
        user.games++;
        roundBets.push({ socketId: socket.id, userId: socket.userId, amount });
        io.to(socket.id).emit('balance', { bal: user.bal, games: user.games });
    });

    socket.on('cashOut', () => {
        if (gameStatus !== 'playing') return socket.emit('error', 'ጨዋታ በሂደት ላይ አይደለም');
        const betIndex = roundBets.findIndex(b => b.socketId === socket.id);
        if (betIndex === -1) return;
        const bet = roundBets[betIndex];
        const rawWin = bet.amount * currentMultiplier;
        const winAfterCommission = rawWin * (1 - HOUSE_COMMISSION); // 20% ተቀንሷል
        const user = users[bet.userId];
        user.bal += winAfterCommission;
        roundBets.splice(betIndex, 1);
        io.to(socket.id).emit('balance', { bal: user.bal, games: user.games });
        socket.emit('win', { amount: winAfterCommission, mult: currentMultiplier, commission: HOUSE_COMMISSION * 100 });
    });

    socket.on('newRequest', ({ type, amt, ref }) => {
        const user = users[socket.userId];
        if (!user) return;
        pendingRequests.push({
            id: Date.now(),
            userId: socket.userId,
            name: user.name,
            type,
            amt: parseFloat(amt),
            ref,
            status: 'pending'
        });
        io.emit('adminData', { totalIn: getTotalDeposits(), profit: getProfit(), reqs: pendingRequests });
    });

    socket.on('approveReq', (reqId) => {
        if (!adminIds.includes(socket.userId)) return;
        const req = pendingRequests.find(r => r.id == reqId);
        if (!req) return;
        const user = users[req.userId];
        if (req.type === 'DEP') {
            user.bal += req.amt;
            user.totalDeposited += req.amt;
        } else if (req.type === 'WIT') {
            if (user.bal >= req.amt) {
                user.bal -= req.amt;
                user.totalWithdrawn += req.amt;
            } else return;
        }
        req.status = 'completed';
        pendingRequests = pendingRequests.filter(r => r.id != reqId);
        io.to(req.userId).emit('balance', { bal: user.bal, games: user.games });
        io.emit('adminData', { totalIn: getTotalDeposits(), profit: getProfit(), reqs: pendingRequests });
    });

    socket.on('rejectReq', (reqId) => {
        if (!adminIds.includes(socket.userId)) return;
        pendingRequests = pendingRequests.filter(r => r.id != reqId);
        io.emit('adminData', { totalIn: getTotalDeposits(), profit: getProfit(), reqs: pendingRequests });
    });

    socket.on('updateBank', ({ name, acc }) => {
        if (!adminIds.includes(socket.userId)) return;
        bankInfo = { name, acc };
        io.emit('bankInfo', bankInfo);
    });

    socket.on('setForce', (point) => {
        if (!adminIds.includes(socket.userId)) return;
        if (gameStatus === 'playing') {
            crashPoint = parseFloat(point);
            endRound();
        }
    });

    socket.on('disconnect', () => {
        // ተጫዋች ቢቋረጥ ውርርዱ እንዳለ ይቀራል (አይመለስም)
    });
});

function getTotalDeposits() {
    let total = 0;
    for (let id in users) total += users[id].totalDeposited;
    return total;
}
function getProfit() {
    return getTotalDeposits() * HOUSE_COMMISSION;
}
function sendTopList(socket) {
    let top = Object.values(users).sort((a,b) => b.bal - a.bal).slice(0,50);
    socket.emit('topList', top);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
