const jose = require("jose")

// JWT verification using JWKS
// https://web3auth.io/docs/server-side-verification/social-login-users

// TODO: also support external wallets 
// https://web3auth.io/docs/server-side-verification/external-wallets
module.exports.verifyAuth = async (req, res, next) => {
    // passed from the frontend in the Authorization header
    const idToken = req.headers.authorization?.split(' ')[1];

    // passed from the frontend in the request body or query param
    const app_pub_key = req.body.appPubKey || req.query.appPubKey;

    if (!idToken || !app_pub_key) {
        return res.status(400).json({
            error: "Missing Authorization header or appPubKey in request body"
        });
    }
    
    try {
        // Try social user verification first
        const jwks = jose.createRemoteJWKSet(new URL("https://api.openlogin.com/jwks"));
        const jwtDecoded = await jose.jwtVerify(idToken, jwks, { algorithms: ["ES256"] });
        if ((jwtDecoded.payload).wallets[0].public_key.toLowerCase() === app_pub_key.toLowerCase()) {
            // Verified
            next();
        } else {
            res.status(401).json({error: 'Unauthorized'})
        }        
        
    } catch (error) {
        // Try external Wallet verification second
        const verified = await verifyExternalWallet(idToken, app_pub_key)
        if (verified)
            next();
        else
            res.status(401).json({error: 'Unauthorized'})
    }

}

const verifyExternalWallet = async (idToken, app_pub_key) => {
    const jwks = jose.createRemoteJWKSet(new URL("https://auth-js-backend.tor.us/jwks"));
    const jwtDecoded = await jose.jwtVerify(idToken, jwks, { algorithms: ["ES256"] });
    if ((jwtDecoded.payload).wallets[0].address.toLowerCase() === app_pub_key.toLowerCase()) {
        return true;
    } else {
        return false;
    }       
}