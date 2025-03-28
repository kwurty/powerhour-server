const Cors = require("@fastify/cors");

/**
 * Cors Policies Options
 * Allow all origins
 * VERY IMPORTANT: In response, the server returns an Access-Control-Allow-Origin header with Access-Control-Allow-Origin: *
 * which means that the resource can be accessed by any origin. (VERY DANGEROUS!)
 * You can read more about it here:
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */
const corsOptions = {
    origin: "*"
};

function registerCorsProvider(app) {
    app.register(Cors, corsOptions);
}

module.exports = {
    registerCorsProvider
};
