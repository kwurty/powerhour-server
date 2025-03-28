'use strict'

const path = require('node:path');
const AutoLoad = require('@fastify/autoload');
const fastifyJwt = require('@fastify/jwt');
const fastifyMysql = require('@fastify/mysql');
const { registerCorsProvider } = require('./providers/cors.ts');
// Pass --options via CLI arguments in command to enable these options.
const options = { PORT: 4000 }

module.exports = async function (fastify, opts) {
  // Place here your custom code!

  registerCorsProvider(fastify);

  fastify.register(fastifyMysql, {
    promise: true,
    connectionString: `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}/${process.env.DB_NAME}`
  });


  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: Object.assign({}, opts)
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: Object.assign({}, opts)
  });
}

module.exports.options = options
