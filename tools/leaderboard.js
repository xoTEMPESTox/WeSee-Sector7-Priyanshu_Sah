const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Validate required environment variables
const required = ['RPC_URL', 'TOKENSTORE_ADDRESS', 'PLAYGAME_ADDRESS'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`[FATAL] missing env var ${k}. Update .env and restart.`);
    process.exit(1);
  }
}

// Initialize Ethereum provider
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// Contract ABIs
const tokenStoreAbi = [
  "event Purchase(address indexed buyer, uint256 usdtAmount, uint256 gtOut)"
];
const playGameAbi = [
  "event MatchCreated(bytes32 indexed matchId, address p1, address p2, uint256 amountStake)",
  "event PlayerStaked(bytes32 indexed matchId, address player, uint256 amountStake)",
  "event MatchSettled(bytes32 indexed matchId, address winner, uint256 payout)",
  "event MatchRefunded(bytes32 indexed matchId)"
];

// Initialize contracts
const tokenStore = new ethers.Contract(process.env.TOKENSTORE_ADDRESS, tokenStoreAbi, provider);
const playGame = new ethers.Contract(process.env.PLAYGAME_ADDRESS, playGameAbi, provider);

// Initialize SQLite database
const db = new sqlite3.Database(path.join(__dirname, 'leaderboard.db'), (err) => {
  if (err) {
    console.error('[ERROR] Failed to open SQLite database:', err.message);
    process.exit(1);
  }
  console.log('[DB] Connected to SQLite database');
});

// Create leaderboard table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      address TEXT PRIMARY KEY,
      wins INTEGER DEFAULT 0,
      totalGTWon TEXT DEFAULT '0',
      matchesPlayed INTEGER DEFAULT 0
    )
  `, (err) => {
    if (err) {
      console.error('[ERROR] Failed to create leaderboard table:', err.message);
      process.exit(1);
    }
    console.log('[DB] Leaderboard table ready');
  });
});

// Helper to update leaderboard
async function updateLeaderboard(address, { wins = 0, totalGTWon = '0', matchesPlayed = 0 }) {
    console.log(`[DEBUG] Attempting to update leaderboard for address: ${address}`);
    const addressLower = address.toLowerCase();
    const totalGTWonBI = BigInt(totalGTWon);

    db.get('SELECT * FROM leaderboard WHERE address = ?', [addressLower], (err, row) => {
        if (err) {
            console.error('[ERROR] Failed to fetch leaderboard row:', err.message);
            return;
        }
        console.log(`[DEBUG] Found row for ${addressLower}:`, row ? 'Exists' : 'New entry');

        if (row) {
            // Update existing row
            const newWins = row.wins + wins;
            const newTotalGTWon = (BigInt(row.totalGTWon) + totalGTWonBI).toString();
            const newMatchesPlayed = row.matchesPlayed + matchesPlayed;

            db.run(
                'UPDATE leaderboard SET wins = ?, totalGTWon = ?, matchesPlayed = ? WHERE address = ?',
                [newWins, newTotalGTWon, newMatchesPlayed, addressLower],
                function (err) { // Use a normal function to access `this.changes`
                    if (err) {
                        console.error('[ERROR] Failed to update leaderboard:', err.message);
                    } else {
                        console.log(`[DB] Updated ${addressLower} with ${this.changes} change(s): wins=${newWins}, totalGTWon=${newTotalGTWon}, matchesPlayed=${newMatchesPlayed}`);
                    }
                }
            );
        } else {
            // Insert new row
            db.run(
                'INSERT INTO leaderboard (address, wins, totalGTWon, matchesPlayed) VALUES (?, ?, ?, ?)',
                [addressLower, wins, totalGTWonBI.toString(), matchesPlayed],
                function (err) {
                    if (err) {
                        console.error('[ERROR] Failed to insert leaderboard row:', err.message);
                    } else {
                        console.log(`[DB] Added ${addressLower} with ${this.changes} change(s): wins=${wins}, totalGTWon=${totalGTWon}, matchesPlayed=${matchesPlayed}`);
                    }
                }
            );
        }
    });
}

// Event listeners
tokenStore.on('Purchase', (buyer, usdtAmount, gtOut, event) => {
    console.log(`[EVENT] Purchase: buyer=${buyer}, usdtAmount=${usdtAmount}, gtOut=${gtOut}, block=${event.blockNumber}`);
    // No leaderboard update needed for Purchase, but logged for monitoring
});

playGame.on('PlayerStaked', (matchId, player, amountStake, event) => {
    console.log(`[EVENT] PlayerStaked: matchId=${matchId}, player=${player}, amountStake=${amountStake}, block=${event.blockNumber}`);
    updateLeaderboard(player, { matchesPlayed: 1 });
});

playGame.on('MatchSettled', (matchId, winner, payout, event) => {
    console.log(`[EVENT] MatchSettled: matchId=${matchId}, winner=${winner}, payout=${payout}, block=${event.blockNumber}`);
    updateLeaderboard(winner, { wins: 1, totalGTWon: payout.toString() });
});

playGame.on('MatchRefunded', (matchId, event) => {
    console.log(`[EVENT] MatchRefunded: matchId=${matchId}, block=${event.blockNumber}`);
});

// GET /leaderboard endpoint
app.get('/leaderboard', (req, res) => {
    console.log('[API] GET /leaderboard - Fetching data from database...');
    db.all(
        'SELECT address, wins, totalGTWon, matchesPlayed FROM leaderboard ORDER BY totalGTWon DESC LIMIT 10',
        [],
        (err, rows) => {
            if (err) {
                console.error('[ERROR] Failed to fetch leaderboard:', err.message);
                res.status(500).json({ error: err.message });
                return;
            }
            console.log(`[API] Found ${rows.length} rows for leaderboard.`);
            const leaderboard = rows.map(row => ({
                address: row.address,
                wins: row.wins,
                totalGTWon: ethers.formatUnits(row.totalGTWon, 18),
                matchesPlayed: row.matchesPlayed
            }));
            res.json(leaderboard);
            console.log('[API] Sent leaderboard data to frontend.');
        }
    );
});

// Start server
const PORT = process.env.LEADERBOARD_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Leaderboard server running on port ${PORT}`);
  console.log('Contracts:', {
    TOKENSTORE: process.env.TOKENSTORE_ADDRESS,
    PLAYGAME: process.env.PLAYGAME_ADDRESS
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Closing SQLite database');
  db.close((err) => {
    if (err) {
      console.error('[ERROR] Failed to close database:', err.message);
    }
    console.log('[SHUTDOWN] Database closed, exiting');
    process.exit(0);
  });
});