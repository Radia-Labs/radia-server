const serverless = require('serverless-http')
const cors = require('cors')
const bodyParser = require("body-parser")
const express = require("express")
const multer  = require('multer')
const multerS3 = require('multer-s3');
const AWS =  require('aws-sdk');
const dotenv = require("dotenv")
const {verifyAuth} = require("./middleware")
var path = require('path')

const {
  getNFTsByOwner,
  getNFTByTokenId,
  getSpotifyAuthTokens,
  refreshSpotifyAccessToken,
  mintNFTToAddress,
  getUser,
  createUser,
  updateUser,
  getIntegration,
  createIntegration,
  getCollectibles,
  getCollectible,
  createUserArtistCollectible,
  createUserTrackCollectible,
  getArtists,
  getArtist,
  getArtistCollector,
  createArtistCollector,
  createArtistCollectible,
  getSpotifyTopArtists,
  getSpotifyProfile,
  getArtistCollectors,
  getArtistCollectibles,
  getCurrentAcheivement,
  getCollectiblesBySk,
  getCollections,
  getCollection,
  deleteCollection,
  createCollection,
  getSpotifySimilarArtists,
  getSpotifyNewMusic,
  getSpotifyArtist,
  sendEmailTemplate,
  getRandomCollectibleImageFromS3,
  sortNftsFromSimpleHash
} = require("./utils.js")

// Set up express
const app = express();
const port = 8000;

// Init dotenv
dotenv.config();

// Set up S3
const S3 = new AWS.S3({ 
  accessKeyId: process.env.AWS_ACCESS_ID, 
  secretAccessKey: process.env.AWS_ACCESS_SECRET
});

// Setup CORS and body parser
app.use(cors())
app.use(bodyParser.json());

// Profile Image Upload to S3
const upload = multer({
  storage: multerS3({
      s3: S3,
      bucket: process.env.AWS_S3_USER_BUCKET_NAME,
      key: function (req, file, cb) {
          cb(null, `images/${req.params.pk}/${new Date().getTime()}${path.extname(file.originalname)}`); 
      }
  })
});

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

app.put("/account/user", verifyAuth, async (req, res) => {
  const data = req.body;
  const user = await updateUser(data.verifierId, data)
  res.json(user)
});

app.post("/account/user/:pk/image/upload", upload.single('file'), async (req, res) => {
    res.send({
      message: "Uploaded!",
      url: `${process.env.RADIA_USER_MEDIA_CDN}/${req.file.key}` //{url: req.file.location, name: req.file.key, type: req.file.mimetype, size: req.file.size}
    });
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

app.get("/integration/spotify/artist", verifyAuth, async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const freshToken = await refreshSpotifyAccessToken(refreshToken);  
  getSpotifyArtist(req.query.id, freshToken)
    .then((token) => res.json(token))
    .catch((err) => console.log("Error getting spotify artist:", err));
});

app.get("/integration/spotify/me", verifyAuth, async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const freshToken = await refreshSpotifyAccessToken(refreshToken);
  const spotify = await getSpotifyProfile(freshToken)
  res.json(spotify)
});

/**
 * User Integration endpoints
 * These endpoints are used to create & read 3rd party integrations for a user
 */
 app.get("/account/integration", verifyAuth, async (req, res) => {
  const type = req.query.type;
  const pk = req.query.pk;
  const user = await getIntegration(type, pk)
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

app.post("/account/collectible/artist/:pk", verifyAuth, async (req, res) => {
  const pk = req.params.pk;
  const artist = req.body.artist;
  const achievement = req.body.achievement;
  const streamedMilliseconds = req.body.streamedMilliseconds;
  const user = req.body.user;
  const statusName = req.body.status;
  const transaction = req.body.transaction;
  const collectible = await createUserArtistCollectible(pk, artist, achievement, streamedMilliseconds, user, statusName, transaction)
  res.json(collectible)
});

app.post("/account/collectible/track/:pk", verifyAuth, async (req, res) => {
  const pk = req.params.pk;
  const artist = req.body.artist;
  const track = req.body.track;
  const achievement = req.body.achievement;
  const user = req.body.user;
  const statusName = req.body.status;
  const transaction = req.body.transaction;
  const collectible = await createUserTrackCollectible(pk, artist, track, achievement, user, statusName, transaction)
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

app.get("/account/artists/similar", verifyAuth, async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const id = req.query.id;
  const freshToken = await refreshSpotifyAccessToken(refreshToken);
  const artists = await getSpotifySimilarArtists(id, freshToken)
  res.json(artists)
});

app.get("/account/artists/new-music", verifyAuth, async (req, res) => {
  const refreshToken = req.query.refreshToken;
  const nextUrl = req.query.nextUrl
  const freshToken = await refreshSpotifyAccessToken(refreshToken);
  const newMusic = await getSpotifyNewMusic(freshToken, nextUrl)
  res.json(newMusic)
});

app.get("/artist/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const artist = await getArtist(id)
  res.json(artist)
});

app.get("/collectibles/sk", verifyAuth, async (req, res) => {
  const sk = req.query.sk;
  const collectible = await getCollectiblesBySk(sk)
  res.json(collectible)
});

app.get("/artist/collectibles/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const collectibles = await getArtistCollectibles(id)
  res.json(collectibles)
});

app.post("/artist/collectible", verifyAuth, async (req, res) => {
  const artist = req.body.artist;
  const achievement = req.body.achievement;
  const collector = await createArtistCollectible(artist, achievement)
  res.json(collector)
});

app.get("/artist/collectors/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const collectors = await getArtistCollectors(id)
  res.json(collectors)
});

