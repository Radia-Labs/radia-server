const serverless = require('serverless-http')
const cors = require('cors')
const bodyParser = require("body-parser")
const Moralis = require("moralis/node.js")
const express = require("express")
const { getED25519Key } = require("@toruslabs/openlogin-ed25519")
const dotenv = require("dotenv")
const {
  getSolUSDPrice,
  getPolygonUSDPrice,
  getNFTsFromSimpleHash,
  getSpotifyAuthTokens,
  refreshSpotifyAccessToken,
  mintNFTToAddress,
  getUser,
  createUser,
  getIntegration,
  createIntegration,
  getCollectibles,
  getArtists,
  getArtist,
  getSpotifyArtist,
  getSpotifyTopArtists,
  getArtistCollectors,
  getArtistCollectibles,
  getCurrentAcheivement,
  getArtistCollectiblesBySk
} = require("./utils.js")

const app = express();
const port = 8000;
app.use(cors())
app.use(bodyParser.json());

dotenv.config();
try {
  Moralis.start({
    serverUrl: process.env.MORALIS_URL,
    appId: process.env.MORALIS_APP_ID,
    masterKey: process.env.MORALIS_MASTER_KEY,
    moralisSecret: process.env.MORALIS_SECRET,
  });
  // const connection = new solanaWeb3.Connection(process.env.SOLANA_RPC_URL, 'confirmed');
} catch (error) {
  console.log("Error strting Moralis. Confirm dApp is awake.")
}

app.get("/verify/jwt", (req, res) => {
  // Incase of ed25519 curve
  const app_scoped_privkey = req.headers.privKey
  const ed25519Key = getED25519Key(Buffer.from(app_scoped_privkey.padStart(64, "0"), "hex"));
  const app_pub_key = ed25519Key.pk.toString("hex");  
  res.json({appPubKey: app_pub_key});
})

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
 * Spotify integration endpoints. /integration/spotify/auth flow to get access token.
 * Subsequent data endpoints require a Spotify access token.
 *
 * For more information, read https://developer.spotify.com/web-api
 */
app.get("/integration/spotify/auth", async (req, res) => {
  const code = req.query.code;
  console.log("Getting Spotify access token...", code);
  getSpotifyAuthTokens(code)
    .then((json) => res.json(json))
    .catch((err) => console.log("Error getting spotify Refresh Token: ", err));
});

app.get("/integration/spotify/refresh-token", async (req, res) => {
  const refreshToken = req.query.refreshToken;
  refreshSpotifyAccessToken(refreshToken)
    .then((token) => res.json(token))
    .catch((err) => console.log("Error refreshing token:", err));
});

app.get("/integration/spotify/artist", async (req, res) => {
  getSpotifyArtist(req.query)
    .then((token) => res.json(token))
    .catch((err) => console.log("Error getting spotify artist:", err));
});

// TODO: not using this in app, resides in lambda function 
// app.get("/integration/spotify/recent-played", (req, res) => {
//   getSpotifyRecentPlayed(req.query)
//     .then((tracks) => res.json(tracks))
//     .catch((err) => console.log("Error getting spotify recent tracks: ", err));
// })

/**
 * User endpoints
 * These endpoints are used to create, read, update, and delete users
 */
 app.get("/account/user", async (req, res) => {
  const pk = req.query.pk;
  const user = await getUser(pk)
  res.json(user)
});

app.post("/account/user", async (req, res) => {
  const data = req.body;
  const user = await createUser(data)
  console.log(user)
  res.json(user)
});

/**
 * Collectibles endpoints
 * These endpoints are used to create, read, update, and delete collectibles
 */
 app.get("/account/collectibles", async (req, res) => {
  const pk = req.query.pk;
  const limit = req.query.limit;
  const lastEvaluatedKey = req.query.lastEvaluatedKey;
  const user = await getCollectibles(pk, limit, lastEvaluatedKey)
  res.json(user)
});

/**
 * Artists endpoints
 * These endpoints are used to create, read, update, and delete artists
 */
 app.get("/account/artists", async (req, res) => {
  const pk = req.query.pk;
  const lastEvaluatedKey = req.query.lastEvaluatedKey;
  const artists = await getArtists(pk, lastEvaluatedKey)
  res.json(artists)
});

app.get("/account/artists/top", async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const freshToken = await refreshSpotifyAccessToken(refreshToken);
  const artists = await getSpotifyTopArtists(freshToken)
  res.json(artists)
});

app.get("/artist/:id", async (req, res) => {
  const id = req.params.id;
  const artist = await getArtist(id)
  res.json(artist)
});

app.get("/artist/collectibles/sk", async (req, res) => {
  const sk = req.query.sk;
  console.log(sk)
  const collectibles = await getArtistCollectiblesBySk(sk)
  console.log(collectibles, 88)
  res.json(collectibles)
});

app.get("/artist/collectibles/:id", async (req, res) => {
  const id = req.params.id;
  const collectibles = await getArtistCollectibles(id)
  res.json(collectibles)
});

app.get("/artist/collectors/:id", async (req, res) => {
  const id = req.params.id;
  const collectors = await getArtistCollectors(id)
  res.json(collectors)
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
  res.json(user)
});

/**
 * ThirdWeb integration endpoints. 
 * Private Route: requires x-api-key in headers
 * These endpoints are used to integrate with the ThirdWeb SDK
 */
 app.post("/nft/mint/spotify/track", async (req, res) => {
  console.log("this is what the body looks like: ", req.body)
  const walletAddress = req.body.walletAddress;
  // const tokenId = req.body.tokenId; // TODO: might need tokenId at some point 
  const item = req.body.track;

  // Custom metadata of the NFT, note that you can fully customize this metadata with other properties.
  let artists = item.track.artists.map((artist) => artist.name).join(", ");
  artists = artists.replace(/,\s*$/, "");
  const nftMetadata = {
    name: item.track.name,
    description: `${item.track.name} from ${artists} played at ${item.played_at}`,
    image: item.track.album.images[0].url, // TODO: this will be the album art of the track for now. We'd want to switch this to be a Radia NFT I'd imagine.
    track: item
  };

  console.log("This is our nft metadata: ", nftMetadata);

  const result = await mintNFTToAddress(walletAddress, nftMetadata);
  res.json(result);
});

app.post("/nft/mint/spotify/artist", async (req, res) => {
  console.log("this is what the body looks like: ", req.body)
  const walletAddress = req.body.walletAddress;
  // const tokenId = req.body.tokenId; // TODO: might need tokenId at some point 
  const item = req.body.artist;
  const streamedMilliseconds = req.body.streamedMilliseconds;

  // Custom metadata of the NFT, note that you can fully customize this metadata with other properties.
  const nftMetadata = {
    name: item.name,
    description: `${item.name} - ${getCurrentAcheivement(streamedMilliseconds)}`,
    image: item.images[0].url, // TODO: this will be the album art of the track for now. We'd want to switch this to be a Radia NFT I'd imagine.
    artist: item
  };

  console.log("This is our nft metadata: ", nftMetadata);

  const result = await mintNFTToAddress(walletAddress, nftMetadata);
  res.json(result);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports.handler = serverless(app)