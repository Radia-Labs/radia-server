const request = require("request")
const { ThirdwebSDK } = require("@thirdweb-dev/sdk")
const dotenv = require( "dotenv")
dotenv.config();

const AWS =  require('aws-sdk');
const TABLE_NAME = process.env.DB_TABLE_NAME;
const PARTITION_KEY = 'pk';
const SORT_KEY = 'sk';

const DynamoDB = new AWS.DynamoDB({
  accessKeyId: process.env.AWS_ACCESS_ID,
  secretAccessKey: process.env.AWS_ACCESS_SECRET,
  region: process.env.AWS_REGION_NAME,
});
const documentClient = new AWS.DynamoDB.DocumentClient({
  service: DynamoDB
});

/**
 * Binance API functions. Used to get prices of various cryptocurrencies.
 */
 module.exports.getSolUSDPrice = function() {
  return new Promise((resolve, reject) => {
    const url = "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT";
    request(url, function (error, response, body) {
      if (error) {
        reject(error);
      }
      const data = JSON.parse(body);
      resolve(data.price);
    });
  });
};

module.exports.getPolygonUSDPrice = function() {
  return new Promise((resolve, reject) => {
    const url = "https://api.binance.com/api/v3/ticker/price?symbol=MATICUSDT";
    request(url, function (error, response, body) {
      if (error) {
        reject(error);
      }
      const data = JSON.parse(body);
      resolve(data.price);
    });
  });
};

/**
 * SimpleHash functions. Used to query varios cahins and addresses.
 */
 module.exports.getNFTsFromSimpleHash = function(chains, addresses) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      url: `https://api.simplehash.com/api/v0/nfts/owners?chains=${chains}&wallet_addresses=${addresses}`,
      headers: {
        Accept: "application/json",
        "X-API-KEY": process.env.SIMPLEHASH_API_KEY,
      },
    };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      const data = JSON.parse(body);
      resolve(data.nfts);
    });
  });
};

/**
 * Spotify functions. Authorization Code and Refresh Token oAuth2 flows to authenticate against
 * the Spotify Accounts. Also these functions are used to get the Spotify user's recently played tracks and match them specific timeframes. 
 * For more information, read https://developer.spotify.com/web-api/authorization-guide/#client_credentials_flow
 */
var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var redirect_uri = process.env.SPOTIFY_WEB_REDIRECT_URI;
module.exports.getSpotifyAuthTokens = function(code) {
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
    },
    form: {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect_uri,
    },
    json: true,
  };
  return new Promise((resolve, reject) => {
    request.post(authOptions, function (error, response, body) {    
      if (!error && response.statusCode === 200) {
        resolve(body);
      }
    });
  });
};

module.exports.refreshSpotifyAccessToken =function(refreshToken) {
  var authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${client_id}:${client_secret}`
      ).toString("base64")}`,
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    },
    json: true,
  };
  return new Promise((resolve, reject) => {
    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        var token = body.access_token;
        resolve(token);
      }
    });
  });
};

module.exports.getSpotifyArtist = function(data) {
  var options = {
    url: `https://api.spotify.com/v1/artists/${data.id}`,
    headers: {
      Authorization: `Bearer ${data.accessToken}`,
    },
    json: true
  };

  return new Promise((resolve, reject) => {
    request.get(options, function (error, response, body) {
      if (error)
        resolve({error: true, message: "Something went wrong with the request. Try again.", statusCode: 500});
      if (!error && response.statusCode === 401)
        resolve({error: true, message: "Unauthorized", statusCode: 401});
      if (!error && response.statusCode === 200) {
        // checkIfTrackReleaseDateWithinLast24Hours(body.items) // TODO: this would probably go in the lambda function
        resolve(body);
      }
    });
  });
}

module.exports.getSpotifyTopArtists = function(accessToken) {
  var options = {
    url: `https://api.spotify.com/v1/me/top/artists`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    json: true
  };

  return new Promise((resolve, reject) => {
    request.get(options, function (error, response, body) {
      console.log(response)
      if (error)
        resolve({error: true, message: "Something went wrong with the request. Try again.", statusCode: 500});
      if (!error && response.statusCode === 401)
        resolve({error: true, message: "Unauthorized", statusCode: 401});
      if (!error && response.statusCode === 200) {
        resolve(body);
      }
    });
  });
}

