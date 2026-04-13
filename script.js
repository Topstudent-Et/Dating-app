const tg = window.Telegram.WebApp;
let db = JSON.parse(localStorage.getItem('gameData')) || { bal: 0, stWon: 0 };

// ባላንስን ቼክ የሚያደርግ እና የሚመዘግብ
function updateBalance(amount, type) {
    if (type === 'minus') {
        if (db.bal < amount) return false;
        db.bal -= amount;
    } else {
        db.bal += amount;
    }
    saveData();
    return true;
}

function saveData() {
    localStorage.setItem('gameData', JSON.stringify(db));
    document.getElementById('topBal').innerText = db.bal.toFixed(2);
}

// ድምጽ ለመጫወት
const crashSound = new Audio('sounds/crash.mp3');
const winSound = new Audio('sounds/win.mp3');

function playCrash() {
    crashSound.play();
}

// Multi-player sync logic (ለጊትሀብ በሚመች መልኩ)
function startEngine() {
    let mult = 1.0;
    let crashPoint = 1.5 + Math.random() * 5; // አድሚኑ መቆጣጠር ይችላል
    // ... ቀሪው የጌም ኢንጂን ኮድ
}
