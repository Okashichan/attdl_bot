const axios = require('axios')

const getLinkType = (link) => {
    if (link.includes('tiktok.com')) return 'tiktok'
    if (link.includes('tiktok.com/music')) return 'tiktok_music'
    if (link.includes('instagram.com/reel')) return 'instagram'
    if (link.includes('youtube.com/shorts')) return 'youtube'
    return null
}

const getTiktokId = async (url) => {
    return axios({
        method: 'get',
        url: url.includes('https://') ? url : `https://${url}`
    })
        .then(res => res.request.res.responseUrl)
        .catch(err => {
            console.log(`get_real_id(${url})|Somehow failed to get real id...`)
            if (err.response.status === 404) return err.request.res.responseUrl
        });
}

const handleTikTokLink = async (url) => {
    console.log(url)
    if (!url.includes('tiktok')) return null
    if (url.includes('vt.tiktok.com')) url = await getTiktokId(url)
    if (url.includes('vm.tiktok.com')) url = await getTiktokId(url)
    if (url.includes('/t/')) url = await getTiktokId(url)

    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=)([\d]*)/gm

    let videoId = url.split(re)[3]

    console.log(`TikTOk id: ${videoId}`)

    let res = await axios({
        method: 'get',
        url: `https://api16-normal-c-useast1a.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`,
    }).catch(e => console.log(e))

    if (res?.data.aweme_list[0] === undefined || res?.data.aweme_list[0] === null) {
        console.log(`handleTikTokLink(${url})|failed to handle api request...`)
        return
    }

    if (res.data.aweme_list[0]?.image_post_info?.images) {
        let images = res.data.aweme_list[0].image_post_info.images.map((el) => {
            return {
                type: 'photo',
                media: el.display_image.url_list[1].includes('.webp') ? el.display_image.url_list[2] : el.display_image.url_list[1]
            }
        })

        console.log(`   chunk size: ${images.length}`)

        const perChunk = 9; // images limit

        const result = images.reduce((resultArray, item, index) => {
            const chunkIndex = Math.floor(index / perChunk)

            if (!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = []
            }

            resultArray[chunkIndex].push(item)

            return resultArray
        }, [])

        return {
            images: result,
            song: {
                url: res.data.aweme_list[0].music.play_url.uri,
                duration: res.data.aweme_list[0].music.duration,
                title: res.data.aweme_list[0].music.title,
                author: res.data.aweme_list[0].music.owner_handle.length && res.data.aweme_list[0].music.owner_handle.length !== 0 < res.data.aweme_list[0].music.author.length ? res.data.aweme_list[0].music.owner_handle : res.data.aweme_list[0].music.author
            }
        }
    }

    return {
        urls: res.data.aweme_list[0]?.video.play_addr.url_list,
        cover: res.data.aweme_list[0]?.video.cover.url_list[0],
        origin_url: res.data.aweme_list[0]?.share_info.share_url,
        data_size: res.data.aweme_list[0]?.video.play_addr.data_size
    };
}

const handleInstagramLink = async (url) => {
    if (!url.includes('instagram')) return null

    let videoId = url.indexOf('reels/') !== -1
        ? url.split('reels/')[1].split('/')[0]
        : url.indexOf('reel/') !== -1
            ? url.split('reel/')[1].split('/')[0]
            : url.split('p/')[1].split('/')[0];


    console.log(`Instagram id: ${videoId}`)

    let res = await axios({
        method: 'get',
        url: `https://www.instagram.com/p/${videoId}/?utm_source=ig_web_copy_link?&__a=1&__d=1`,
    }).catch(e => console.log(e))

    return {
        url: res.data.graphql.shortcode_media.video_url,
        cover: res.data.graphql.shortcode_media.thumbnail_src
    }

}


const handleYoutubeLink = async (url) => {
    if (!url.includes('youtube')) return null

    let res = await axios({
        method: 'get',
        url: `https://cdn9.savetube.me/info?url=${url}`,
        data: {
            url: url
        }
    }).catch(e => console.log(e))

    console.log(`Instagram id: ${url}`)

    return {
        url: res.data.data.video_formats[0].url
    }

}

module.exports = {
    getLinkType,
    handleTikTokLink,
    handleInstagramLink,
    handleYoutubeLink
}