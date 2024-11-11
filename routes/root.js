'use strict'

module.exports = async function (fastify, opts) {
  fastify.get('/', async function (request, reply) {
    return { root: true }
  })

  fastify.get('/testconnection', async function (req, reply) {
    const connection = await fastify.mysql.getConnection()
    const [rows, fields] = await connection.query(
      'SELECT * FROM Users'
    )
    connection.release()
    return rows[0]
  })
  fastify.get(
    "/testauth",
    {
      onRequest: [fastify.authenticate]
    },
    async function (request, reply) {
      return request.user
    }
  )
}
