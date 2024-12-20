import { $ } from "bun"
import fs from 'node:fs/promises'

const getLinkType = (link) => {
    if (link.includes('tiktok.com')) return 'tiktok'
    if (link.includes('youtube.com') || link.includes('youtu.be')) return 'youtube'
    if (link.includes('twitter.com') || link.includes('x.com')) return 'twitter'
    if (link.includes('instagram.com/reel') || link.includes('instagram.com/p') || link.includes('instagram.com/share/reel')) return 'instagram'
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
            console.log(e.stderr.toString())
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

const handleYoutubeLink = async (url) => {
    console.log(`Youtube id: ${url}`)

    const ytdlp = async () => {
        try {
            const out = await $`mkdir -p ./downloads && timeout 15s yt-dlp --proxy socks5://warp:1080 -o "./downloads/%(id)s.%(ext)s" --merge-output-format mp4 --print-json --max-filesize 50M ${url}`.json()

            return out
        } catch (e) {
            console.log(e.stderr.toString())
            fs.rm('downloads', { recursive: true, force: true })
        }
    }

    const res = await ytdlp()

    return {
        path: res?.filename,
        title: res?.title,
    }
}

const handleTwitterLink = async (url) => {
    
    const postId = (url.match(/\/status\/(\d+)/) || [])[1]
    console.log(`Twitter post id: ${postId}`)

    const res = await fetch(`https://api.vxtwitter.com/Twitter/status/${postId}`)
        .then(res => res.json())
        .catch(e => console.log(e))

    if (res?.hasMedia === false) return

    if (res?.mediaURLs?.length < 1) return

    if (res?.mediaURLs?.length >= 1 && res?.mediaURLs.at(-1)?.includes('video.twimg.com')) {
        return {
            video: res.media_extended.at(-1).url,
            thumb: res.media_extended.at(-1).thumbnail_url,
            text: res.text.replace(/https:\/\/t\.co\/\S+/g, '')
        }
    }

    if (res?.mediaURLs?.length >= 1 && res?.mediaURLs.at(-1)?.includes('pbs.twimg.com')) {
        return {
            images: res.media_extended.map((el) => {
                return {
                    type: 'photo',
                    media: el.url
                }
            }),
            text: res.text.replace(/https:\/\/t\.co\/\S+/g, '')
        }
    }
}

const handleInstagramLink = async (url) => {
    console.log(`Instagram id: ${url}`)

    const res = await fetch('https://api.co.rooot.gay', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    }).then(res => res.json()).catch(e => console.log(e))

    if (res?.status === 'error')
    {
        console.log(res)
        const ytdlp = async () => {
            try {
                const out = await $`timeout 15s yt-dlp --proxy socks5://warp:1080 --print-json --ppa "ffmpeg:-c:v libx265 -tag:v hvc1" ${url}`.json()
                return out
            } catch (e) {
                console.log(e.stderr.toString())
                fs.rm('downloads', { recursive: true, force: true })
            }
        }
    
        const r = await ytdlp()
    
        return {
            path: r?.filename,
            text: r?.description
        }
    }

    return {
        url: res?.url
    }
}

export default {
    getLinkType,
    handleTikTokLink,
    handleYoutubeLink,
    handleTwitterLink,
    handleInstagramLink
}
