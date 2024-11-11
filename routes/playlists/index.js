async function playlistRoutes(fastify, options) {
    fastify.get('/', async (request, reply) => {

    })

    fastify.get('/:id', async (request, reply) => {

    })

    // fastify.post('/', async (request, reply) => { })
    //     const { user_id, name, is_bookmarked, likes } = request.body;
    //     const connection = await fastify.mysql.getConnection()
    //     const query = 'INSERT INTO Playlists(user_id, name, is_bookmarked, likes) VALUES($1, $2, $3, $4) RETURNING *';
    //     const values = [user_id, name, is_bookmarked, likes];
    //     try {
    //         const result = await connection.query(query, values);
    //         reply.send(result.rows[0]);
    //     } catch (error) {
    //         reply.send(error);
    //     } finally {
    //         client.release();
    //     }
    // })

    // fastify/routes/playlistRoutes.js

    fastify.post('/', { preHandler: fastify.authenticate }, async (request, reply) => {
        const { name, videos } = request.body;
        const userId = request.user.id;

        // Validation (for example, checking required fields)
        if (!userId || !name) {
            reply.status(400).send({ error: 'User ID and name are required.' });
            return;
        }

        try {
            const [result] = await fastify.mysql.query(
                'INSERT INTO Playlists (UserID, name) VALUES (?, ?)',
                [userId, name]
            );

            // If successfully created playlist, import the songs
            if (result.insertId) {
                const insertVideos = videos.map(video => [video.id, video.snippet.title])
                const [videoResult] = await fastify.mysql.query(
                    'INSERT IGNORE INTO Videos (id, Name) VALUES (?, ?)',
                    insertVideos
                );

                if (videoResult) {
                    const videoPlaylistMap = videos.map(video => [result.insertId, video.id])
                    const [videoPlaylistMapResult] = await fastify.mysql.query(
                        'INSERT INTO Playlist_Videos (PlaylistID, VideoID) VALUES (?, ?)', videoPlaylistMap
                    )
                }
            }

            reply.status(201).send({ id: result.insertId, userId, name });
        } catch (error) {
            reply.status(500).send({ error: 'Database error', details: error.message });
        }
    });

    fastify.post('/videos', { preHandler: fastify.authenticate }, async (request, reply) => {
        const { playlistID, videos } = request.body;
        if (!playlistID || videos.length < 1) {
            reply.status(400).send({ error: 'Playlist does not exist or no videos to add' })
        }

        const insertVideos = videos.map(video => [video.id, video.title])

        try {
            const [result] = await fastify.mysql.query(
                'INSERT IGNORE INTO Videos (id, Name) VALUES (?, ?)',
                []
            );

            // Respond with the new playlist ID and name if successful
            reply.status(201).send({ id: result.insertId, userId, name });
        } catch (error) {
            reply.status(500).send({ error: 'Database error', details: error.message });
        }

    })


    fastify.post('/:id', async (request, reply) => {

    })

    fastify.post('/:id/like', async (request, reply) => {

    })
}

module.exports = playlistRoutes;