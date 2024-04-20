import TelegramBot from 'node-telegram-bot-api'
import { download } from './src/download'
import helpers from './src/helpers'
import locale from './locale'
import { $ } from 'bun'

const token = Bun.env.TELEGRAM_BOT_TOKEN
const instagramToken = Bun.env.INSTAGRAM_COOKIE || ''
const cachedChat = Bun.env.TELEGRAM_CACHED_CHAT || ''

const urlRe = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gm

const sendOptions = {
    disable_notification: true,
    allow_sending_without_reply: true
}

const bot = new TelegramBot(token, { polling: true })

// bruh
// await $`gallery-dl --range 1 --get-url 'https://www.reddit.com/'`
// await $`gallery-dl --range 1 --get-url -o client-id=${Bun.env.REDIT_CLIENT_ID} 'https://www.reddit.com/'`

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    const language = msg.from.language_code

    const startText = language === 'uk' ? locale['UA'].start : locale['EN'].start

    bot.sendMessage(chatId, startText)
})

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id
    const language = msg.from.language_code

    const helpText = language === 'uk' ? locale['UA'].help : locale['EN'].help

    bot.sendMessage(chatId, helpText)
})

bot.onText(urlRe, async (msg, match) => {
    const chatId = msg.chat.id
    const userMsgId = msg.message_id
    const userMsg = msg?.text
    const chatType = msg.chat.type
    const url = match[0]

    switch (helpers.getLinkType(url)) {
        case 'tiktok':
            {
                handleTikTokLogic(url, chatId, userMsgId, userMsg, chatType)
                break
            }
        case 'instagram':
            {
                handleInstagramLogic(url, chatId, userMsgId, userMsg)
                break
            }
        case 'youtube':
            {
                handleYoutubeLogic(url, chatId, userMsgId, userMsg)
                break
            }
        // case 'reddit':
        //     {
        //         handleRedditLogic(url, chatId, userMsgId, userMsg, chatType)
        //         break
        //     }
        default:
            break
    }
})

bot.on('inline_query', async (msg) => {
    let queryId = msg.id
    let query = msg.query

    switch (helpers.getLinkType(query)) {
        case 'tiktok':
            {
                handleTikTokInlineLogic(query, queryId)
                break
            }
        case 'instagram':
            {
                handleInstagramInlineLogic(query, queryId)
                break
            }
        case 'youtube':
            {
                handleYoutubeInlineLogic(query, queryId)
                break
            }
        default:
            break
    }
})

bot.on('polling_error', (err) => {
    console.log(err.code)
    console.log(err.response?.body)
})

async function handleTikTokLogic(url, chatId, userMsgId, userMsg, chatType) {
    const data = await helpers.handleTikTokLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.urls) {
        bot.sendVideo(chatId, data.urls[0], {
            ...sendOptions,
            caption: data.title,
            reply_to_message_id: userMsgId,
        }).catch(async (err) => {
            console.log(err.code)
            console.log(err.response?.body)

            if (data.data_size > 52428800) {
                console.log(`onText(${userMsg})|video is to big(${data.data_size} bytes)...`)
                bot.sendMessage(chatId, `🐌 Sowwy onii-chan... it\'s too big for me\nHowever, <a href='${data.urls[0]}'>URL</a> 👉👈`, { parse_mode: 'HTML' })
                return
            }

            console.log(`onText(${userMsg})|Trying to download video...`)

            if (err.response?.body.error_code === 400) {
                // bot.sendMessage(chatId, '🐌 I\'m Fast as Fuck Boi')

                let videoBuffer = await download(data.urls[0])
                if (videoBuffer === undefined || videoBuffer === null) return

                bot.sendChatAction(chatId, 'upload_video')

                const statusInterval = setInterval(() => {
                    bot.sendChatAction(chatId, 'upload_video')
                }, 5000)

                bot.sendVideo(chatId, videoBuffer, {
                    ...sendOptions,
                    caption: data.title,
                    reply_to_message_id: userMsgId
                }).catch(async (err) => {
                    console.log(err.code)
                    console.log(err.response?.body)
                }).then(() => {
                    clearInterval(statusInterval)
                })
            }
        })
    }
    if (data?.images) {
        let interval = chatType === 'private' ? 1500 : 65000

        for (const [index, el] of data.images.entries()) {
            console.log(`       part #${index + 1}; size=${el.length}; timeout=${interval * index}`)
            bot.sendChatAction(chatId, 'upload_photo')
            await bot.sendMediaGroup(chatId, el, {
                ...sendOptions,
                reply_to_message_id: userMsgId
            }).catch(async (err) => {
                console.log(err.code)
                console.log(err.response?.body)
            })

            if (index === data.images.length - 1) break

            await Bun.sleep(interval)
        }

        bot.sendChatAction(chatId, 'upload_audio')

        let audioBuffer = await download(data.song.url)

        if (audioBuffer === undefined || audioBuffer === null) return

        await bot.sendAudio(chatId, audioBuffer, {
            ...sendOptions,
            reply_to_message_id: userMsgId,
            performer: data.song.author,
            title: data.song.title,
            duration: data.song.duration
        }, { filename: data.song.title + '.mp3' }).catch(async (err) => {
            console.log(err.code)
            console.log(err.response?.body)
        })
    }
}

