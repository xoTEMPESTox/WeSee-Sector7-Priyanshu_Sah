const { ethers } = require("hardhat");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

async function main() {
    const envPath = path.resolve(".env");
    const exampleEnvPath = path.resolve(".env.example");

    // 1️⃣ Ensure .env exists
    if (!fs.existsSync(envPath)) {
        if (fs.existsSync(exampleEnvPath)) {
            fs.copyFileSync(exampleEnvPath, envPath);
            console.log(".env not found, created from .env.example");
        } else {
            console.warn(".env.example not found, creating minimal .env");
            fs.writeFileSync(envPath, `# Default .env\nRPC_URL=http://127.0.0.1:8545\n`);
        }
    }

    // Reload dotenv after potential creation
    require("dotenv").config({ path: envPath });
    const [deployer, player1, player2] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);
    console.log("Player 1:", player1.address);
    console.log("Player 2:", player2.address);

    // 1️⃣ Deploy USDT mock
    const USDT = await ethers.getContractFactory("USDT");
    const usdt = await USDT.deploy();
    await usdt.waitForDeployment();
    console.log("USDT:", await usdt.getAddress());

    // 2️⃣ Deploy GameToken
    const GameToken = await ethers.getContractFactory("GameToken");
    const gameToken = await GameToken.deploy();
    await gameToken.waitForDeployment();
    console.log("GameToken:", await gameToken.getAddress());

    // 3️⃣ Deploy TokenStore
    const TokenStore = await ethers.getContractFactory("TokenStore");
    const tokenStore = await TokenStore.deploy(
        await usdt.getAddress(),
        await gameToken.getAddress(),
        ethers.parseUnits("1", 18) // 1 USDT = 1 GT
    );
    await tokenStore.waitForDeployment();
    console.log("TokenStore:", await tokenStore.getAddress());

    await gameToken.setTokenStore(tokenStore.target); // give mint rights

    // 4️⃣ Deploy PlayGame
    const PlayGame = await ethers.getContractFactory("PlayGame");
    const playGame = await PlayGame.deploy(
        await gameToken.getAddress(),
        deployer.address // operator is the deployer account
    );
    await playGame.waitForDeployment();
    console.log("PlayGame:", await playGame.getAddress());

    // 5️⃣ Fund player1 & player2 with USDT
    await usdt.transfer(player1.address, ethers.parseUnits("100", 6));
    await usdt.transfer(player2.address, ethers.parseUnits("100", 6));

    console.log("Funded players with 100 USDT each");

    // 6️⃣ Save deployed addresses and accounts to .env
    const addresses = {
        USDT_ADDRESS: await usdt.getAddress(),
        GAMETOKEN_ADDRESS: await gameToken.getAddress(),
        TOKENSTORE_ADDRESS: await tokenStore.getAddress(),
        PLAYGAME_ADDRESS: await playGame.getAddress(),
    };

    const accounts = {
        PUBLIC_KEY: deployer.address, // Operator/deployer
        PUBLIC_KEY_P1: player1.address,
        PUBLIC_KEY_P2: player2.address
    };

    // Read or create the .env file with base config
    let envContent = '';
    try {
        envContent = fs.readFileSync(".env", "utf-8");
    } catch (error) {
        console.warn(".env file not found, creating a new one.");
        envContent = `# RPC\nRPC_URL=http://127.0.0.1:8545\n\nLEADERBOARD_PORT=4000\nFRONTEND_PORT=5000\nBACKEND_PORT=3000\n\n# Operator / Escrow account (Account #0)\nPUBLIC_KEY=\nPRIVATE_KEY=\n\n# Player 1 (Account #1)\nPUBLIC_KEY_P1=\nPRIVATE_KEY_P1=\n\n# Player 2 (Account #2)\nPUBLIC_KEY_P2=\nPRIVATE_KEY_P2=\n\n# Contract addresses (to be filled after deploy)\n`;
    }
    
    // Check and overwrite or append each address
    let newEnvContent = envContent;
    for (const [key, value] of Object.entries(addresses)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (newEnvContent.match(regex)) {
            newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
        } else {
            newEnvContent += `\n${key}=${value}`;
        }
    }
    for (const [key, value] of Object.entries(accounts)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (newEnvContent.match(regex)) {
            newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
        } else {
            newEnvContent += `\n${key}=${value}`;
        }
    }
    
    // Preserve existing PRIVATE_KEY values if present, otherwise leave blank
    const privateKeys = {
        PRIVATE_KEY: process.env.PRIVATE_KEY || '',
        PRIVATE_KEY_P1: process.env.PRIVATE_KEY_P1 || '',
        PRIVATE_KEY_P2: process.env.PRIVATE_KEY_P2 || ''
    };
    for (const [key, value] of Object.entries(privateKeys)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (newEnvContent.match(regex)) {
            newEnvContent = newEnvContent.replace(regex, `${key}=${value}`);
        } else {
            newEnvContent += `\n${key}=${value}`;
        }
    }

    fs.writeFileSync(".env", newEnvContent.trim() + "\n");
    console.log("Updated .env with deployed addresses and accounts");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});