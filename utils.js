const request = require("request")
const { ThirdwebSDK } = require("@thirdweb-dev/sdk")
const dotenv = require( "dotenv")
dotenv.config();

const mailchimp = require('@mailchimp/mailchimp_transactional')(process.env.MAILCHIMP_API_KEY);
const AWS =  require('aws-sdk');
const TABLE_NAME = process.env.DB_TABLE_NAME;
const ARTIST_TABLE_NAME = process.env.ARTIST_DB_TABLE_NAME;
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
 module.exports.getNFTsByOwner= function(chains, addresses, nextUrl) {
  let url = `https://api.simplehash.com/api/v0/nfts/owners?chains=${chains}&wallet_addresses=${addresses}`
  if (nextUrl)
    url = nextUrl

  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      url: url,
      headers: {
        Accept: "application/json",
        "X-API-KEY": process.env.SIMPLEHASH_API_KEY,
      },
    };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      const data = JSON.parse(body);
      resolve(data);
    });
  });
};

module.exports.getNFTByTokenId= function(chain, contractAddress, tokenId) {
  console.log(chain, contractAddress, tokenId)
  let url = `https://api.simplehash.com/api/v0/nfts/${chain}/${contractAddress}/${tokenId}`
  return new Promise((resolve, reject) => {
    const options = {
      method: "GET",
      url: url,
      headers: {
        Accept: "application/json",
        "X-API-KEY": process.env.SIMPLEHASH_API_KEY,
      },
    };

    request(options, function (error, response, body) {
      if (error) throw new Error(error);
      const data = JSON.parse(body);
      resolve(data);
    });
  });
};

/**
 * Collections functions.
 */

 module.exports.getCollections = (pk, limit, lastEvaluatedKey) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Collection|`
      }
  }
  if (limit)
    queryParams.Limit = limit
    
  if (lastEvaluatedKey){
    queryParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getCollection = (pk, sk) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and ${SORT_KEY} = :sk`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': sk
      }
  }

  return documentClient.query(queryParams).promise()
}

module.exports.deleteCollection = (pk, sk) => {
  const queryParams = {
      TableName: TABLE_NAME,
      Key: {
        [PARTITION_KEY]: pk,
        [SORT_KEY]: sk
    }
  }

  return documentClient.delete(queryParams).promise()
}

module.exports.createCollection = async (pk, data) => {
  const newItem = {
    TableName: TABLE_NAME,
    Item: {
      [PARTITION_KEY]: pk,
      [SORT_KEY]: `Collection|${data.name}`,
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
}


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

module.exports.getSpotifyArtist = function(id, accessToken) {
  var options = {
    url: `https://api.spotify.com/v1/artists/${id}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

module.exports.getSpotifySimilarArtists = function(id, accessToken) {
  var options = {
    url: `https://api.spotify.com/v1/artists/${id}/related-artists`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

module.exports.getSpotifyNewMusic = function(accessToken, nextUrl) {
  let url = 'https://api.spotify.com/v1/browse/new-releases?limit=50'
  if (nextUrl)
    url = nextUrl

  var options = {
    url: url,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
        resolve(body);
      }
    });
  });
}

