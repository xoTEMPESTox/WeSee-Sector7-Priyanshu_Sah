const express = require('express');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Contract ABIs (minimal placeholders until we add real ones)
const tokenStoreAbi = [
  "function buy(uint256 usdtAmount) external",
];
const playGameAbi = [
  "function createMatch(bytes32 matchId, address p1, address p2, uint256 stake) external",
  "function stake(bytes32 matchId) external",
  "function commitResult(bytes32 matchId, address winner) external"
];

// Connect contract instances (addresses are placeholders for now)
const tokenStore = new ethers.Contract(process.env.TOKENSTORE_ADDRESS, tokenStoreAbi, wallet);
const playGame = new ethers.Contract(process.env.PLAYGAME_ADDRESS, playGameAbi, wallet);

// ---- Endpoints ----

// Buy GT tokens
app.get('/purchase', async (req, res) => {
    const amount = req.query.amount;
    try {
        // Stubbed: in final version, call tokenStore.buy()
        console.log(`Buying GT for ${amount} USDT`);
        res.json({ success: true, amount, gtReceived: amount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start match
app.post('/match/start', async (req, res) => {
    const { matchId, p1, p2, stake } = req.body;
    try {
        console.log(`Creating match ${matchId} with stake ${stake}`);
        res.json({ success: true, matchId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Submit match result
app.post('/match/result', async (req, res) => {
    const { matchId, winner } = req.body;
    try {
        console.log(`Submitting result for match ${matchId}, winner: ${winner}`);
        res.json({ success: true, matchId, winner });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('Backend running on port 3000'));
