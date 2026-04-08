// ==================== SOUND EFFECTS ====================
function playSound(type) {
    try {
        let audio = new Audio(`sounds/${type}.mp3`);
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio error:', e));
    } catch(e) {}
}

// ==================== TELEGRAM & USER DATA ====================
const tg = window.Telegram.WebApp;
tg.expand();
tg.enableClosingConfirmation();

const tgUser = tg.initDataUnsafe?.user;
let userId = tgUser ? tgUser.id : 'guest_' + Date.now();
let username = tgUser ? (tgUser.username || tgUser.first_name || 'User') : 'Guest';
let photoUrl = tgUser?.photo_url || null;

const storageKeys = {
    realBalance: `avia_real_balance_${userId}`,
    demoBalance: `avia_demo_balance_${userId}`,
    totalWon: `avia_total_won_${userId}`,
    totalGames: `avia_total_games_${userId}`,
    referralCount: `avia_referral_count_${userId}`,
    gameHistory: `game_history_${userId}`,
    transactions: `user_transactions_${userId}`
};

let user = {
    id: userId,
    username: username,
    photoUrl: photoUrl,
    realBalance: parseFloat(localStorage.getItem(storageKeys.realBalance)) || 100,
    demoBalance: parseFloat(localStorage.getItem(storageKeys.demoBalance)) || 1000,
    totalWon: parseFloat(localStorage.getItem(storageKeys.totalWon)) || 0,
    totalGames: parseInt(localStorage.getItem(storageKeys.totalGames)) || 0,
    referralCount: parseInt(localStorage.getItem(storageKeys.referralCount)) || 0
};

const AUTHORIZED_ADMIN = "Dawit_Fikadu21";
let adminData = {
    totalDeposit: parseFloat(localStorage.getItem('admin_total_deposit')) || 0,
    totalWithdraw: parseFloat(localStorage.getItem('admin_total_withdraw')) || 0,
    adminProfit: parseFloat(localStorage.getItem('admin_profit')) || 0,
    pendingTransactions: JSON.parse(localStorage.getItem('admin_pending_tx')) || []
};

let gameHistory = JSON.parse(localStorage.getItem(storageKeys.gameHistory)) || [];
let transactions = JSON.parse(localStorage.getItem(storageKeys.transactions)) || [];

let isRealMode = true;
let gameActive = false;
let currentMultiplier = 1.00;
let crashPoint = 0;
let gameInterval = null;
let countdownInterval = null;
let isCountdownActive = false;

let bets = { 1: { active: false, amount: 10, autoCash: 0 }, 2: { active: false, amount: 10, autoCash: 0 } };

// UI updates
document.getElementById('userName').innerHTML = '@' + user.username;
document.getElementById('profileName').innerHTML = '@' + user.username;
if (photoUrl) {
    document.getElementById('avatarImg').src = photoUrl;
    document.getElementById('avatarImg').style.display = 'block';
    document.getElementById('avatarPlaceholder').style.display = 'none';
    document.getElementById('profileAvatarImg').src = photoUrl;
    document.getElementById('profileAvatarImg').style.display = 'block';
    document.getElementById('profileAvatarPlaceholder').style.display = 'none';
}

const isAdmin = (user.username === AUTHORIZED_ADMIN);
if (isAdmin) {
    document.getElementById('adminPanel').classList.remove('hidden');
    updateAdminDisplay();
}

// Referral
const urlParams = new URLSearchParams(window.location.search);
const referrer = urlParams.get('ref');
if (referrer && !localStorage.getItem(`referred_${userId}`)) {
    localStorage.setItem(`referred_${userId}`, 'true');
    if (isRealMode) {
        user.realBalance += 5;
        localStorage.setItem(storageKeys.realBalance, user.realBalance);
        showToast(`🎉 Invited by ${referrer}! +5 ETB bonus`);
    }
}
const botUsername = 'world_all_gamesbot';
const referralLink = `https://t.me/${botUsername}?start=ref_${user.username}`;
document.getElementById('referralLinkInput').value = referralLink;