module.exports.getSpotifyProfile = function(accessToken) {
  var options = {
    url: `https://api.spotify.com/v1/me`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
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

  const nftCollection = sdk.getNFTCollection(process.env.RADIA_NFT_CONTRACT_ADDRESS);
  
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

module.exports.updateUser = (pk, data) => {
  let updateExpression = '',
      attrExpression = {},
      values = {};
  for (let key in data) {
      updateExpression += updateExpression === '' ? `SET #${key} = :${key}` : `, #${key} = :${key}`;
      attrExpression = {
          ...attrExpression,
          [`#${key}`]: key
      }
      values = {
          ...values,
          [`:${key}`]: data[key]
      }
  }

  const updateParams = {
      TableName: TABLE_NAME,
      Key: {
          [PARTITION_KEY]: pk,
          [SORT_KEY]: `Auth|${pk}`,
      },
      ExpressionAttributeNames: attrExpression,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: values,
  }

  return documentClient.update(updateParams).promise()
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


module.exports.getCollectibles = (pk, limit, lastEvaluatedKey) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Collectible|`
      }
  }
  if (limit)
    queryParams.Limit = limit
    
  if (lastEvaluatedKey){
    queryParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getCollectible = (pk, sk) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and ${SORT_KEY} = :sk`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': sk
      }
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getCollectiblesBySk = (sk) => {
  const queryParams = { 
    TableName: TABLE_NAME,
    IndexName: 'sk-index',
    KeyConditionExpression: 'sk = :sk',
    ExpressionAttributeValues: {':sk': sk} 
  };  

  return documentClient.query(queryParams).promise()
}

module.exports.getArtists = (pk, limit, lastEvaluatedKey) => {
  const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Artist|`
      },
  }
  if (lastEvaluatedKey){
    queryParams.ExclusiveStartKey = JSON.parse(lastEvaluatedKey);
  }

  if (limit)
    queryParams.Limit = limit  

  return documentClient.query(queryParams).promise()
}

module.exports.getArtist = (pk) => {
  const queryParams = {
      TableName: ARTIST_TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Artist|`
      },
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getArtistCollectibles = (pk) => {
  const queryParams = {
      TableName: ARTIST_TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Collectible|`
      },
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getArtistCollectors = (pk) => {
  const queryParams = {
      TableName: ARTIST_TABLE_NAME,
      KeyConditionExpression: `${PARTITION_KEY} = :pk and begins_with(${SORT_KEY}, :sk)`,
      ExpressionAttributeValues: {
          ':pk': pk,
          ':sk': `Collector|`
      },
  }

  return documentClient.query(queryParams).promise()
}

module.exports.getArtistCollector = async (pk, artistId) => {
  const queryParams = {
      TableName: ARTIST_TABLE_NAME,
      KeyConditionExpression: 'pk = :pk and sk = :sk',
      ExpressionAttributeValues: {
          ':pk': `${artistId}`,
          ':sk': `Collector|spotify|${pk}`,
      },
  };
  console.log(queryParams)
  const collector= await documentClient.query(queryParams).promise();
  return collector;
}

module.exports.createArtistCollector = async (artistId, pk, user, collectibleCount) => {
  const newItem = {
    TableName: ARTIST_TABLE_NAME,
    Item: {
      ['pk']: `${artistId}`,
      ['sk']: `Collector|spotify|${pk}`,
      created: Date.now(),
      updated: Date.now(),
      collectibleCount,
      user: {
        profileImage: user.profileImage,
        verifierId: user.verifierId,
        name: user.name,
        addresses: user.addresses
      }
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
}

module.exports.sendEmailTemplate = async (emailAddress, templateName) => {
    const response = await mailchimp.messages.sendTemplate({
      template_name: templateName,
      template_content: [{}],
      message: {
        subject: "You Earned a new Collectible on Radia",
        to: [{
          email: emailAddress
        }],
        from_email: "alex@radia.world"
      }
    });
    console.log(response);
}

module.exports.createArtistCollectible = async (artist, achievement) => {
  const newItem = {
    TableName: ARTIST_TABLE_NAME,
    Item: {
      ['pk']: `${artist.id}`,
      ['sk']: `Collectible|spotify|${achievement}|${artist.id}`,
      created: Date.now(),
      updated: Date.now(),
      achievement,
      artist
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
}

module.exports.createUserArtistCollectible = async (pk, artist, achievement, streamedMilliseconds, user, status, transaction) => {
  const newItem = {
    TableName: TABLE_NAME,
    Item: {
      ['pk']: pk,
      ['sk']: `Collectible|spotify|${achievement}|${artist.id}`,
      created: Date.now(),
      updated: Date.now(),
      achievement,
      streamedMilliseconds,
      artist,
      user: {
        profileImage: user.profileImage,
        verifierId: user.verifierId,
        name: user.name,
        addresses: user.addresses
      },      
      status,
      transaction
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
}

module.exports.createUserTrackCollectible = async (pk, artist, track, achievement, user, status, transaction) => {
  const newItem = {
    TableName: TABLE_NAME,
    Item: {
      ['pk']: pk,
      ['sk']: `Collectible|spotify|${achievement}|${artist.id}`,
      created: Date.now(),
      updated: Date.now(),
      achievement,
      artist,
      track,
      user: {
        profileImage: user.profileImage,
        verifierId: user.verifierId,
        name: user.name,
        addresses: user.addresses
      },      
      status,
      transaction
    },
  };

  return documentClient
    .put(newItem)
    .promise()
    .then((_) => {
      return Promise.resolve(newItem.Item);
    });
}

module.exports.getCurrentAcheivement = (streamedMilliseconds) => {
  if (streamedMilliseconds < 3600000 ) {
    return 'Streamed 1 Hour'
  }

  if (streamedMilliseconds > 3600000 && streamedMilliseconds < 3600000 * 5) {
    return 'Streamed 5 Hours'
  }  
  
  if (streamedMilliseconds > 3600000 * 5 && streamedMilliseconds < 3600000 * 10) {
    return 'Streamed 10 Hours'
  }       

  if (streamedMilliseconds > 3600000 * 10 && streamedMilliseconds < 3600000 * 15) {
    return 'Streamed 15 Hours'
  }        

  if (streamedMilliseconds > 3600000 * 15 && streamedMilliseconds < 3600000 * 25) {
    return 'Streamed 25 Hours'
  }     
}

module.exports.getRandomCollectibleImageFromS3 = () => {
  const randomId = Math.floor(Math.random() * (700 - 0));
  console.log( `${process.env.RADIA_NFT_MEDIA_CDN}/${randomId}.png` )
  return `${process.env.RADIA_NFT_MEDIA_CDN}/${randomId}.png`
}