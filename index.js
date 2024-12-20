import TelegramBot from 'node-telegram-bot-api'
import { download } from './src/download'
import { unlinkSync } from 'node:fs'
import fs from 'node:fs/promises'
import helpers from './src/helpers'
import locale from './locale'

const token = Bun.env.TELEGRAM_BOT_TOKEN
const cachedChat = Bun.env.TELEGRAM_CACHED_CHAT || ''

const topicNames = ['мем', 'mem']
const urlRe = /\b((http|https):\/\/)?(www\.)?[\w-]+\.[\w.-]+(?:\.[a-z]{2,})?(\/[\w.,@?^=%&:/~+#-]*)?\b/gm;

const sendOptions = {
    disable_notification: true,
    allow_sending_without_reply: true
}

const bot = new TelegramBot(token, { polling: true })

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
    let [url, ..._] = match
    const {
        chat: { id: chatId, type: chatType, is_forum: isForum },
        reply_to_message: { forum_topic_created: { name: topicName } = {} } = {},
        text: userMsg,
        message_id: userMsgId,
    } = msg

    if (!url.includes('https://')) url = `https://${url}`

    if (isForum && !topicNames.some(s => topicName?.toLowerCase().includes(s))) return

    switch (helpers.getLinkType(url)) {
        case 'tiktok':
            {
                handleTikTokLogic(url, chatId, userMsgId, userMsg, chatType)
                break
            }
        case 'youtube':
            {
                handleYoutubeLogic(url, chatId, userMsgId, userMsg)
                break
            }
        case 'twitter':
            {
                handleTwitterLogic(url, chatId, userMsgId, userMsg)
                break
            }
        case 'instagram':
            {
                handleInstagramLink(url, chatId, userMsgId, userMsg)
                break
            }
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
        case 'youtube':
            {
                handleYoutubeInlineLogic(query, queryId)
                break
            }
        case 'twitter':
            {
                handleTwitterInlineLogic(query, queryId)
                break
            }
        case 'instagram':
            {
                handleInstagramInlineLogic(query, queryId)
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

async function handleTikTokLogic(url, chatId, userMsgId, userMsg, chatType, isTopic, canSendInTopic) {
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

async function handleYoutubeLogic(url, chatId, userMsgId, userMsg) {
    const data = await helpers.handleYoutubeLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.path) {
        bot.sendVideo(chatId, data.path, {
            ...sendOptions,
            reply_to_message_id: userMsgId,
            caption: data.title
        })
        .catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
        .finally(
            unlinkSync(data.path)
        )
    }
}

async function handleTwitterLogic(url, chatId, userMsgId, userMsg) {
    const data = await helpers.handleTwitterLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.video) {
        bot.sendVideo(chatId, data.video, {
            ...sendOptions,
            reply_to_message_id: userMsgId,
            caption: data.text
        }).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }

    if (data?.images) {
        data.images.at(-1).caption = data.text
        bot.sendMediaGroup(chatId, data.images, {
            ...sendOptions,
            reply_to_message_id: userMsgId
        }).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
}

async function handleInstagramLink(url, chatId, userMsgId, userMsg) {
    const data = await helpers.handleInstagramLink(url)

    if (data === undefined || data === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`)
        return
    }

    if (data?.path || data?.url) {
        bot.sendVideo(chatId, data.path ? data.path : data.url, {
            ...sendOptions,
            caption: data.text,
            reply_to_message_id: userMsgId
        }).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        }).finally(
            data?.path ? unlinkSync(data.path) : null
        )
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

async function handleYoutubeInlineLogic(query, queryId) {
    const data = await helpers.handleYoutubeLink(query)

    if (data === undefined || data === null) {
        console.log(`inline_query(${query})|failed to handle your link...`)
    }
    else if (data?.path) {

        const { video: { file_id: cachedVideo } = {} } = await bot.sendVideo(cachedChat, data.path, {
            ...sendOptions,
            caption: data.title
        }).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        }) || {}

        if (!cachedVideo) {
            return
        }

        fs.rm('downloads', { recursive: true, force: true })

        let results = [{
            type: 'video',
            id: 0,
            caption: data.title,
            video_file_id: cachedVideo,
            title: data.title,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Watch on YouTube',
                        url: query
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

async function handleTwitterInlineLogic(query, queryId) {
    const data = await helpers.handleTwitterLink(query)

    if (data === undefined || data === null) {
        console.log(`inline_query(${query})|failed to handle your link...`)
    }
    else if (data?.video) {
        let results = [{
            type: 'video',
            id: 0,
            video_url: data.video,
            caption: data.text,
            title: 'Twitter video',
            thumb_url: data.thumb,
            mime_type: 'video/mp4',
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Watch on Twitter',
                        url: query
                    }],
                    [{
                        text: 'Download',
                        url: data.video
                    }]
                ]
            }
        }]

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
    else if (data?.images) {
        let results = data.images.map((item, index) => {
            return {
                type: 'photo',
                id: index,
                caption: data.text,
                photo_url: item.media,
                thumb_url: item.media,
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'See on Twitter',
                            url: query
                        }],
                        [{
                            text: 'Pics',
                            switch_inline_query_current_chat: query
                        },
                        {
                            text: 'DL',
                            url: item.media
                        }]
                    ]
                }
            }
        })

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
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
    else if (data?.path) {
        const { video: { file_id: cachedVideo } = {} } = await bot.sendVideo(cachedChat, data.path, {
            ...sendOptions,
            caption: data.text
        }).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        }) || {}

        if (!cachedVideo) {
            return
        }

        fs.rm('downloads', { recursive: true, force: true })

        let results = [{
            type: 'video',
            id: 0,
            caption: data.text,
            video_file_id: cachedVideo,
            title: data.text,
            reply_markup: {
                inline_keyboard: [
                    [{
                        text: 'Watch on Instagram',
                        url: query
                    }]
                ]
            }
        }]

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
    else if (data?.url) {
        const videoBuffer = await download(data.url)

        const { video: { file_id: fileId } } = await bot.sendVideo(cachedChat, videoBuffer, {
            ...sendOptions
        }).catch(async (err) => {
            console.log(err.code)
            console.log(err.response?.body)
        }) || {}

        let results = [{
            type: 'video',
            id: 0,
            video_url: fileId,
            title: `Universal Video`,
            mime_type: 'video/mp4',
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
        }]

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code)
            console.log(err.response.body)
        })
    }
}