// ==================== GAME MECHANICS ====================
function startCountdown() {
    if (isCountdownActive) return;
    isCountdownActive = true;
    let timeLeft = 5;
    const overlay = document.getElementById('countdownOverlay');
    const numberSpan = document.getElementById('countdownNumber');
    overlay.classList.remove('hidden');
    const updateCountdown = () => {
        numberSpan.innerText = timeLeft;
        if (timeLeft === 0) {
            clearInterval(countdownInterval);
            overlay.classList.add('hidden');
            isCountdownActive = false;
            startGame();
        } else {
            timeLeft--;
        }
    };
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

function startGame() {
    gameActive = true;
    currentMultiplier = 1.00;
    crashPoint = 1.1 + (Math.random() * 10);
    if (crashPoint > 50) crashPoint = 50;

    const path = document.getElementById('gamePath');
    path.classList.remove('trail-real', 'trail-demo');
    path.classList.add(isRealMode ? 'trail-real' : 'trail-demo');

    if (isRealMode) {
        let totalRealBet = 0;
        if (bets[1].active) totalRealBet += bets[1].amount;
        if (bets[2].active) totalRealBet += bets[2].amount;
        if (totalRealBet > 0) {
            const profit = totalRealBet * 0.2;
            adminData.adminProfit += profit;
            localStorage.setItem('admin_profit', adminData.adminProfit);
            if (isAdmin) updateAdminDisplay();
        }
    }

    updateMultiplierDisplay();
    gameInterval = setInterval(() => {
        if (!gameActive) return;
        currentMultiplier += 0.02;
        updateMultiplierDisplay();
        animatePlane();
        for (let i = 1; i <= 2; i++) {
            if (bets[i].active && bets[i].autoCash > 0 && currentMultiplier >= bets[i].autoCash) {
                cashOut(i);
            }
        }
        if (currentMultiplier >= crashPoint) crash();
    }, 50);
}

function updateMultiplierDisplay() {
    document.getElementById('multiplierText').innerHTML = `<span class="font-game text-7xl font-black italic drop-shadow-lg">${currentMultiplier.toFixed(2)}x</span>`;
}

function animatePlane() {
    const progress = Math.min(currentMultiplier / crashPoint, 1);
    const x = progress * 280;
    const y = progress * 200;
    document.getElementById('plane').style.transform = `translate(${x}px, -${y}px) rotate(-20deg)`;
    document.getElementById('gamePath').setAttribute('d', `M 0 250 Q ${x/2} ${250-y} ${x+15} ${250-y-15}`);
}

function cashOut(slotId) {
    if (!bets[slotId].active || !gameActive) return;
    const winAmount = bets[slotId].amount * currentMultiplier;
    if (isRealMode) {
        user.realBalance += winAmount;
        user.totalWon += winAmount;
        localStorage.setItem(storageKeys.realBalance, user.realBalance);
        localStorage.setItem(storageKeys.totalWon, user.totalWon);
    } else {
        user.demoBalance += winAmount;
        localStorage.setItem(storageKeys.demoBalance, user.demoBalance);
    }
    user.totalGames++;
    localStorage.setItem(storageKeys.totalGames, user.totalGames);
    bets[slotId].active = false;
    updateBalanceDisplay();
    updateBetButton(slotId);
    addLiveFeed(user.username, winAmount);
    showToast(`🎉 You won! ${winAmount.toFixed(0)} ETB (${currentMultiplier.toFixed(2)}x)`);
    playSound('win');
    vibrate(100);
}

function crash() {
    gameActive = false;
    clearInterval(gameInterval);
    document.getElementById('multiplierText').innerHTML = `<span class="font-game text-5xl font-black text-red-500">💥 CRASHED</span>`;
    for (let i = 1; i <= 2; i++) {
        if (bets[i].active) {
            bets[i].active = false;
            updateBetButton(i);
        }
    }
    gameHistory.unshift({ multiplier: crashPoint.toFixed(2), timestamp: Date.now() });
    if (gameHistory.length > 20) gameHistory.pop();
    localStorage.setItem(storageKeys.gameHistory, JSON.stringify(gameHistory));
    updateHistoryDisplay();
    playSound('crash');
    vibrate(300);
    setTimeout(() => {
        resetGame();
        startCountdown();
    }, 3000);
}

function resetGame() {
    document.getElementById('plane').style.transform = 'translate(0px, 0px) rotate(-20deg)';
    document.getElementById('gamePath').setAttribute('d', 'M 0 250 Q 0 250 0 250');
    currentMultiplier = 1.00;
    gameActive = false;
}

function handleBet(slotId) {
    if (gameActive) {
        cashOut(slotId);
        return;
    }
    const balance = isRealMode ? user.realBalance : user.demoBalance;
    if (bets[slotId].amount > balance) {
        showToast('❌ Insufficient balance!');
        return;
    }
    if (isRealMode) {
        user.realBalance -= bets[slotId].amount;
        localStorage.setItem(storageKeys.realBalance, user.realBalance);
    } else {
        user.demoBalance -= bets[slotId].amount;
        localStorage.setItem(storageKeys.demoBalance, user.demoBalance);
    }
    bets[slotId].active = true;
    updateBalanceDisplay();
    updateBetButton(slotId);
    showToast(`✅ ${bets[slotId].amount} ETB bet placed`);
    playSound('bet');
}

// ==================== UI HELPERS ====================
function updateBalanceDisplay() {
    const balance = isRealMode ? user.realBalance : user.demoBalance;
    document.getElementById('balanceDisplay').innerHTML = balance.toFixed(2) + ' ETB';
    document.getElementById('profileBalance').innerHTML = balance.toFixed(2) + ' ETB';
    document.getElementById('totalGames').innerHTML = user.totalGames;
    document.getElementById('totalWon').innerHTML = user.totalWon.toFixed(0) + ' ETB';
}

function updateBetButton(slotId) {
    const btn = document.getElementById(`betBtn${slotId}`);
    if (bets[slotId].active) {
        btn.innerHTML = 'CASH OUT';
        btn.className = 'bet-btn cashout px-6';
    } else {
        btn.innerHTML = 'BET';
        btn.className = 'bet-btn px-6';
    }
}

function updateHistoryDisplay() {
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    gameHistory.slice(0, 12).forEach(h => {
        const isHigh = parseFloat(h.multiplier) > 3;
        container.innerHTML += `<div class="px-3 py-1.5 rounded-full text-[10px] font-bold ${isHigh ? 'bg-purple-600' : 'bg-zinc-800'}">${h.multiplier}x</div>`;
    });
}

function addLiveFeed(username, amount) {
    const container = document.getElementById('liveFeedContainer');
    const item = document.createElement('div');
    item.className = 'flex justify-between items-center p-2 rounded-xl bg-white/5';
    item.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid fa-trophy text-yellow-500 text-xs"></i><span class="text-xs font-bold">@${username}</span></div><div class="text-green-400 font-bold text-sm">+${amount.toFixed(0)} ETB</div>`;
    container.prepend(item);
    if (container.children.length > 8) container.removeChild(container.lastChild);
}

// ==================== BET CONTROLS ====================
function setBetAmount(slotId, amount) {
    bets[slotId].amount = amount;
    for (let a of [10, 50, 100, 500]) {
        const btn = document.getElementById(`betAmount${slotId}_${a}`);
        if (btn) btn.classList.remove('green-active');
    }
    const selectedBtn = document.getElementById(`betAmount${slotId}_${amount}`);
    if (selectedBtn) selectedBtn.classList.add('green-active');
    showToast(`Bet: ${amount} ETB`);
}

function setAutoCash(slotId, multiplier) {
    bets[slotId].autoCash = multiplier;
    document.getElementById(`autoCash${slotId}`).innerHTML = multiplier > 0 ? `⚡ AUTO: ${multiplier}x` : '⚡ AUTO: OFF';
    for (let m of [2, 4, 8, 0]) {
        const btn = document.getElementById(`autoCash${slotId}_${m}`);
        if (btn) btn.classList.remove('green-active');
    }
    const btnId = multiplier === 0 ? `autoCash${slotId}_0` : `autoCash${slotId}_${multiplier}`;
    const selectedBtn = document.getElementById(btnId);
    if (selectedBtn) selectedBtn.classList.add('green-active');
    showToast(multiplier > 0 ? `Auto cashout at ${multiplier}x set` : 'Auto cashout disabled');
}

function setMode(real) {
    isRealMode = real;
    const realBtn = document.getElementById('realModeBtn');
    const demoBtn = document.getElementById('demoModeBtn');
    if (isRealMode) {
        realBtn.classList.add('active');
        demoBtn.classList.remove('active');
    } else {
        realBtn.classList.remove('active');
        demoBtn.classList.add('active');
    }
    updateBalanceDisplay();
    showToast(isRealMode ? 'REAL MODE ACTIVE' : 'DEMO MODE ACTIVE');
    const path = document.getElementById('gamePath');
    path.classList.remove('trail-real', 'trail-demo');
    path.classList.add(isRealMode ? 'trail-real' : 'trail-demo');
}

// ==================== TOP WINNERS ====================
function loadTopWinners(type) {
    ['daily', 'weekly', 'alltime'].forEach(t => {
        document.getElementById(t + 'Tab').className = t === type ? 'flex-1 py-2 rounded-xl text-xs font-bold bg-red-600' : 'flex-1 py-2 rounded-xl text-xs font-bold bg-zinc-800';
    });
    const realUsers = [
        { name: 'Dawi_Fikadu', amount: type === 'daily' ? 12500 : (type === 'weekly' ? 45000 : 245000) },
        { name: 'Lemi_X', amount: type === 'daily' ? 8700 : (type === 'weekly' ? 32000 : 124500) },
        { name: 'Abebe_K', amount: type === 'daily' ? 5600 : (type === 'weekly' ? 21800 : 89300) }
    ];
    const fakeUsers = [
        { name: 'Fake_Player1', amount: type === 'daily' ? 3400 : (type === 'weekly' ? 9800 : 45200) },
        { name: 'Fake_Player2', amount: type === 'daily' ? 2100 : (type === 'weekly' ? 7600 : 32100) },
        { name: 'Fake_Player3', amount: type === 'daily' ? 1500 : (type === 'weekly' ? 5400 : 19800) }
    ];
    let allUsers = [...realUsers, ...fakeUsers];
    allUsers.sort((a,b) => b.amount - a.amount);
    const container = document.getElementById('winnersList');
    container.innerHTML = '';
    allUsers.forEach((w, idx) => {
        const isReal = realUsers.some(r => r.name === w.name);
        container.innerHTML += `<div class="glass p-3 flex justify-between items-center"><div class="flex items-center gap-3"><span class="text-sm font-bold text-yellow-400">#${idx+1}</span><div class="flex items-center gap-1"><span class="font-bold text-sm">@${w.name}</span>${isReal ? '<span class="verify-badge text-[8px]">✓ REAL</span>' : '<span class="text-[8px] opacity-50">🤖 FAKE</span>'}</div></div><div class="text-green-400 font-black">${w.amount.toLocaleString()} ETB</div></div>`;
    });
}

// ==================== WALLET ====================
function showWalletSection(section) {
    const depositSec = document.getElementById('depositSection');
    const withdrawSec = document.getElementById('withdrawSection');
    const depositTab = document.getElementById('depositTab');
    const withdrawTab = document.getElementById('withdrawTab');
    if (section === 'deposit') {
        depositSec.classList.remove('hidden');
        withdrawSec.classList.add('hidden');
        depositTab.className = 'flex-1 py-4 rounded-2xl font-black bg-red-600';
        withdrawTab.className = 'flex-1 py-4 rounded-2xl font-black bg-zinc-800';
    } else {
        depositSec.classList.add('hidden');
        withdrawSec.classList.remove('hidden');
        depositTab.className = 'flex-1 py-4 rounded-2xl font-black bg-zinc-800';
        withdrawTab.className = 'flex-1 py-4 rounded-2xl font-black bg-green-600';
    }
}

function submitDeposit() {
    const name = document.getElementById('depositName').value;
    const ft = document.getElementById('depositFt').value;
    const amount = parseFloat(document.getElementById('depositAmount').value);
    if (!name || !ft || !amount) { showToast('Please fill all fields'); return; }
    const transaction = { id: Date.now(), type: 'deposit', name, ft, amount, status: 'pending', timestamp: new Date().toISOString() };
    adminData.pendingTransactions.unshift(transaction);
    localStorage.setItem('admin_pending_tx', JSON.stringify(adminData.pendingTransactions));
    transactions.unshift(transaction);
    localStorage.setItem(storageKeys.transactions, JSON.stringify(transactions));
    showToast('✅ Request sent! Will be approved soon');
    updateTransactionDisplay();
    if (isAdmin) updateAdminDisplay();
    document.getElementById('depositName').value = '';
    document.getElementById('depositFt').value = '';
    document.getElementById('depositAmount').value = '';
}

function submitWithdraw() {
    const account = document.getElementById('withdrawAccount').value;
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    const balance = isRealMode ? user.realBalance : user.demoBalance;
    if (!account || !amount) { showToast('Please fill all fields'); return; }
    if (amount > balance) { showToast('❌ Insufficient balance'); return; }
    const transaction = { id: Date.now(), type: 'withdraw', account, amount, status: 'pending', timestamp: new Date().toISOString() };
    adminData.pendingTransactions.unshift(transaction);
    localStorage.setItem('admin_pending_tx', JSON.stringify(adminData.pendingTransactions));
    transactions.unshift(transaction);
    localStorage.setItem(storageKeys.transactions, JSON.stringify(transactions));
    showToast('✅ Withdrawal request sent!');
    updateTransactionDisplay();
    if (isAdmin) updateAdminDisplay();
    document.getElementById('withdrawAccount').value = '';
    document.getElementById('withdrawAmount').value = '';
}

function updateTransactionDisplay() {
    const container = document.getElementById('transactionList');
    container.innerHTML = '';
    transactions.slice(0, 10).forEach(tx => {
        const statusColor = tx.status === 'completed' ? 'text-green-400' : (tx.status === 'rejected' ? 'text-red-400' : 'text-yellow-400');
        const icon = tx.type === 'deposit' ? '💰' : '💸';
        container.innerHTML += `<div class="flex justify-between items-center text-xs p-2 rounded-xl bg-white/5"><div class="flex items-center gap-2"><span>${icon}</span><span>${tx.type === 'deposit' ? 'Deposit' : 'Withdraw'}</span></div><span class="font-bold">${tx.amount} ETB</span><span class="${statusColor}">${tx.status}</span></div>`;
    });
}

// ==================== ADMIN ====================
function updateAdminDisplay() {
    if (!isAdmin) return;
    document.getElementById('adminTotalDeposit').innerHTML = adminData.totalDeposit.toFixed(0) + ' ETB';
    document.getElementById('adminTotalWithdraw').innerHTML = adminData.totalWithdraw.toFixed(0) + ' ETB';
    document.getElementById('adminProfit').innerHTML = adminData.adminProfit.toFixed(0) + ' ETB';
    const pendingContainer = document.getElementById('pendingTransactions');
    pendingContainer.innerHTML = '';
    adminData.pendingTransactions.forEach(tx => {
        pendingContainer.innerHTML += `<div class="flex justify-between items-center p-2 rounded-xl bg-white/5 text-xs"><div><div class="font-bold">${tx.type === 'deposit' ? tx.name : tx.account}</div><div class="text-[9px] opacity-50">${tx.amount} ETB</div></div><div class="flex gap-2"><button onclick="approveTransaction(${tx.id})" class="px-3 py-1 bg-green-600 rounded-lg text-[10px]">Approve</button><button onclick="rejectTransaction(${tx.id})" class="px-3 py-1 bg-red-600 rounded-lg text-[10px]">Reject</button></div></div>`;
    });
}

function approveTransaction(txId) {
    if (!isAdmin) return;
    const tx = adminData.pendingTransactions.find(t => t.id === txId);
    if (tx) {
        tx.status = 'completed';
        if (tx.type === 'deposit') {
            adminData.totalDeposit += tx.amount;
            if (isRealMode) { user.realBalance += tx.amount; localStorage.setItem(storageKeys.realBalance, user.realBalance); }
            updateBalanceDisplay();
        } else {
            adminData.totalWithdraw += tx.amount;
            if (isRealMode) { user.realBalance -= tx.amount; localStorage.setItem(storageKeys.realBalance, user.realBalance); }
            updateBalanceDisplay();
        }
        const userTx = transactions.find(t => t.id === txId);
        if (userTx) userTx.status = 'completed';
        localStorage.setItem(storageKeys.transactions, JSON.stringify(transactions));
        adminData.pendingTransactions = adminData.pendingTransactions.filter(t => t.id !== txId);
        localStorage.setItem('admin_pending_tx', JSON.stringify(adminData.pendingTransactions));
        localStorage.setItem('admin_total_deposit', adminData.totalDeposit);
        localStorage.setItem('admin_total_withdraw', adminData.totalWithdraw);
        updateAdminDisplay();
        updateTransactionDisplay();
        showToast(`✅ ${tx.amount} ETB ${tx.type === 'deposit' ? 'deposit' : 'withdraw'} approved`);
    }
}

function rejectTransaction(txId) {
    if (!isAdmin) return;
    const tx = adminData.pendingTransactions.find(t => t.id === txId);
    if (tx) {
        tx.status = 'rejected';
        const userTx = transactions.find(t => t.id === txId);
        if (user