async function handleInstagramLogic(url, chatId, userMsgId, userMsg) {
    const data = await helpers.handleInstagramLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.url) {
        bot.sendVideo(chatId, data.url, {
            ...sendOptions,
            reply_to_message_id: userMsgId
        }).catch(async (err) => {
            console.log(err.code)
            console.log(err.response?.body)
        })
    }
}

async function handleYoutubeLogic(url, chatId, userMsgId, userMsg) {
    const data = await helpers.handleYoutubeLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    console.log(data)

    if (data?.url) {
        bot.sendVideo(chatId, data.url, {
            ...sendOptions,
            reply_to_message_id: userMsgId,
            caption: data.title
        }).catch(async (err) => {
            download(data.url).then((videoBuffer) => {
                bot.sendVideo(chatId, videoBuffer, {
                    ...sendOptions,
                    reply_to_message_id: userMsgId,
                    caption: data.title
                }).catch(async (err) => {
                    console.log(err.code)
                    console.log(err.response?.body)
                })
            })
        })
    }
}

async function handleRedditLogic(url, chatId, userMsgId, userMsg, chatType) {
    const data = await helpers.handleRedditLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.images) {
        bot.sendChatAction(chatId, 'upload_photo')
        await bot.sendMediaGroup(chatId, data.images, {
            ...sendOptions,
            reply_to_message_id: userMsgId
        }).catch(async (err) => {
            console.log(err.code)
            console.log(err.response?.body)
        })
    }
}

async function handleTikTokInlineLogic(query, queryId) {
    const data = await helpers.handleTikTokLink(query, 'inline')

    if (data === undefined || data === null) {
        console.log(`inline_query(${query})|failed to handle your link...`)
    }
    else if (data?.urls) {
        let results = data.urls.map((item, index) => {
            return {
                type: 'video',
                id: index,
                video_url: item,
                caption: data.title,
                title: `Link ${index + 1}`,
                thumb_url: data.cover,
                mime_type: 'video/mp4',
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Watch on TikTok',
                            url: query
                        }],
                        [{
                            text: 'Download',
                            url: item
                        }]
                    ]
                }
            }
        })

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    } else if (data?.images) {
        let results = data.images.flat(1).map((item, index) => {
            return {
                type: 'photo',
                id: index,
                caption: data.title,
                photo_url: item.media,
                thumb_url: item.media,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Watch on TikTok',
                            url: query
                        }],
                        [{
                            text: 'Pics',
                            switch_inline_query_current_chat: query
                        },
                        {
                            text: 'DL',
                            url: item.media
                        },
                        {
                            text: 'Music',
                            url: data.song.url
                        }]
                    ]
                }
            }
        })

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response?.body)
        })
    }
    else {
        console.log(`inline_query(${query})|Something realy went wrong...`)
    }
}

async function handleInstagramInlineLogic(query, queryId) {
    const data = await helpers.handleInstagramLink(query)

    if (data === undefined || data === null) {
        console.log(`inline_query(${query})|failed to handle your link...`)
    }
    else if (data?.url) {

        bot.answerInlineQuery(queryId, [{
            type: 'video',
            id: 0,
            video_url: data.url,
            title: `Video 1`,
            mime_type: 'video/mp4',
            thumb_url: data.url,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Watch on Instagram',
                        url: query
                    }],
                    [{
                        text: 'Download',
                        url: data.url
                    }]
                ]
            }
        }]).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
}

async function handleYoutubeInlineLogic(query, queryId) {
    const data = await helpers.handleYoutubeLink(query)

    if (data === undefined || data === null) {
        console.log(`inline_query(${query})|failed to handle your link...`)
    }
    else if (data?.url) {
        let results = [{
            type: 'video',
            id: 0,
            caption: data.title,
            video_url: data.url,
            thumb_url: data.url,
            title: data.title,
            mime_type: 'video/mp4',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Watch on YouTube',
                        url: query
                    }],
                    [{
                        text: 'Download',
                        url: data.url
                    }]
                ]
            }
        }]

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
}