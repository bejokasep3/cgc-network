const integrationSdk = require('sharetribe-flex-integration-sdk');

const CLIENT_ID = process.env.SHARETRIBE_INTEGRATION_CLIENT_ID;
const CLIENT_SECRET = process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET;
const BASE_URL = process.env.REACT_APP_SHARETRIBE_SDK_BASE_URL;

const baseUrlMaybe = BASE_URL ? { baseUrl: BASE_URL } : {};

// The Integration SDK is separate from the trusted/user SDK in sdk.js: it
// authenticates as the Integration application (client credentials grant,
// no user token) and can query users directly, which the regular Marketplace
// SDK cannot do — that one only searches listings.
let cachedSdk = null;

const getIntegrationSdk = () => {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'Missing SHARETRIBE_INTEGRATION_CLIENT_ID / SHARETRIBE_INTEGRATION_CLIENT_SECRET. ' +
        'Create an Integration application in Sharetribe Console (Build -> Applications) ' +
        'and set these in your .env file.'
    );
  }

  if (!cachedSdk) {
    cachedSdk = integrationSdk.createInstance({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      ...baseUrlMaybe,
    });
  }

  return cachedSdk;
};

module.exports = { getIntegrationSdk };
