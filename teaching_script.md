# Coin Toss + Game Token Project Teaching Guide

## 1. Introduction
- Briefly introduce what this project is about (Coin toss game with blockchain integration)
- Explain why it's interesting (use of smart contracts, tokens, etc.)

## 2. Project Structure
### Main Components
- **Frontend**: The user interface built with React that connects to MetaMask and allows users to interact with the blockchain.
- **Backend API**: Built with Node.js/Express to facilitate interactions between the frontend and smart contracts.
- **Smart Contracts**: Written in Solidity, these handle game logic, token management, and match operations.

### Directory Structure
- `contracts/`: Contains all Solidity smart contracts
- `web/`: Contains the React frontend code
- `api/`: Contains the Node.js backend API

## 3. Smart Contracts Explained

### GameToken.sol
**Purpose**: Represents the custom ERC20 token used in the game.
**Key Functions**:
- `mint(address to, uint256 amount)`: Creates new tokens and sends them to an address.
- `setTokenStore(address _store)`: Sets which contract can mint new tokens.

### PlayGame.sol
**Purpose**: Manages match creation, staking, and payouts.
**Key Functions**:
- `createMatch(bytes32 matchId, address p1, address p2, uint256 stake)`: Creates a match between two players.
- `stake(bytes32 matchId)`: Allows players to commit their tokens for a match.
- `commitResult(bytes32 matchId, address winner)`: Settles the match and pays out the winner.

## 4. Key Code Snippets Explained

### Minting Tokens
```solidity
function mint(address to, uint256 amount) external onlyTokenStore {
    _mint(to, amount);
}
```
This function creates new game tokens and sends them to a specified address.

### Staking Mechanism
```solidity
function stake(bytes32 matchId) external nonReentrant {
    // Transfer staked amount from player to contract
    require(gameToken.transferFrom(msg.sender, address(this), m.amountStake), "GT transfer failed");
    hasStaked[matchId][msg.sender] = true;
}
```
This function allows players to stake their tokens for a match.

## 5. Frontend Flow

### MetaMask Integration
- Connect wallet: Users connect their MetaMask wallet to interact with the blockchain.
- Buy Tokens: Users can exchange USDT for Game Tokens.
- Play Game: Users stake tokens, play matches, and receive payouts.

### Key Ethers.js Functions
- `provider.send("eth_requestAccounts", [])`: Connects user's wallet.
- `contract.functionName()`: Calls smart contract functions.

## 6. Live Demo Sequence

1. **Wallet Connection**: Show connecting MetaMask to the app.
2. **Buying Tokens**: Demonstrate exchanging USDT for Game Tokens.
3. **Staking & Playing**: Show creating a match, staking tokens, and settling results.
4. **Payout**: Display how winners receive their prizes.

## 7. Conclusion
- Recap key concepts: smart contracts, tokens, frontend-backend interactions.
- Discuss potential improvements or extensions to the project.