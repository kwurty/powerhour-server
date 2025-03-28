// youtube.js

const fetch = require('node-fetch')

async function youtubeRoutes(fastify, options) {

    fastify.get("/search", async (request, reply) => {
        const query = request.query.q;
        console.log(query)
        const resultListUnparsed = await fetch(
            `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY
            }&type=video&maxResults=50&part=snippet&q=${encodeURIComponent(query)}`
        )
        const resultList = await resultListUnparsed.json()

        const ids = resultList?.items?.map((video) => {
            return video.id.videoId
        })

        const videoResultsUnparsed = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?key=${process.env.YOUTUBE_API_KEY
            }&part=snippet,contentDetails&id=${ids.join(',')}`
        )

        const videoResults = await videoResultsUnparsed.json()

        reply.send(videoResults);
    })

}

module.exports = youtubeRoutes;