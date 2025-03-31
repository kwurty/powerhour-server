async function playlistRoutes(fastify, options) {
    fastify.get('/', { preHandler: fastify.softauthenticate }, async (request, reply) => {
        const searchQuery = request.query.search || "";
        console.log('request-query:', request.query)
        const searchText = decodeURIComponent(searchQuery);
        const page = parseInt(request.query.page, 10) || 1; // Default to page 1
        const limit = 10;
        const offset = (page - 1) * limit;

        console.log('searchtext', searchText)
        console.dir(request.query)

        try {
            let query = `
            SELECT
                Playlists.id AS playlist_id,
                Playlists.Name AS playlist_name,
                Users.id AS user_id,
                Users.name AS user_name,
                COUNT(Playlist_Likes.id) AS like_count
                ${request.authenticated && request.user.id ? ", MAX(Playlist_Likes.UserID = ?) AS user_liked" : ""}
                ${request.authenticated && request.user.id ? ", MAX(Playlist_Bookmarks.UserID = ?) AS user_bookmarked" : ""}
            FROM Playlists
            JOIN Users ON Users.id = Playlists.UserID
            LEFT JOIN Playlist_Likes ON Playlist_Likes.PlaylistID = Playlists.id
            ${request.authenticated && request.user.id ? "LEFT JOIN Playlist_Bookmarks ON Playlist_Bookmarks.PlaylistID = Playlists.id" : ""}
            WHERE Playlists.Name LIKE ?
            GROUP BY Playlists.id, Playlists.Name, Users.id, Users.name
            LIMIT ? OFFSET ?;
        `;

            // Values array for prepared statements
            const values = [];
            if (request.authenticated && request.user.id) {
                values.push(request.user.id, request.user.id);
            }
            values.push(`%${searchText}%`, limit, offset);

            // Execute the query
            const [result] = await fastify.mysql.query(query, values);

            // Get total count for pagination
            const countQuery = `
            SELECT COUNT(*) AS total FROM Playlists WHERE Playlists.Name LIKE ?;
        `;
            const [countResult] = await fastify.mysql.query(countQuery, [`%${searchText}%`]);
            const totalRecords = countResult[0]?.total || 0;
            const totalPages = Math.ceil(totalRecords / limit);

            if (result.length > 0) {
                reply.status(200).send({
                    page,
                    total_pages: totalPages,
                    total_records: totalRecords,
                    results: result,
                });
            } else {
                reply.status(204).send({ error: 'No Content', details: 'No playlists found' });
            }

        } catch (error) {
            reply.status(500).send({ error: 'Database error', details: error.message });
        }
    });


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
                const insertVideos = videos.map(video => [video.id, video.name, video.description, video.thumbnails.default.url, video.thumbnails.medium.url, video.thumbnails.high.url, video.duration])
                const [videoResult] = await fastify.mysql.query(
                    'INSERT IGNORE INTO Videos (id, Name, Description, ThumbnailSmall, ThumbnailMedium, ThumbnailLarge, Duration) VALUES ?',
                    [insertVideos]
                );

                if (videoResult) {
                    const videoPlaylistMap = videos.map(video => [result.insertId, video.id, video.starttime])
                    const [videoPlaylistMapResult] = await fastify.mysql.query(
                        'INSERT INTO Playlist_Videos (PlaylistID, VideoID, StartTime ) VALUES ?', [videoPlaylistMap]
                    )

                    if (videoPlaylistMapResult.affectedRows >= 1) {
                        const query = `
                                SELECT 
                                    p.ID AS playlist_id,
                                    p.Name AS playlist_name,
                                    u.ID AS user_id,
                                    u.Name AS user_name,
                                    v.ID AS video_id,
                                    v.Name AS video_name,
                                    v.Duration as duration,
                                    v.ThumbnailLarge as thumbnail_large,
                                    v.ThumbnailMedium as thumbnail_medium,
                                    v.ThumbnailSmall as thumbnail_small,
                                    v.Description as description,
                                    pv.StartTime
                                FROM 
                                    Playlists p
                                JOIN 
                                    Users u ON p.UserID = u.ID
                                JOIN 
                                    Playlist_Videos pv ON p.ID = pv.PlaylistID
                                JOIN 
                                    Videos v ON pv.VideoID = v.ID
                                WHERE 
                                    p.ID = ${result.insertId};
                            `;

                        const [rows] = await fastify.mysql.query(query, [result.insertId]);

                        if (rows.length < 1) {
                            reply.status(404).send({ error: 'Playlist not found' })
                        } else {
                            const playlist = {
                                id: rows[0].playlist_id,
                                name: rows[0].playlist_name,
                                user_id: rows[0].user_id,
                                user_name: rows[0].user_name,
                                videos: rows.map(row => ({
                                    id: row.video_id,
                                    name: row.video_name,
                                    starttime: row.StartTime,
                                    duration: row.Duration,
                                    thumbnails: {
                                        default: {
                                            url: row.thumbnail_small,
                                            width: 0,
                                            height: 0,
                                        },
                                        medium: {
                                            url: row.thumbnail_medium,
                                            width: 0,
                                            height: 0,
                                        },
                                        high: {
                                            url: row.thumbnail_large,
                                            width: 0,
                                            height: 0,
                                        },
                                    }
                                }))
                            };
                            reply.send(playlist);
                        }
                    } else {
                        reply.status(500).send({ error: 'Error creating playlist', details: videoPlaylistMapResult });
                    }
                }
            }


        } catch (error) {
            reply.status(500).send({ error: 'Error creating playlist', details: error.message });
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
    fastify.post('/bookmark', { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            const { id } = request.body;
            if (!id) reply.status(404).send({ error: 'No Playlist ID Specific' })
            if (!Number(id)) reply.status(400).send({ error: 'Must request Playlist by ID' })
            const userId = request.user.id;

            // Validation (for example, checking required fields)
            if (!userId) {
                reply.status(400).send({ error: 'User ID is required.' });
                return;
            }

            const [existsCheck] = await fastify.mysql.query(`SELECT * FROM Playlist_Bookmarks WHERE UserID = ${userId} AND PlaylistID = ${id}`);
            if (existsCheck.length > 0) {
                // Unlike
                const query = `DELETE FROM Playlist_Bookmarks WHERE UserId = ${userId} AND PlaylistID = ${id};`;
                const [result] = await fastify.mysql.query(query, [userId, id]);
                console.log(result)
                if (result.affectedRows === 1) {
                    reply.status(200).send({ "playlist_id": id, "status": "Removed Bookmark" });
                } else {
                    reply.status(500).send({ "playlist_id": id, "status": "failure" });
                }
            } else {
                // Like
                const query = `INSERT INTO Playlist_Bookmarks (UserId, PlaylistID) VALUES (?, ?)`;
                const [result] = await fastify.mysql.query(query, [userId, id]);
                console.log(result)

                if (result.affectedRows === 1) {
                    reply.status(200).send({ "playlist_id": id, "status": "Added Bookmark" });
                } else {
                    reply.status(500).send({ "playlist_id": id, "status": "failure" });
                }
            }

        } catch (e) {
            reply.status(500).send(e);
        }
    })

    fastify.post('/like', { preHandler: fastify.authenticate }, async (request, reply) => {
        try {
            const { id } = request.body;
            console.log('ID: ', id)
            if (!id) reply.status(404).send({ error: 'No Playlist ID Specific' })
            if (!Number(id)) reply.status(400).send({ error: 'Must request Playlist by ID' })
            const userId = request.user.id;

            // Validation (for example, checking required fields)
            if (!userId) {
                reply.status(400).send({ error: 'User ID is required.' });
                return;
            }

            const [existsCheck] = await fastify.mysql.query(`SELECT * FROM Playlist_Likes WHERE UserID = ${userId} AND PlaylistID = ${id}`);
            if (existsCheck.length > 0) {
                // Unlike
                const query = `DELETE FROM Playlist_Likes WHERE UserId = ${userId} AND PlaylistID = ${id};`;
                const [result] = await fastify.mysql.query(query, [userId, id]);
                if (result.affectedRows === 1) {
                    reply.status(200).send({ "playlist_id": id, "status": "Unliked" });
                } else {
                    reply.status(500).send({ "playlist_id": id, "status": "failure" });
                }
            } else {
                // Like
                const query = `INSERT INTO Playlist_Likes (UserId, PlaylistID) VALUES (?, ?)`;
                const [result] = await fastify.mysql.query(query, [userId, id]);
                if (result.affectedRows === 1) {
                    reply.status(200).send({ "playlist_id": id, "status": "Liked" });
                } else {
                    reply.status(500).send({ "playlist_id": id, "status": "failure" });
                }
            }

        } catch (e) {
            reply.status(500).send(e);
        }
    })

    fastify.get('/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            if (!id) reply.status(404).send({ error: 'No Playlist ID Specific' })
            if (!Number(id)) reply.status(400).send({ error: 'Must request Playlist by ID' })

            const query = `
                SELECT 
                    p.ID AS playlist_id,
                    p.Name AS playlist_name,
                    u.ID AS user_id,
                    u.Name AS user_name,
                    v.ID AS video_id,
                    v.Name AS video_name,
                    v.Duration as duration,
                    v.ThumbnailLarge as thumbnail_large,
                    v.ThumbnailMedium as thumbnail_medium,
                    v.ThumbnailSmall as thumbnail_small,
                    v.Description as description,
                    pv.StartTime
                FROM 
                    Playlists p
                JOIN 
                    Users u ON p.UserID = u.ID
                JOIN 
                    Playlist_Videos pv ON p.ID = pv.PlaylistID
                JOIN 
                    Videos v ON pv.VideoID = v.ID
                WHERE 
                    p.ID = ?;
            `;

            const [rows] = await fastify.mysql.query(query, [id]);

            if (rows.length < 1) {
                reply.status(404).send({ error: 'Playlist not found' })
            } else {
                const playlist = {
                    id: rows[0].playlist_id,
                    name: rows[0].playlist_name,
                    user_id: rows[0].user_id,
                    user_name: rows[0].user_name,
                    videos: rows.map(row => ({
                        id: row.video_id,
                        name: row.video_name,
                        starttime: row.StartTime,
                        duration: row.duration,
                        thumbnails: {
                            default: {
                                url: row.thumbnail_small,
                                width: 0,
                                height: 0,
                            },
                            medium: {
                                url: row.thumbnail_medium,
                                width: 0,
                                height: 0,
                            },
                            high: {
                                url: row.thumbnail_large,
                                width: 0,
                                height: 0,
                            },
                        }
                    }))
                };
                reply.send(playlist);
            }
        } catch (e) {
            console.log(e)
            reply.status(500).send({ error: 'Server error occurred - please try again' })
        }
    })
}

module.exports = playlistRoutes;