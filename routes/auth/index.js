// auth.js
// const { getConnection } = require('../..plugins/db'); // Import database connection utility
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');

async function authRoutes(fastify, options) {

    // Register route
    fastify.post('/register', async (request, reply) => {
        const { email, password, name } = request.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await fastify.mysql.getConnection()
        try {
            const [result] = await connection.query('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', [email, hashedPassword, name]);
            reply.send({ id: result.insertId, email, name });
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                reply.code(400).send({ error: 'Email already exists' });
            } else {
                reply.code(500).send({ error: 'Database error' });
            }
        } finally {
            await connection.release();
        }
    });

    // Login route
    fastify.post('/login', async (request, reply) => {
        const { email, password } = request.body;
        const connection = await fastify.mysql.getConnection()

        try {
            const [users] = await connection.query('SELECT * FROM Users WHERE email = ?', [email]);
            const user = users[0];

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            const token = fastify.jwt.sign({ id: user.id });
            reply.send({ token });
        } catch (error) {
            reply.code(500).send({ error: 'Database error' });
        } finally {
            await connection.release();
        }
    });

    // //oauth login
    // fastify.get('/login/google', async (request, reply) => {
    //     const redirectUri = process.env.GOOGLE_CALLBACK_URL;
    //     const scope = 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
    //     const state = 'userinfo.email'; // You may want to use a proper random state string for CSRF protection

    //     const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    //     reply.redirect(authUrl);
    // })

    //oauth callback
    fastify.get('/login/google/callback', async (request, reply) => {
        // Get the access token from the Google service and save it into the token value
        const { token } = await fastify.GoogleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
        if (!token || !token.access_token) {
            reply.status(500).redirect("http://localhost:3000/")
        }
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: 'Bearer ' + token.access_token
                },
                json: true
            })
            const userInfo = await response.json();

            const { sub, given_name, email } = userInfo
            const connection = await fastify.mysql.getConnection()
            let [user] = await connection.query('SELECT * FROM Users WHERE googleId = ?', [sub]);
            if (!user[0]) {
                await connection.query('INSERT INTO Users (email, googleId, name, password) VALUES (?, ?, ?, ?)', [email, sub, given_name, token.access_token]);
                user = await connection.query('SELECT id, name FROM Users WHERE googleId = ?', [sub]);
            }
            // Generate JWT token
            const jwtToken = fastify.jwt.sign({ id: user[0].id, username: email });
            return reply.redirect("http://localhost:3000/login?token=" + jwtToken);
        }
        catch (e) {
            return
        }
    })

}

module.exports = authRoutes;