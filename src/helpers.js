import { $ } from "bun"

const getLinkType = (link) => {
    if (link.includes('tiktok.com')) return 'tiktok'
    if (link.includes('tiktok.com/music')) return 'tiktok_music'
    if (link.includes('instagram.com/reel')) return 'instagram'
    if (link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube'
    if (link.includes('reddit.com')) return 'reddit'
    return null
}

const getResponceUrl = async (url) => {
    const response = await fetch(url.includes('https://') ? url : `https://${url}`)
    const responceUrl = response?.url ? response.url : "fuck"

    return responceUrl
}

const handleTikTokLink = async (url, type = 'message') => {
    if (!url.includes('tiktok')) return null
    if (url.includes('vt.tiktok.com')) url = await getResponceUrl(url)
    if (url.includes('vm.tiktok.com')) url = await getResponceUrl(url)
    if (url.includes('/t/')) url = await getResponceUrl(url)

    let videoId = ''
    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=|video\/)([\d]*)/gm
    const newRe = /\/video\/(\d+)\?/

    if (!url.includes('redirect_url=')) videoId = url.split(re)[3]
    else videoId = decodeURIComponent(url).split(re)[3]

    url = url.includes('https://') ? url : `https://${url}`

    console.log(`TikTok id: ${videoId}`)

    const headers = {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
    }

    const params = new URLSearchParams({
        "iid": '7318518857994389254',
        "device_id": Math.floor(Math.random() * (7351147085025500000 - 7250000000000000000 + 1)) + 7250000000000000000,
        "version_code": "1337",
        "aweme_id": videoId
    })

    let res = await fetch(`https://api22-normal-c-alisg.tiktokv.com/aweme/v1/feed/?${params.toString()}`,
        { headers })
        .then(res => res.json())
        .catch(e => console.log(e))

    // Should return when API broken again
    // if (res?.status !== 'success') return

    // return {
    //     urls: res.videos,
    //     origin_url: url
    // }

    if (res?.aweme_list[0] === undefined || res?.aweme_list[0] === null) {
        console.log(`handleTikTokLink(${url})|failed to handle api request...`)
        return
    }

    if (res.aweme_list[0]?.image_post_info?.images) {
        let images = res.aweme_list[0].image_post_info.images.map((el) => {
            return {
                type: 'photo',
                media: el.display_image.url_list[1].includes('.webp') ? el.display_image.url_list[2] : el.display_image.url_list[1]
            }
        })

        console.log(`   chunk size: ${images.length}`)

        const perChunk = 9 // images limit

        const result = images.reduce((resultArray, item, index) => {
            const chunkIndex = Math.floor(index / perChunk)

            if (!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = []
            }

            resultArray[chunkIndex].push(item)

            return resultArray
        }, [])

        return {
            title: res.aweme_list[0].desc,
            images: result,
            song: {
                url: res.aweme_list[0].music.play_url.uri,
                duration: res.aweme_list[0].music.duration,
                title: res.aweme_list[0].music.title,
                author: res.aweme_list[0].music.owner_handle.length && res.aweme_list[0].music.owner_handle.length !== 0 < res.aweme_list[0].music.author.length ? res.aweme_list[0].music.owner_handle : res.aweme_list[0].music.author
            }
        }
    }

    return {
        title: res.aweme_list[0]?.desc,
        urls: res.aweme_list[0]?.video.play_addr.url_list,
        cover: res.aweme_list[0]?.video.cover.url_list[0],
        origin_url: res.aweme_list[0]?.share_info.share_url,
        data_size: res.aweme_list[0]?.video.play_addr_size
    }
}

const handleInstagramLink = async (url) => {
    if (!url.includes('instagram')) return null

    let videoId = url.indexOf('reels/') !== -1
        ? url.split('reels/')[1].split('/')[0]
        : url.indexOf('reel/') !== -1
            ? url.split('reel/')[1].split('/')[0]
            : url.split('p/')[1].split('/')[0]

    console.log(`Instagram id: ${videoId}`)

    let res = await fetch(`https://instagram-videos.vercel.app/api/video?postUrl=https://www.instagram.com/reel/${videoId}`)
        .then(res => res.json())
        .catch(e => console.log(e))

    if (res.status !== 'success') return

    return { url: res.data.videoUrl }
}

const handleRedditLink = async (url) => {
    if (!url.includes('reddit')) return null

    if (url.includes('/s/')) url = await getResponceUrl(url)

    console.log(`Reddit id: ${url}`)

    try {
        const res = (await $`gallery-dl --get-url -o reddit-client-id=${Bun.env.REDIT_CLIENT_ID} ${url}`.text())
            .split(/\r?\n/).filter(line => line.trim() !== "")
            .map(url => {
                return {
                    type: "photo",
                    media: url
                }
            })
        return { images: res }
    } catch (e) {
        console.log(e.stderr.toString())
    }
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


export default {
    getLinkType,
    handleTikTokLink,
    handleInstagramLink,
    handleYoutubeLink,
    handleRedditLink
}