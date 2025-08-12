const { ethers } = require("hardhat");
require("dotenv").config();
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

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
        process.env.PUBLIC_KEY // operator
    );
    await playGame.waitForDeployment();
    console.log("PlayGame:", await playGame.getAddress());

    // 5️⃣ Fund player1 & player2 with USDT
    await usdt.transfer(process.env.PUBLIC_KEY_P1, ethers.parseUnits("100", 6));
    await usdt.transfer(process.env.PUBLIC_KEY_P2, ethers.parseUnits("100", 6));

    console.log("Funded players with 100 USDT each");

    // 6️⃣ Save deployed addresses to .env
    const addresses = {
        USDT_ADDRESS: await usdt.getAddress(),
        GAMETOKEN_ADDRESS: await gameToken.getAddress(),
        TOKENSTORE_ADDRESS: await tokenStore.getAddress(),
        PLAYGAME_ADDRESS: await playGame.getAddress(),
    };

    // Read the current .env file content
    let envContent = '';
    try {
        envContent = fs.readFileSync(".env", "utf-8");
    } catch (error) {
        console.warn(".env file not found, creating a new one.");
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
    
    fs.writeFileSync(".env", newEnvContent.trim() + "\n");
    console.log("Updated .env with deployed addresses");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
