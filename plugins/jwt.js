const fp = require("fastify-plugin")

module.exports = fp(async function (fastify, opts) {
    fastify.register(require("@fastify/jwt"), {
        secret: process.env.JWT_SECRET,
        cookie: {
            cookieName: 'powerhour',
            signed: false
        }
    })

    fastify.decorate("authenticate", async function (request, reply) {
        try {
            await request.jwtVerify()
            let ver = request.jwtVerify()
            console.log(ver);
        } catch (err) {
            reply.send(err)
        }
    })
})