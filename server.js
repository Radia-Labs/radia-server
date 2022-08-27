const serverless = require('serverless-http')
const cors = require('cors')
const bodyParser = require("body-parser")
const Moralis = require("moralis/node.js")
const express = require("express")

const dotenv = require("dotenv")
const {verifyAuth} = require("./middleware")

const {
  getNFTsFromSimpleHash,
  getSpotifyAuthTokens,
  refreshSpotifyAccessToken,
  mintNFTToAddress,
  getUser,
  createUser,
  getIntegration,
  createIntegration,
  getCollectibles,
  getCollectible,
  getArtists,
  getArtist,
  getSpotifyTopArtists,
  getArtistCollectors,
  getArtistCollectibles,
  getCurrentAcheivement,
  getCollectiblesBySk
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

/**
 * User endpoints
 * These endpoints are used to create, read, update, and delete users
 */
 app.get("/account/user", verifyAuth, async (req, res) => {
  const pk = req.query.pk;
  const user = await getUser(pk)
  res.json(user)
});

app.post("/account/user", verifyAuth, async (req, res) => {
  const data = req.body;
  const user = await createUser(data)
  res.json(user)
});

/**
 * Spotify integration endpoints. /integration/spotify/auth flow to get access token.
 * Subsequent data endpoints require a Spotify access token.
 *
 * For more information, read https://developer.spotify.com/web-api
 */
app.get("/integration/spotify/auth", verifyAuth, async (req, res) => {
  const code = req.query.code;
  getSpotifyAuthTokens(code)
    .then((json) => res.json(json))
    .catch((err) => console.log("Error getting spotify Refresh Token: ", err));
});

// TODO: Not sure we need these on the server, these are used in scheduled lambda

// app.get("/integration/spotify/refresh-token", verifyAuth, async (req, res) => {
//   const refreshToken = req.query.refreshToken;
//   refreshSpotifyAccessToken(refreshToken)
//     .then((token) => res.json(token))
//     .catch((err) => console.log("Error refreshing token:", err));
// });

// app.get("/integration/spotify/artist", verifyAuth, async (req, res) => {
//   getSpotifyArtist(req.query)
//     .then((token) => res.json(token))
//     .catch((err) => console.log("Error getting spotify artist:", err));
// });

/**
 * Integration endpoints
 * These endpoints are used to create & read 3rd party integrations for a user
 */
 app.get("/account/integration", verifyAuth, async (req, res) => {
  const type = req.query.type;
  const pk = req.query.pk;
  const user = await getIntegration(type, pk)
  console.log(user)
  res.json(user)
});

app.post("/account/integration/:type/:pk", verifyAuth, async (req, res) => {
  const type = req.params.type;
  const pk = req.params.pk;
  const data = req.body;
  const user = await createIntegration(type, pk, data)
  res.json(user)
});

/**
 * Collectibles endpoints
 * These endpoints are used to read collectibles
 */
 app.get("/account/collectibles", verifyAuth, async (req, res) => {
  const pk = req.query.pk;
  const limit = req.query.limit;
  const lastEvaluatedKey = req.query.lastEvaluatedKey;
  const user = await getCollectibles(pk, limit, lastEvaluatedKey)
  res.json(user)
});

app.get("/account/collectible", verifyAuth, async (req, res) => {
  const pk = req.query.pk;
  const sk = req.query.sk;
  const collectible = await getCollectible(pk, sk)
  res.json(collectible)
});


/**
 * Artists endpoints
 * These endpoints are used to read artists
 */
 app.get("/account/artists", verifyAuth, async (req, res) => {
  const pk = req.query.pk;
  const lastEvaluatedKey = req.query.lastEvaluatedKey;
  const artists = await getArtists(pk, lastEvaluatedKey)
  res.json(artists)
});

app.get("/account/artists/top", verifyAuth, async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const freshToken = await refreshSpotifyAccessToken(refreshToken);
  const artists = await getSpotifyTopArtists(freshToken)
  res.json(artists)
});

app.get("/artist/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const artist = await getArtist(id)
  res.json(artist)
});

app.get("/artist/collectibles/sk", verifyAuth, async (req, res) => {
  const sk = req.query.sk;
  console.log(sk)
  const collectible = await getCollectiblesBySk(sk)
  res.json(collectible)
});

app.get("/artist/collectibles/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const collectibles = await getArtistCollectibles(id)
  res.json(collectibles)
});

app.get("/artist/collectors/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const collectors = await getArtistCollectors(id)
  res.json(collectors)
});


/**
 * SimpleHash NFT endpoints.
 *
 * For more information, read https://simplehash.readme.io/reference/overview
 */
 app.get("/account/nfts", verifyAuth, async (req, res) => {
  const nfts = await getNFTsFromSimpleHash(
    req.query.chains,
    req.query.addresses
  );
  res.json(nfts);
});


/**
 * ThirdWeb integration endpoints. 
 * Private Route: requires x-api-key in headers
 * These endpoints are used to integrate with the ThirdWeb SDK
 */
 app.post("/nft/mint/spotify/track", async (req, res) => {
  const walletAddress = req.body.walletAddress;
  // const tokenId = req.body.tokenId; // TODO: might need nft tokenId at some point 
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