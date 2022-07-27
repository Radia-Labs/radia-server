import request from "request";
import dotenv from "dotenv";
dotenv.config();

export const getSolUSDPrice = () => {
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

export const getPolygonUSDPrice = () => {
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

export const getNFTsFromSimpleHash = (chains, addresses) => {
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
 * Authorization Code and Refresh Token oAuth2 flows to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#client_credentials_flow
 */

var client_id = process.env.SPOTIFY_CLIENT_ID;
var client_secret = process.env.SPOTIFY_CLIENT_SECRET;
var redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

export const getSpotifyAuthTokens = (code) => {
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

export const refreshSpotifyAccessToken = (refreshToken) => {
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
