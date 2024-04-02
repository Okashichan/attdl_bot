const getLinkType = (link) => {
    if (link.includes('tiktok.com')) return 'tiktok'
    if (link.includes('tiktok.com/music')) return 'tiktok_music'
    if (link.includes('instagram.com/reel')) return 'instagram'
    if (link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube'
    return null
}

const getTiktokId = async (url) => {
    const response = await fetch(url.includes('https://') ? url : `https://${url}`)
    const responceUrl = response?.url ? response.url : "fuck"

    return responceUrl
}

const uploadToCatbox = async (files) => {
    const results = await Promise.all(files.map(async (el) => {
        return {
            type: 'photo',
            media: await new Catbox.Catbox().upload(el)
        }
    }))
    return results
}

const handleTikTokLink = async (url, type = 'message') => {
    if (!url.includes('tiktok')) return null
    if (url.includes('vt.tiktok.com')) url = await getTiktokId(url)
    if (url.includes('vm.tiktok.com')) url = await getTiktokId(url)
    if (url.includes('/t/')) url = await getTiktokId(url)

    let videoId = ''
    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=|video\/)([\d]*)/gm
    const newRe = /\/video\/(\d+)\?/

    if (!url.includes('redirect_url=')) videoId = url.split(re)[3]
    else videoId = decodeURIComponent(url).split(re)[3]

    url = url.includes('https://') ? url : `https://${url}`

    console.log(`TikTok id: ${url}`)

    let res = await fetch(`https://tiktokjs-downloader.vercel.app/api/v1/musicaldown?server=musicaldown&type=html&url=${url}`)
        .then(res => res.json())
        .catch(e => console.log(e))

    if (res?.status !== 'success') return

    return {
        urls: res.videos,
        origin_url: url
    }

    // Should return when API issues fixed
    // if (res?.data.aweme_list[0] === undefined || res?.data.aweme_list[0] === null) {
    //     console.log(`handleTikTokLink(${url})|failed to handle api request...`)
    //     return
    // }

    // if (res.data.aweme_list[0]?.image_post_info?.images) {
    //     let images = res.data.aweme_list[0].image_post_info.images.map((el) => {
    //         return {
    //             type: 'photo',
    //             media: el.display_image.url_list[1].includes('.webp') ? el.display_image.url_list[2] : el.display_image.url_list[1]
    //         }
    //     })

    //     console.log(`   chunk size: ${images.length}`)

    //     const perChunk = 9 // images limit

    //     const result = images.reduce((resultArray, item, index) => {
    //         const chunkIndex = Math.floor(index / perChunk)

    //         if (!resultArray[chunkIndex]) {
    //             resultArray[chunkIndex] = []
    //         }

    //         resultArray[chunkIndex].push(item)

    //         return resultArray
    //     }, [])

    //     return {
    //         images: result,
    //         song: {
    //             url: res.data.aweme_list[0].music.play_url.uri,
    //             duration: res.data.aweme_list[0].music.duration,
    //             title: res.data.aweme_list[0].music.title,
    //             author: res.data.aweme_list[0].music.owner_handle.length && res.data.aweme_list[0].music.owner_handle.length !== 0 < res.data.aweme_list[0].music.author.length ? res.data.aweme_list[0].music.owner_handle : res.data.aweme_list[0].music.author
    //         }
    //     }
    // }

    // return {
    //     urls: res.data.aweme_list[0]?.video.play_addr.url_list,
    //     cover: res.data.aweme_list[0]?.video.cover.url_list[0],
    //     origin_url: res.data.aweme_list[0]?.share_info.share_url,
    //     data_size: res.data.aweme_list[0]?.video.play_addr.data_size
    // };
}

const handleInstagramLink = async (url) => {
    // Should switch to self-hosted api https://github.com/riad-azz/instagram-video-downloader
    if (!url.includes('instagram')) return null

    let videoId = url.indexOf('reels/') !== -1
        ? url.split('reels/')[1].split('/')[0]
        : url.indexOf('reel/') !== -1
            ? url.split('reel/')[1].split('/')[0]
            : url.split('p/')[1].split('/')[0]

    console.log(`Instagram id: ${videoId}`)

    let res = await fetch(`https://instagram-videos.vercel.app/api/video?url=https://www.instagram.com/reel/${videoId}`)
        .then(res => res.json())
        .catch(e => console.log(e))

    if (res.status !== 'success') return

    return { url: res.data.videoUrl }
}

const handleYoutubeLink = async (url) => {
    console.log(`Youtube id: ${url}`)

    const res = await fetch(`https://ytdlapi.util.pp.ua/get_video_url/?youtube_url=${url.includes('https://') ? url : `https://` + url}`,
        { method: 'POST' })
        .then(res => res.json())
        .catch(e => console.log(e))

    return {
        url: res?.url,
        title: res?.title,
    }
}


module.exports = {
    getLinkType,
    handleTikTokLink,
    handleInstagramLink,
    handleYoutubeLink
}