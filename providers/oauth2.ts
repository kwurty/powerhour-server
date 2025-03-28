const OAuth2 = require("@fastify/oauth2");

/**
 * Google OAuth2 Options
 * Namespace: GoogleOAuth2
 * Scopes: email
 * Client credentials and Google configuration provided.
 */
const googleOAuth2Options = {
  name: "GoogleOAuth2",
  scope: ["email", "userinfo.profile", "userinfo.email"],
  credentials: {
    client: {
      id: process.env.GOOGLE_CLIENT_ID,
      secret: process.env.GOOGLE_CLIENT_SECRET,
    },
    auth: OAuth2.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: "/auth/login/google",
  callbackUri: `http://localhost:3333/auth/login/google/callback`,
  generateStateFunction: (request, reply) => {
    return request.query.state;
  },
  checkStateFunction: (request, callback) => {
    if (request.query.state) {
      callback();
      return;
    }
    callback(new Error("Invalid state"));
  },
};

function registerGoogleOAuth2Provider(app) {
  app.register(OAuth2, googleOAuth2Options);
}

module.exports = {
  registerGoogleOAuth2Provider,
};