// TODO: deprecated- now reside within lambda functions
// module.exports.getSpotifyRecentPlayed = function(data) {
//   var options = {
//     url: "https://api.spotify.com/v1/me/player/recently-played",
//     headers: {
//       Authorization: `Bearer ${data.accessToken}`,
//     },
//     json: true,
//     qs: {}
//   };
//   if (data.after)
//     options.qs = {after: data.after}
//   if (data.before)
//     options.qs = {before: data.before}
//   options.qs = {limit: 50}

//   return new Promise((resolve, reject) => {
//     request.get(options, function (error, response, body) {
//       if (error)
//         resolve({error: true, message: "Something went wrong with the request. Try again.", statusCode: 500});
//       if (!error && response.statusCode === 401)
//         resolve({error: true, message: "Unauthorized", statusCode: 401});
//       if (!error && response.statusCode === 200) {
//         // checkIfTrackReleaseDateWithinLast24Hours(body.items) // TODO: this would probably go in the lambda function
//         resolve(body);
//       }
//     });
//   });
// }

// TODO: deprecated- now reside within lambda functions
// module.exports.checkIfTrackReleaseDateWithinLast24Hours = function(items) {
//   items.forEach(item => {
//     if (item.track.album.release_date) {
//       const releaseDate = new Date(item.track.album.release_date)
//       const now = new Date()
//       const diff = now - releaseDate
//       if (diff > 0 && diff < (24 * 3600 * 1000)) {
//         console.log(`${item.track.name} is within 24 hours of release`)
//       }
//     }
//   });
// }


/**
 * Thirdweb functions.
 * These functions are used to get data from the ThirdwebAPI and mint NFTs to a wallet address.
 */
 module.exports.mintNFTToAddress = async function (walletAddress, metadata) {
  const sdk = ThirdwebSDK.fromPrivateKey(process.env.DEPLOYER_ACCOUNT_PK, "polygon");

  const nftCollection = sdk.getNFTCollection(process.env.DRAGON_NFT_CONTRACT_ADDRESS);
  
  const tx = await nftCollection.mintTo(walletAddress, metadata);
  const receipt = tx.receipt; // the transaction receipt
  const tokenId = tx.id; // the id of the NFT minted
  const nft = await tx.data(); // (optional) fetch details of minted NFT  

  console.log(receipt, tokenId, nft)
  return {receipt, tokenId, nft}
}


/**
 * DynamoDB User Functions.
 * These functions are used to interact with the DynamoDB table that stores user information
 */
 module.exports.createUser = function (data) {
  const pk = data.verifierId
  const newItem = {
    TableName: TABLE_NAME,
    Item: {
      [PARTITION_KEY]: pk,
      [SORT_KEY]: `Auth|${pk}`,
      created: Date.now(),
      updated: Date.now(),
      ...data,
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
};

module.exports.getUser = (pk) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and ${SORT_KEY} = :sk`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Auth|${pk}`
      },
  }

  return documentClient.query(queryParams).promise()
}

/**
 * DynamoDB Integration Functions.
 * These functions are used to interact with the DynamoDB table that stores user integration information
 */
 module.exports.createIntegration = function(type, pk, data) {
  const newItem = {
    TableName: TABLE_NAME,
    Item: {
      [PARTITION_KEY]: pk,
      [SORT_KEY]: `Integration|${type}`,
      created: Date.now(),
      updated: Date.now(),
      ...data,
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
};

module.exports.getIntegration = function(type, pk) {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and ${SORT_KEY} = :sk`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Integration|${type}`
      },
  }
  return documentClient.query(queryParams).promise()
}


module.exports.getCollectibles = (pk, lastEvaluatedKey) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Collectible|`
      },
      Limit: 4
  }
  if (lastEvaluatedKey){
    queryParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
  }

  return documentClient.query(queryParams).promise()
}


module.exports.getArtists = (pk, lastEvaluatedKey) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Artist|`
      },
      Limit: 9
  }
  if (lastEvaluatedKey){
    queryParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
  }

  return documentClient.query(queryParams).promise()
}