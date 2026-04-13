function requestDeposit() {
    let amt = document.getElementById('depAmt').value;
    let ref = document.getElementById('depRef').value;
    if(!amt || !ref) return alert("መረጃውን ሙሉ!");

    // ለአድሚን ጥያቄ መላክ
    let area = document.getElementById('adminRequests');
    let req = document.createElement('div');
    req.className = "bg-zinc-900 p-3 rounded flex justify-between";
    req.innerHTML = `<span>${amt} ETB (${ref})</span>
                     <button onclick="approve(this, ${amt})" class="bg-green-600 px-2 rounded">Approve</button>`;
    area.appendChild(req);
    alert("ጥያቄው ተልኳል!");
}

function approve(btn, amt) {
    db.bal += parseFloat(amt);
    updateUI();
    btn.parentElement.remove();
    alert("ገንዘቡ ገቢ ሆኗል!");
}

// አድሚን ለመሆን (ለሙከራ ኮንሶል ላይ db.is_admin = true ማድረግ ይቻላል)
function makeMeAdmin() {
    db.is_admin = true;
    updateUI();
}
