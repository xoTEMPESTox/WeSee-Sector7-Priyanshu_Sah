// api/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(express.json());
app.use(cors());

// normalize private key helper
function normalizePriv(k) {
  if (!k) throw new Error('missing private key');
  k = k.toString().trim();
  return k.startsWith('0x') ? k : '0x' + k;
}

// required env check
const required = [
  'RPC_URL', 'PRIVATE_KEY', 'PRIVATE_KEY_P1', 'PRIVATE_KEY_P2',
  'USDT_ADDRESS', 'GAMETOKEN_ADDRESS', 'TOKENSTORE_ADDRESS', 'PLAYGAME_ADDRESS'
];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[FATAL] missing env var ${k}. Update .env and restart.`);
    process.exit(1);
  }
}

/* Provider & wallets */
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const operator = new ethers.Wallet(normalizePriv(process.env.PRIVATE_KEY), provider);
const player1 = new ethers.Wallet(normalizePriv(process.env.PRIVATE_KEY_P1), provider);
const player2 = new ethers.Wallet(normalizePriv(process.env.PRIVATE_KEY_P2), provider);

/* ABIs */
const usdtAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)"
];
const gtAbi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
];
const tokenStoreAbi = [
  "function buy(uint256 usdtAmount) external",
  "event Purchase(address indexed buyer, uint256 usdtAmount, uint256 gtOut)"
];
const playGameAbi = [
  "function createMatch(bytes32 matchId, address p1, address p2, uint256 stake) external",
  "function stake(bytes32 matchId) external",
  "function commitResult(bytes32 matchId, address winner) external"
];

/* Contracts (read-only provider) */
const usdt = new ethers.Contract(process.env.USDT_ADDRESS, usdtAbi, provider);
const gt = new ethers.Contract(process.env.GAMETOKEN_ADDRESS, gtAbi, provider);
const tokenStore = new ethers.Contract(process.env.TOKENSTORE_ADDRESS, tokenStoreAbi, provider);
const playGame = new ethers.Contract(process.env.PLAYGAME_ADDRESS, playGameAbi, provider);

/* Tx queue map used by both sendTx and runInQueue */
const txQueues = new Map();

/* sendTx: single-transaction helper (keeps per-wallet ordering) */
async function sendTx(wallet, txFactory) {
  const key = wallet.address.toLowerCase();
  const last = txQueues.get(key) ?? Promise.resolve();

  const newPromise = last.then(async () => {
    console.log(`[sendTx] ${key} -> sending single tx`);
    const tx = await txFactory(); // returns TransactionResponse
    console.log(`[sendTx] sent tx.hash=${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[sendTx] mined tx.hash=${tx.hash} status=${receipt.status}`);
    return receipt;
  });

  txQueues.set(key, newPromise);
  try {
    return await newPromise;
  } finally {
    if (txQueues.get(key) === newPromise) txQueues.delete(key);
  }
}

/* runInQueue: wrapper that fetches a startNonce and passes it to the callback.
   The callback must accept (startNonce) and increment nonce for each tx.
   Retries on nonce-related errors a few times with backoff.
*/
async function runInQueue(wallet, fn, maxRetries = 2) {
  const key = wallet.address.toLowerCase();
  const last = txQueues.get(key) ?? Promise.resolve();

  const newPromise = last.then(async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[runInQueue] ${key} attempt ${attempt + 1} -> fetching startNonce`);
        // use provider.getTransactionCount to get the latest confirmed nonce
        const startNonce = await provider.getTransactionCount(wallet.address, "latest");
        console.log(`[runInQueue] ${key} startNonce=${startNonce}`);

        // pass startNonce into user function
        const result = await fn(startNonce);

        console.log(`[runInQueue] ${key} -> function completed`);
        return result;
      } catch (err) {
        const isNonceError =
          err &&
          (err.code === 'NONCE_EXPIRED' ||
            err.code === 'NONCE_TOO_LOW' ||
            (err.info &&
              err.info.error &&
              typeof err.info.error.message === 'string' &&
              err.info.error.message.includes('Nonce too low')));

        if (isNonceError && attempt < maxRetries) {
          const backoff = 150 * (attempt + 1);
          console.warn(`[runInQueue] ${key} nonce error, retrying after ${backoff}ms:`, err.message || err);
          await new Promise(r => setTimeout(r, backoff));
          continue;
        }
        console.error(`[runInQueue] ${key} -> function failed:`, err);
        throw err;
      }
    }
    throw new Error('runInQueue: retries exhausted');
  });

  txQueues.set(key, newPromise);
  try {
    return await newPromise;
  } finally {
    if (txQueues.get(key) === newPromise) txQueues.delete(key);
  }
}

/* wallet helper */
function walletFor(playerShort) {
  if (playerShort === 'p1') return player1;
  if (playerShort === 'p2') return player2;
  throw new Error('player must be "p1" or "p2"');
}

/* ---------- Endpoints ---------- */

// /config
app.get('/config', (req, res) => {
  console.log('[API] GET /config');
  res.json({
    USDT_ADDRESS: process.env.USDT_ADDRESS,
    GAMETOKEN_ADDRESS: process.env.GAMETOKEN_ADDRESS,
    TOKENSTORE_ADDRESS: process.env.TOKENSTORE_ADDRESS,
    PLAYGAME_ADDRESS: process.env.PLAYGAME_ADDRESS,
    PLAYER1: player1.address,
    PLAYER2: player2.address,
    OPERATOR: operator.address
  });
});