app.get("/artist/collector/:id", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const pk = req.query.pk;
  const collector = await getArtistCollector(pk, id)
  res.json(collector)
});

app.post("/artist/collector/:id/:pk", verifyAuth, async (req, res) => {
  const id = req.params.id;
  const pk = req.params.pk;
  const user = req.body.user;
  const collectibleCount = req.body.collectibleCount;
  const collector = await createArtistCollector(id, pk, user, collectibleCount)
  res.json(collector)
});

/**
 * Collections and NFTs endpoints.
 *
 * Uses Simplehash to get NFTs for address. For more information, read https://simplehash.readme.io/reference/overview
 */
 app.get("/account/collections", verifyAuth, async (req, res) => { 
  const pk = req.query.pk;
  const collections = await getCollections(pk)
  res.json(collections)
});

app.post("/account/collections/:pk", verifyAuth, async (req, res) => {
  const pk = req.params.pk;
  const data = req.body;
  const collection = await createCollection(pk, data)
  res.json(collection)
});

app.delete("/account/collections/:pk", verifyAuth, async (req, res) => {
  const pk = req.params.pk;
  const sk = req.body.sk;
  const collection = await deleteCollection(pk, sk)
  res.json(collection)
});

app.get("/account/collection", verifyAuth, async (req, res) => {
  const pk = req.query.pk;
  const sk = req.query.sk;
  const collection = await getCollection(pk, sk)
  res.json(collection)
});

app.get("/account/nfts", verifyAuth, async (req, res) => {
  const nfts = await getNFTsByOwner(
    req.query.chains,
    req.query.addresses,
    req.query.nextUrl
  );
  res.json(sortNftsFromSimpleHash(nfts));
});

app.get("/account/nft", verifyAuth, async (req, res) => {
  const nft = await getNFTByTokenId(
    req.query.chain,
    req.query.contractAddress,
    req.query.tokenId
  );
  res.json(nft);
});

/**
 * ThirdWeb integration endpoints. 
 * These endpoints are used to integrate with the ThirdWeb SDK
 */
 app.post("/nft/mint/spotify/track", verifyAuth, async (req, res) => {
  const walletAddress = req.body.walletAddress;
  const track = req.body.track;

  let artists = track.artists.map((artist) => artist.name).join(", ");
  artists = artists.replace(/,\s*$/, "");
  const nftMetadata = {
    name: `Streamed ${track.name} from ${artists} in first 24 hours of release`,
    description: `${track.name} from ${artists} played at ${track.played_at}`,
    image: getRandomCollectibleImageFromS3(), //TODO: this is random. At some point we should track what collectibles the user alreadt owns and not give them the same one.
    track
  };

  console.log("This is our nft metadata: ", nftMetadata);

  const result = await mintNFTToAddress(walletAddress, nftMetadata);
  res.json(result);
});

app.post("/nft/mint/spotify/artist", verifyAuth, async (req, res) => {
  console.log("this is what the body looks like: ", req.body)
  const walletAddress = req.body.walletAddress;
  const artist = req.body.artist;
  const streamedMilliseconds = req.body.streamedMilliseconds;

  const nftMetadata = {
    name: `${getCurrentAcheivement(streamedMilliseconds)} of ${artist.name}`,
    description: `${getCurrentAcheivement(streamedMilliseconds)} of ${artist.name} on Spotify.`,
    image: getRandomCollectibleImageFromS3(), //TODO: this is random. At some point we should track what collectibles the user alreadt owns and not give them the same one.
    artist
  };

  console.log("This is our nft metadata: ", nftMetadata);

  const result = await mintNFTToAddress(walletAddress, nftMetadata);
  res.json(result);
});

/**
* Private Route: Requires x-api-key header
*/
app.post("/email/send", async (req, res) => {
  const templateName = req.body.templateName;
  const emailAddress = req.body.emailAddress;
  const result = await sendEmailTemplate(emailAddress, templateName);
  res.json(result);
});

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });

module.exports.handler = serverless(app, {
  binary: ['image/png', 'image/gif', 'image/jpeg', 'image/jpg', 'image/svg+xml']
})