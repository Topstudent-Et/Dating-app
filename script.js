const tg = window.Telegram.WebApp;
let db = JSON.parse(localStorage.getItem('worldGameDB')) || {
    bal: 0.0, cbe: "1000179571815", is_admin: false
};

const crashSnd = new Audio('sounds/crash.mp3');
const winSnd = new Audio('sounds/win.mp3');

function updateUI() {
    document.getElementById('topBal').innerText = db.bal.toFixed(2);
    document.getElementById('bankAcc').innerText = db.cbe;
    localStorage.setItem('worldGameDB', JSON.stringify(db));
    if(db.is_admin) document.getElementById('adminTab').classList.remove('hidden');
}

let mult = 1.0;
let running = false;

function engine() {
    if(running) return;
    running = true; mult = 1.0;
    document.getElementById('crashMsg').classList.add('hidden');
    
    // የቤት ትርፍ (House Edge): ትልቅ ገንዘብ ሲገባ ቶሎ ክራሽ ያደርጋል
    let crashLimit = 1.2 + Math.random() * 5.0;

    let loop = setInterval(() => {
        mult += 0.01 * (mult / 1.5);
        document.getElementById('multDisplay').innerText = mult.toFixed(2) + "x";
        
        // አውሮፕላኑን ማንቀሳቀስ
        let plane = document.getElementById('plane');
        plane.style.left = Math.min(10 + (mult * 5), 80) + "%";
        plane.style.bottom = Math.min(10 + (mult * 4), 70) + "%";

        if(mult >= crashLimit) {
            clearInterval(loop);
            running = false;
            crashSnd.play();
            document.getElementById('multDisplay').innerText = "";
            document.getElementById('crashMsg').classList.remove('hidden');
            setTimeout(engine, 4000);
        }
    }, 80);
}

function handleBet(slot) {
    let amt = parseFloat(document.getElementById('amt' + slot).value);
    if(db.bal < amt) return alert("በቂ ባላንስ የሎትም!");
    
    // 20% ትርፍ ወዲያውኑ ይቀነሳል
    db.bal -= amt;
    updateUI();
    // እዚህ ጋር የዊን ሎጂክ ይገባል...
}

function showP(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

window.onload = () => { updateUI(); engine(); };
