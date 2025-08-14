
const API = 'http://localhost:3000';
const LEADERBOARD_API = 'http://localhost:4000';
let CONFIG = null;
let statusTimeout;
let prevBalances = { p1USDT: 0, p1GT: 0, p2USDT: 0, p2GT: 0 };
let prevLeaderboard = [];



function setStatus(s, duration = 3000, type = 'info') {
    console.log('[UI]', s);
    const el = document.getElementById('statusToast');
    el.textContent = s;
    el.classList.remove('error', 'success');
    if (type === 'error') el.classList.add('error');
    if (type === 'success') el.classList.add('success');
    el.classList.add('show');

    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, duration);
}

async function loadConfig() {
    try {
        setStatus('Loading config...', 2000);
        const res = await fetch(`${API}/config`);
        CONFIG = await res.json();
        console.log('[UI] config', CONFIG);
        document.getElementById('p1Addr').innerHTML = `<option value="${CONFIG.PLAYER1}">${shorten(CONFIG.PLAYER1)}</option>`;
        document.getElementById('p2Addr').innerHTML = `<option value="${CONFIG.PLAYER2}">${shorten(CONFIG.PLAYER2)}</option>`;
    } catch (e) {
        console.warn('Could not load config', e);
        setStatus('Error: Could not load config. Is the backend running?', 5000, 'error');
    }
}

function updateSliderValue(id, value) {
    document.getElementById(id).textContent = value;
}

async function buyGT(playerShort) {
    try {
        const inputId = playerShort === 'p1' ? 'p1BuyAmt' : 'p2BuyAmt';
        const amt = document.getElementById(inputId).value;
        if (!amt || Number(amt) <= 0) return setStatus('Please select a valid amount.', 3000, 'error');
        setStatus(`Purchasing GT for ${playerShort}...`);
        disableAll(true);

        const r = await fetch(`${API}/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: playerShort, amount: amt })
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        console.log('[UI] purchase response', data);
        setStatus('Purchase complete!', 3000, 'success');
        document.getElementById(inputId).value = 0;
        updateSliderValue(`${inputId}Value`, 0);
    } catch (err) {
        console.error('[UI] purchase error', err);
        setStatus('Purchase error: ' + err.message, 5000, 'error');
    } finally {
        disableAll(false);
        await updateBalances(true);
        await updateEscrow();
        await updateLeaderboard(true);
    }
}

async function fundPlayer(playerShort) {
    const amt = prompt('Amount USDT to fund', '100');
    if (!amt || Number(amt) <= 0) return;
    setStatus(`Funding ${playerShort} with ${amt} USDT...`);
    disableAll(true);
    try {
        const r = await fetch(`${API}/fund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player: playerShort, amount: amt })
        });
        const data = await r.json();
        if (data.error) throw new Error(data.error);
        console.log('[UI] fund response', data);
        setStatus('Funding complete!', 3000, 'success');
    } catch (err) {
        console.error('[UI] fund error', err);
        setStatus('Fund error: ' + err.message, 5000, 'error');
    } finally {
        disableAll(false);
        await updateBalances(true);
        await updateLeaderboard(true);
    }
}

function disableAll(dis) {
    document.querySelectorAll('button,input,select').forEach(el => el.disabled = dis);
}

