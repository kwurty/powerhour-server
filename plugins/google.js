const fp = require("fastify-plugin")
const fastifyOauth2 = require('@fastify/oauth2');

module.exports = fp(async function (fastify, opts) {
    fastify.register(fastifyOauth2, {
        name: 'GoogleOAuth2',
        scope: ['email', 'profile'],
        credentials: {
            client: {
                id: process.env.GOOGLE_CLIENT_ID,
                secret: process.env.GOOGLE_CLIENT_SECRET
            },
            auth: fastifyOauth2.GOOGLE_CONFIGURATION
        },
        startRedirectPath: '/auth/login/google',
        callbackUri: process.env.GOOGLE_CALLBACK_URL
    });
})