// GET /balance/:address
app.get('/balance/:address', async (req, res) => {
  const address = req.params.address;
  console.log(`[API] GET /balance/${address}`);
  try {
    const usdtBal = await usdt.balanceOf(address);
    const gtBal = await gt.balanceOf(address);
    const result = {
      usdt: ethers.formatUnits(usdtBal, 6),
      gt: ethers.formatUnits(gtBal, 18)
    };
    console.log(`[API] Balances ${address} =>`, result);
    res.json(result);
  } catch (err) {
    console.error('[ERROR] /balance', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /fund
app.post('/fund', async (req, res) => {
  console.log('[API] POST /fund', req.body);
  try {
    const { player, amount } = req.body;
    if (!player || !amount) return res.status(400).json({ error: "player and amount required" });
    const to = player === 'p1' ? player1.address : player2.address;
    const amt = ethers.parseUnits(amount.toString(), 6);

    const receipt = await sendTx(operator, () => usdt.connect(operator).transfer(to, amt));
    res.json({ success: true, tx: receipt.transactionHash });
  } catch (err) {
    console.error('[ERROR] /fund', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /purchase  - use runInQueue so approve+buy are atomic for a wallet
app.post('/purchase', async (req, res) => {
  console.log('[API] POST /purchase', req.body);
  try {
    const { player, amount } = req.body;
    if (!player || !amount) return res.status(400).json({ error: "player and amount required" });

    const signer = walletFor(player);
    const amt = ethers.parseUnits(amount.toString(), 6);

    // IMPORTANT: callback accepts startNonce and increments locally
    const buyReceipt = await runInQueue(signer, async (startNonce) => {
      let nonce = startNonce;

      // approve
      const tx1 = await usdt.connect(signer).approve(process.env.TOKENSTORE_ADDRESS, amt, { nonce });
      console.log(`[purchase] approve tx sent ${tx1.hash} (nonce=${nonce})`);
      await tx1.wait();
      console.log(`[purchase] approve mined ${tx1.hash}`);
      nonce++;

      // buy
      const tx2 = await tokenStore.connect(signer).buy(amt, { nonce });
      console.log(`[purchase] buy tx sent ${tx2.hash} (nonce=${nonce})`);
      const receipt = await tx2.wait();
      console.log(`[purchase] buy mined ${tx2.hash}`);
      return receipt;
    });

    res.json({ success: true, tx: buyReceipt.transactionHash });
  } catch (err) {
    console.error('[ERROR] /purchase', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /match/start - create match then run player sequences as queued blocks
app.post('/match/start', async (req, res) => {
  console.log('[API] POST /match/start', req.body);
  try {
    const { matchId, stake } = req.body;
    if (!matchId || !stake) return res.status(400).json({ error: "matchId and stake required" });

    const stakeAmt = ethers.parseUnits(stake.toString(), 18);
    const matchBytes = ethers.id(matchId);

    // create match by operator (single tx)
    await sendTx(operator, () => playGame.connect(operator).createMatch(matchBytes, player1.address, player2.address, stakeAmt));

    // player1 approve+stake as a unit (use startNonce)
    await runInQueue(player1, async (startNonce) => {
      let nonce = startNonce;
      const a = await gt.connect(player1).approve(process.env.PLAYGAME_ADDRESS, stakeAmt, { nonce });
      console.log(`[match/start] p1 approve ${a.hash} (nonce=${nonce})`);
      await a.wait();
      nonce++;
      const s = await playGame.connect(player1).stake(matchBytes, { nonce });
      console.log(`[match/start] p1 stake ${s.hash} (nonce=${nonce})`);
      return s.wait();
    });

    // player2 approve+stake as a unit
    await runInQueue(player2, async (startNonce) => {
      let nonce = startNonce;
      const a = await gt.connect(player2).approve(process.env.PLAYGAME_ADDRESS, stakeAmt, { nonce });
      console.log(`[match/start] p2 approve ${a.hash} (nonce=${nonce})`);
      await a.wait();
      nonce++;
      const s = await playGame.connect(player2).stake(matchBytes, { nonce });
      console.log(`[match/start] p2 stake ${s.hash} (nonce=${nonce})`);
      return s.wait();
    });

    res.json({ success: true, matchId });
  } catch (err) {
    console.error('[ERROR] /match/start', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /match/play
app.post('/match/play', async (req, res) => {
  console.log('[API] POST /match/play', req.body);
  try {
    const { matchId } = req.body;
    if (!matchId) return res.status(400).json({ error: "matchId required" });

    const matchBytes = ethers.id(matchId);
    const winner = Math.random() > 0.5 ? player1.address : player2.address;

    const receipt = await sendTx(operator, () => playGame.connect(operator).commitResult(matchBytes, winner));
    res.json({ success: true, winner, tx: receipt.transactionHash });
  } catch (err) {
    console.error('[ERROR] /match/play', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /escrow-balance
app.get('/escrow-balance', async (req, res) => {
  console.log('[API] GET /escrow-balance');
  try {
    const bal = await gt.balanceOf(process.env.PLAYGAME_ADDRESS);
    res.json({ escrowGT: ethers.formatUnits(bal, 18) });
  } catch (err) {
    console.error('[ERROR] /escrow-balance', err);
    res.status(500).json({ error: err.message });
  }
});

/* start server */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
  console.log('Operator:', operator.address);
  console.log('Player1:', player1.address);
  console.log('Player2:', player2.address);
  console.log('Contracts:', {
    USDT: process.env.USDT_ADDRESS,
    GT: process.env.GAMETOKEN_ADDRESS,
    TOKENSTORE: process.env.TOKENSTORE_ADDRESS,
    PLAYGAME: process.env.PLAYGAME_ADDRESS
  });
});
