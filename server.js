// import Web3 from "web3";
// import solanaWeb3 from "@solana/web3.js";
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
  getSpotifyRecentPlayed,
  mintNFTToAddress,
  getUser,
  createUser,
  getIntegration,
  createIntegration
} from "./utils.js";
// import bs58 from 'bs58';
const { getED25519Key } = pkg;
const app = express();
const port = 3000;
app.use(bodyParser.json());

dotenv.config();
try {
  await Moralis.start({
    serverUrl: process.env.MORALIS_URL,
    appId: process.env.MORALIS_APP_ID,
    masterKey: process.env.MORALIS_MASTER_KEY,
    moralisSecret: process.env.MORALIS_SECRET,
  });
  // const connection = new solanaWeb3.Connection(process.env.SOLANA_RPC_URL, 'confirmed');
} catch (error) {
  console.log("Error strting Moralis. Confirm dApp is awake.")
}

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

/**
 * ThirdWeb integration endpoints. 
 * These endpoints are used to integrate with the ThirdWeb SDK
 */
app.post("/integration/thirdweb/nft/mint", async (req, res) => {
  const walletAddress = req.body.walletAddress;
  const tokenId = req.body.tokenId;
  const result = await mintNFTToAddress(walletAddress, tokenId);
  res.json(result);
});


/**
 * Spotify integration endpoints. /integration/spotify/auth flow to get access token.
 * Subsequent data endpoints require a Spotify access token.
 *
 * For more information, read https://developer.spotify.com/web-api
 */
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
    .catch((err) => console.log("Error refreshing token:", err));
});

app.get("/integration/spotify/recent-played", (req, res) => {
  getSpotifyRecentPlayed(req.query)
    .then((tracks) => res.json(tracks))
    .catch((err) => console.log("Error getting spotify recent tracks: ", err));
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

/**
 * User endpoints
 * These endpoints are used to create, read, update, and delete users
 */
 app.get("/account/user", async (req, res) => {
  const pk = req.query.pk;
  const user = await getUser(pk)
  console.log(user)
  res.json(user)
});

app.post("/account/user", async (req, res) => {
  const data = req.body;
  const user = await createUser(data)
  console.log(user)
  res.json(user)
});

/**
 * Integration endpoints
 * These endpoints are used to create, read, update, and delete 3rd party integrations for a user
 */
 app.get("/account/integration", async (req, res) => {
  const type = req.query.type;
  const pk = req.query.pk;
  const user = await getIntegration(type, pk)
  console.log(user)
  res.json(user)
});

app.post("/account/integration/:type/:pk", async (req, res) => {
  const type = req.params.type;
  const pk = req.params.pk;
  const data = req.body;
  const user = await createIntegration(type, pk, data)
  console.log(user)
  res.json(user)
});