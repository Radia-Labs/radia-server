import Web3 from "web3";
import solanaWeb3 from "@solana/web3.js";
import pkg from "@toruslabs/openlogin-ed25519";
import Moralis from "moralis/node.js";
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import {
  getSolUSDPrice,
  getPolygonUSDPrice,
  getNFTsFromSimpleHash,
  getSpotifyAuthTokens,
  refreshSpotifyAccessToken,
} from "./utils.js";
// import bs58 from 'bs58';
const { getED25519Key } = pkg;
const app = express();
const port = 3000;
app.use(bodyParser.json());

dotenv.config();
await Moralis.start({
  serverUrl: process.env.MORALIS_URL,
  appId: process.env.MORALIS_APP_ID,
  masterKey: process.env.MORALIS_MASTER_KEY,
  moralisSecret: process.env.MORALIS_SECRET,
});
// const connection = new solanaWeb3.Connection(process.env.SOLANA_RPC_URL, 'confirmed');

app.get("/integration/spotify/auth", async (req, res) => {
  const code = req.query.code;
  getSpotifyAuthTokens(code)
    .then(async (json) => res.json(json))
    .catch((err) => console.log("Error getting spotify Refresh Token: ", err));
});

app.get("/integration/spotify/refresh-token", async (req, res) => {
  const refreshToken = req.query.refreshToken;
  refreshSpotifyAccessToken(refreshToken)
    .then((token) => res.json(token))
    .catch((err) => console.log("Error getting spotify Access Token: ", err));
});

app.get("/account/import/eth", async (req, res) => {
  const privateKey = req.query.privateKey.toString();
  const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.INFURA_URL)
  );
  const keypair = web3.eth.accounts.privateKeyToAccount(privateKey);
  res.json({ address: keypair.address });
});

app.get("/account/import/polygon", async (req, res) => {
  const privateKey = req.query.privateKey.toString();
  const web3 = new Web3(
    new Web3.providers.HttpProvider(process.env.INFURA_URL)
  );
  const keypair = web3.eth.accounts.privateKeyToAccount(privateKey);
  res.json({ address: keypair.address });
});

app.get("/account/import/sol", async (req, res) => {
  // privateKey can be from openlogin or from the user's existing wallet.
  // TODO: we could use the length to determine if it's openlogin or for example phanton wallet private key?
  // TODO: use fromSeed() to create a keypair from phantom private key for example.
  const privateKey = req.query.privateKey.toString();
  const { sk } = getED25519Key(privateKey);
  let keypair = solanaWeb3.Keypair.fromSecretKey(sk);
  res.json({ address: keypair.publicKey.toBase58() });
});

app.post("/account/send/polygon", async (req, res) => {
  const toAddress = req.body.toAddress;
  const amount = req.body.amount;
  const privateKey = req.body.privateKey;
  await Moralis.enableWeb3({ privateKey: privateKey, chainId: "0x13881" }); // TOD0: mumbai chainId: "0x13881" mainnet chainId: "0x89"
  const options = {
    type: "native",
    amount: Moralis.Units.ETH(amount),
    receiver: toAddress,
  };
  try {
    let transaction = await Moralis.transfer(options);
    console.log(transaction);
    const result = await transaction.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
  res.json({});
});

app.post("/account/send/eth", async (req, res) => {
  const toAddress = req.body.toAddress;
  const amount = req.body.amount;
  const privateKey = req.body.privateKey;

  await Moralis.enableWeb3({ privateKey: privateKey, chainId: "0x5" }); // "mainnet chaib in 0x1, goerli is 0x5"
  const options = {
    type: "native",
    amount: Moralis.Units.ETH(amount),
    receiver: toAddress,
  };
  try {
    let transaction = await Moralis.transfer(options);
    console.log(transaction);
    const result = await transaction.wait();
    console.log(result);
  } catch (error) {
    console.log(error);
  }
  res.json({});
});

app.get("/account/transactions/eth", async (req, res) => {
  const transactionHash = req.query.transactionHash;
  const options = {
    chain: "eth",
    transaction_hash: transactionHash,
  };
  const transaction = await Moralis.Web3API.native.getTransaction(options);
  console.log(transaction);
  res.json({});
});

// seach for eth token contract
// Use a web service
// https://api.etherscan.io/api?module=token&action=tokeninfo&contractaddress=0x0e3a2a1f2146d86a604adc220b4967a898d7fe07&apikey=YourApiKeyToken

app.get("/account/balances/eth", async (req, res) => {
  const options = { chain: "goerli", address: req.query.address }; // TODO: support maininet chain
  const balance = await Moralis.Web3API.account.getNativeBalance(options);
  const tokenValue = Moralis.Units.FromWei(balance.balance);
  balance.balance = parseFloat(tokenValue).toFixed(4);
  balance.thumbnail = `https://assets.coincap.io/assets/icons/eth@2x.png`;
  balance.symbol = "ETH";
  const tokenOptions = {
    chain: "eth",
    address: process.env.ETH_TOKEN_CONTRACT_ADDRESS,
  };
  const tokenPrice = await Moralis.Web3API.token.getTokenPrice(tokenOptions);
  balance.usdPrice = (tokenPrice.usdPrice * parseFloat(tokenValue)).toFixed(2);
  res.json(balance);
});

app.get("/account/balances/sol", async (req, res) => {
  const options = { network: "devnet", address: req.query.address };
  const balance = await Moralis.SolanaAPI.account.balance(options);
  balance.thumbnail = `https://assets.coincap.io/assets/icons/sol@2x.png`;
  balance.symbol = "SOL";
  await getSolUSDPrice().then((price) => {
    balance.usdPrice = (price * parseFloat(balance.solana)).toFixed(2);
  });
  balance.solana = parseFloat(balance.solana).toFixed(4);
  res.json(balance);
});

app.get("/account/balances/polygon", async (req, res) => {
  const options = { chain: "mumbai", address: req.query.address };
  const balance = await Moralis.Web3API.account.getNativeBalance(options);
  const tokenValue = Moralis.Units.FromWei(balance.balance);
  balance.balance = parseFloat(tokenValue).toFixed(4);
  balance.thumbnail = `https://assets.coincap.io/assets/icons/matic@2x.png`;
  balance.symbol = "MATIC";
  await getPolygonUSDPrice().then((price) => {
    balance.usdPrice = (price * parseFloat(balance.balance)).toFixed(2);
  });
  res.json(balance);
});

app.get("/account/tokens/eth", async (req, res) => {
  const options = { chain: "eth", address: req.query.address };
  const balances = await Moralis.Web3API.account.getTokenBalances(options);
  balances.forEach(async (balance) => {
    const tokenValue = Moralis.Units.FromWei(balance.balance);
    balance.balance = parseFloat(tokenValue).toFixed(4);
    const metaDataOptions = { chain: balance.name, symbols: balance.symbol };
    const tokenMetadata = await Moralis.Web3API.token.getTokenMetadataBySymbol(
      metaDataOptions
    );
    balance.metadata = tokenMetadata;
  });
  res.json(balances);
});

app.get("/account/nfts/eth", async (req, res) => {
  // TODO: mint a few nfts onto goerli testnet
  // Deprecated: use /account/nfts
  const address = req.query.address;
  const options = {
    chain: "eth",
    address: address,
  };
  const nfts = await Moralis.Web3API.account.getNFTs(options);
  res.json(nfts);
});

app.get("/account/nfts", async (req, res) => {
  const nfts = await getNFTsFromSimpleHash(
    req.query.chains,
    req.query.addresses
  );
  console.log(nfts);
  res.json(nfts);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