function animateNumber(el, start, end, duration = 1000) {
    let startTime = null;
    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        el.textContent = (start + progress * (end - start)).toFixed(2);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

async function updateBalances(animate = false) {
    if (!CONFIG) return;
    try {
        const p1 = CONFIG.PLAYER1;
        const p2 = CONFIG.PLAYER2;

        const res1 = await fetch(`${API}/balance/${p1}`);
        const data1 = await res1.json();
        const p1USDTEl = document.getElementById('p1USDT');
        const p1GTEl = document.getElementById('p1GT');
        const newP1USDT = parseFloat(data1.usdt);
        const newP1GT = parseFloat(data1.gt);
        if (animate) {
            animateNumber(p1USDTEl, prevBalances.p1USDT, newP1USDT);
            animateNumber(p1GTEl, prevBalances.p1GT, newP1GT);
            if (newP1USDT !== prevBalances.p1USDT || newP1GT !== prevBalances.p1GT) {
                p1USDTEl.classList.add('updated');
                p1GTEl.classList.add('updated');
                setTimeout(() => {
                    p1USDTEl.classList.remove('updated');
                    p1GTEl.classList.remove('updated');
                }, 1000);
            }
        } else {
            p1USDTEl.textContent = newP1USDT.toFixed(2);
            p1GTEl.textContent = newP1GT.toFixed(2);
        }
        prevBalances.p1USDT = newP1USDT;
        prevBalances.p1GT = newP1GT;
        document.getElementById('p1BuyAmt').max = newP1USDT;

        const res2 = await fetch(`${API}/balance/${p2}`);
        const data2 = await res2.json();
        const p2USDTEl = document.getElementById('p2USDT');
        const p2GTEl = document.getElementById('p2GT');
        const newP2USDT = parseFloat(data2.usdt);
        const newP2GT = parseFloat(data2.gt);
        if (animate) {
            animateNumber(p2USDTEl, prevBalances.p2USDT, newP2USDT);
            animateNumber(p2GTEl, prevBalances.p2GT, newP2GT);
            if (newP2USDT !== prevBalances.p2USDT || newP2GT !== prevBalances.p2GT) {
                p2USDTEl.classList.add('updated');
                p2GTEl.classList.add('updated');
                setTimeout(() => {
                    p2USDTEl.classList.remove('updated');
                    p2GTEl.classList.remove('updated');
                }, 1000);
            }
        } else {
            p2USDTEl.textContent = newP2USDT.toFixed(2);
            p2GTEl.textContent = newP2GT.toFixed(2);
        }
        prevBalances.p2USDT = newP2USDT;
        prevBalances.p2GT = newP2GT;
        document.getElementById('p2BuyAmt').max = newP2USDT;

        // Update bet slider max
        document.getElementById('betAmt').max = Math.min(newP1GT, newP2GT);

    } catch (err) {
        console.error('[UI] updateBalances error', err);
    }
}

async function updateEscrow() {
    try {
        const res = await fetch(`${API}/escrow-balance`);
        const data = await res.json();
        document.getElementById('escrowGT').textContent = parseFloat(data.escrowGT).toFixed(2);
    } catch (err) {
        console.error('[UI] updateEscrow error', err);
    }
}

async function updateLeaderboard(animate = false) {
    try {
        const res = await fetch(`${LEADERBOARD_API}/leaderboard`);
        const data = await res.json();
        const tbody = document.getElementById('leaderboardBody');
        tbody.innerHTML = ''; // Clear existing rows
        data.forEach((entry, index) => {
            const row = document.createElement('tr');
            const isNew = !prevLeaderboard.find(e => e.address === entry.address && e.wins === entry.wins);
            if (animate && isNew) row.classList.add('new');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${shorten(entry.address)}</td>
                <td>${entry.wins}</td>
                <td>${entry.totalGTWon}</td>
                <td>${entry.matchesPlayed}</td>
            `;
            tbody.appendChild(row);
        });
        prevLeaderboard = data;
    } catch (err) {
        console.error('[UI] updateLeaderboard error', err);
    }
}

async function playMatch() {
    const stake = document.getElementById('betAmt').value;
    if (!stake || Number(stake) <= 0) return setStatus('Please select a stake greater than 0.', 3000, 'error');

    setStatus('Starting match...');
    disableAll(true);

    const matchId = Date.now().toString();
    const coinOverlay = document.getElementById('coinOverlay');
    const coin = document.getElementById('coin');

    try {
        setStatus('Both players are staking...');
        const startRes = await fetch(`${API}/match/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, stake })
        });
        const startData = await startRes.json();
        if (startData.error) throw new Error(startData.error);
        await updateBalances(true);
        await updateEscrow();
        
        // --- Start Coin Animation ---
        setStatus('Flipping the coin...');
        coinOverlay.style.display = 'flex';
        coin.style.transform = 'rotateY(0deg)'; // Reset coin
        coin.classList.add('flipping');
        
        // Wait for flip animation before getting result
        await new Promise(resolve => setTimeout(resolve, 3500));

        const playRes = await fetch(`${API}/match/play`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId })
        });
        const playData = await playRes.json();
        if (playData.error) throw new Error(playData.error);

        console.log('[UI] match/play response', playData);
        
        // --- Land on the correct side ---
        const isP1Winner = playData.winner.toLowerCase() === CONFIG.PLAYER1.toLowerCase();
        const finalRotation = isP1Winner ? 2160 : 2160 + 180;
        coin.style.transform = `rotateY(${finalRotation}deg)`;
        coin.classList.remove('flipping');
        
        document.getElementById('lastWinner').textContent = shorten(playData.winner || '-');
        highlightWinner(playData.winner);
        setStatus('Match complete! Winner: ' + shorten(playData.winner), 5000, 'success');
        confettiBurst(isP1Winner ? 'p1Box' : 'p2Box');
        
        // Hide overlay after showing the result
        await new Promise(resolve => setTimeout(resolve, 2500));
        coinOverlay.style.display = 'none';
        
    } catch (err) {
        console.error('[UI] playMatch error', err);
        setStatus('Play error: ' + err.message, 5000, 'error');
        coinOverlay.style.display = 'none'; // Hide overlay on error
    } finally {
        disableAll(false);
        await updateBalances(true);
        await updateEscrow();
        await updateLeaderboard(true);
    }
}

function shorten(addr) {
    if (!addr) return '-';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function highlightWinner(addr) {
    const p1Box = document.getElementById('p1Box');
    const p2Box = document.getElementById('p2Box');
    p1Box.classList.remove('winner');
    p2Box.classList.remove('winner');
    if (!addr || !CONFIG) return;
    if (addr.toLowerCase() === CONFIG.PLAYER1.toLowerCase()) p1Box.classList.add('winner');
    if (addr.toLowerCase() === CONFIG.PLAYER2.toLowerCase()) p2Box.classList.add('winner');
}

function copyAddress(id) {
    const el = document.getElementById(id);
    navigator.clipboard.writeText(el.value).then(() => {
        setStatus('Address copied!', 2000, 'success');
    }).catch(() => {
        setStatus('Failed to copy address.', 2000, 'error');
    });
}

// Simple confetti burst
function confettiBurst(boxId) {
    const canvas = document.getElementById('confetti');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const box = document.getElementById(boxId);
    const rect = box.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const particles = [];
    const colors = ['#ff0', '#f00', '#0f0', '#00f', '#f0f'];

    for (let i = 0; i < 100; i++) {
        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.random() * 10 - 5,
            vy: Math.random() * -15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 5 + 5,
            gravity: 0.2,
            life: 100
        });
    }

    function animateConfetti() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            if (p.life > 0) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.life--;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        });
        if (particles.some(p => p.life > 0)) requestAnimationFrame(animateConfetti);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    animateConfetti();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadConfig().then(() => {
        updateBalances();
        updateEscrow();
        updateLeaderboard();
        setInterval(() => {
            updateBalances(true);
            updateEscrow();
            updateLeaderboard(true);
        }, 5000); // Polling every 5 seconds with animation
        setStatus('Ready to Play!', 4000, 'success');
    });
});
