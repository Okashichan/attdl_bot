import { $ } from "bun"
import fs from 'node:fs/promises'

const getLinkType = (link) => {
    if (link.includes('tiktok.com')) return 'tiktok'
    // if (link.includes('tiktok.com/music')) return 'tiktok_music'
    // if (link.includes('instagram.com/reel') || link.includes('instagram.com/p')) return 'instagram'
    // if (link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube'
    if (
        link.includes('reddit.com')
        || link.includes('x.com')
        || link.includes('twitter')
        || link.includes('twitch')
        || link.includes('instagram')
        || link.includes('youtube.com') 
        || link.includes('youtu.be')
    ) return 'universal'
    return null
}

const getResponceUrl = async (url) => {
    const response = await fetch(url)
    const responceUrl = response?.url ? response.url : "fuck"

    return responceUrl
}

const handleTikTokLink = async (url, type = 'message') => {
    if (url.includes('vt.tiktok.com')) url = await getResponceUrl(url)
    if (url.includes('vm.tiktok.com')) url = await getResponceUrl(url)
    if (url.includes('/t/')) url = await getResponceUrl(url)

    let videoId = ''
    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=|video\/)([\d]*)/gm

    if (!url.includes('redirect_url=')) videoId = url.split(re)[3]
    else videoId = decodeURIComponent(url).split(re)[3]

    console.log(`TikTok id: ${videoId}`)

    const getAweme = async () => {
        try {
            const out = await $`python request.py ${videoId}`.json()

            return out
        } catch (e) {
            console.log(`handleTikTokLink()|failed to call python script...`)
        }
    }

    const res = await getAweme()

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

// const handleInstagramLink = async (url) => {
//     const videoId = url.indexOf('reels/') !== -1
//         ? url.split('reels/')[1].split('/')[0]
//         : url.indexOf('reel/') !== -1
//             ? url.split('reel/')[1].split('/')[0]
//             : url.split('p/')[1].split('/')[0]

//     console.log(`Instagram id: ${videoId}`)

//     const res = await fetch(`https://instagram-videos.vercel.app/api/video?postUrl=https://www.instagram.com/reel/${videoId}`)
//         .then(res => res.json())
//         .catch(e => console.log(e))

//     if (res.status !== 'success') return

//     return { url: res.data.videoUrl }
// }

const handleYoutubeLink = async (url) => {
    console.log(`Youtube id: ${url}`)

    const ytdlp = async () => {
        try {
            const out = await $`mkdir -p ./downloads && timeout 15s yt-dlp -o "./downloads/%(id)s.%(ext)s" --print-json --max-filesize 50M ${url}`.json()

            return out
        } catch (e) {
            console.log(`handleTikTokLink()|failed to call python script...`)
            fs.rm('downloads', { recursive: true, force: true })
        }
    }

    const res = await ytdlp()

    return {
        path: res?.filename,
        title: res?.title,
    }
}

const handleUniversalLink = async (url) => {
    if (url.includes('reddit.com')) url = await getResponceUrl(url)

    console.log(`Origin url: ${url}`)

    const res = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    }).then(res => res.json()).catch(e => console.log(e))

    if (res?.status === 'error') return

    return {
        url: res?.url
    }
}

export default {
    getLinkType,
    handleTikTokLink,
    handleYoutubeLink,
    handleUniversalLink
}