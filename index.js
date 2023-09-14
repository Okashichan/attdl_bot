const TelegramBot = require('node-telegram-bot-api')
const helpers = require('./src/helpers')
const locale = require('./locale')
const axios = require('axios')
require('dotenv').config()

const token = process.env.TELEGRAM_BOT_TOKEN
const instagramToken = process.env.INSTAGRAM_COOKIE || ''
const cachedChat = process.env.TELEGRAM_CACHED_CHAT || ''

const urlRe = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gm

const bot = new TelegramBot(token, { polling: true, filepath: false })

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const language = msg.from.language_code;

    const startText = language === 'uk' ? locale['UA'].start : locale['EN'].start;

    bot.sendMessage(chatId, startText);
})

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const language = msg.from.language_code;

    const helpText = language === 'uk' ? locale['UA'].help : locale['EN'].help;

    bot.sendMessage(chatId, helpText);
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
                helpers.handleTikTokLink(url)
                    .then((data) => {
                        if (data === undefined || data === null) {
                            console.log(`onText(${userMsg})|failed to handle your link...`)
                            return
                        }
                        if (data?.urls) {
                            const sendVideoOptions = {
                                reply_to_message_id: userMsgId,
                                disable_notification: true,
                                allow_sending_without_reply: true
                            }

                            bot.sendVideo(chatId, data.urls[0], sendVideoOptions).catch(async (err) => {
                                console.log(err.code)
                                console.log(err.response?.body)

                                if (data.data_size > 52428800) {
                                    console.log(`onText(${userMsg})|video is to big(${data.data_size} bytes)...`)
                                    bot.sendMessage(chatId, `🐌 Sowwy onii-chan... it\'s too big for me\nHowever, <a href='${data.urls[0]}'>URL</a> 👉👈`, { parse_mode: 'HTML' })
                                    return
                                }

                                console.log(`onText(${userMsg})|Trying to download video...`)

                                if (err.response?.body.error_code === 400) {
                                    // bot.sendMessage(chatId, '🐌 I\'m Fast as Fuck Boi');

                                    let videoBuffer = await download(data.urls[0]);
                                    if (videoBuffer === undefined || videoBuffer === null) return

                                    bot.sendChatAction(chatId, 'upload_video')

                                    const statusInterval = setInterval(() => {
                                        bot.sendChatAction(chatId, 'upload_video')
                                    }, 5000)

                                    bot.sendVideo(chatId, videoBuffer, sendVideoOptions).catch(async (err) => {
                                        console.log(err.code)
                                        console.log(err.response?.body)
                                    }).then(() => {
                                        clearInterval(statusInterval)
                                    })
                                }
                            })
                        }
                        if (data?.images) {
                            let interval = chatType === 'private' ? 3000 : 65000

                            sendMediaGroupOptions = {
                                reply_to_message_id: userMsgId,
                                disable_notification: true,
                                allow_sending_without_reply: true
                            }

                            data.images.forEach((el, index) => {
                                setTimeout(() => {
                                    console.log(`       part #${index + 1}; size=${el.length}; timeout=${interval * index}`)
                                    bot.sendMediaGroup(chatId, el, sendMediaGroupOptions).catch((err) => {
                                        console.log(err.code)
                                        console.log(err.response?.body)
                                    }).finally(async () => {
                                        if (index == data.images.length - 1) {
                                            bot.sendChatAction(chatId, 'upload_audio')
                                            let audioBuffer = await download(data.song.url)
                                            if (audioBuffer === undefined || audioBuffer === null) return

                                            const sendAudioOptions = {
                                                reply_to_message_id: userMsgId,
                                                disable_notification: true,
                                                allow_sending_without_reply: true,
                                                performer: data.song.author,
                                                title: data.song.title,
                                                duration: data.song.duration
                                            }

                                            bot.sendAudio(chatId, audioBuffer, sendAudioOptions, { filename: data.song.title + '.mp3' })
                                        }
                                    })
                                }, interval * index)
                            })
                        }
                    })
                break
            }
        case 'instagram':
            {
                helpers.handleInstagramLink(url, instagramToken).then((data) => {
                    if (data === undefined || data === null) {
                        console.log(`onText(${userMsg})|failed to handle your link...`)
                        return
                    }

                    if (data?.urls) {
                        const sendVideoOptions = {
                            reply_to_message_id: userMsgId,
                            disable_notification: true,
                            allow_sending_without_reply: true
                        }

                        bot.sendVideo(chatId, data.urls[0].url, sendVideoOptions).catch(async (err) => {
                            console.log(err.code)
                            console.log(err.response?.body)
                        })
                    }

                })
                break
            }
        case 'youtube':
            {
                helpers.handleYoutubeLink(url).then((data) => {
                    if (data === undefined || data === null) {
                        console.log(`onText(${userMsg})|failed to handle your link...`)
                        return
                    }

                    if (data?.url) {
                        const sendVideoOptions = {
                            reply_to_message_id: userMsgId,
                            disable_notification: true,
                            allow_sending_without_reply: true
                        }

                        download(data.url).then((videoBuffer) => {
                            bot.sendVideo(chatId, videoBuffer, sendVideoOptions)
                        })

                        // bot.sendVideo(chatId, data.urls.url, sendVideoOptions)
                    }
                })
                break
            }
        default:
            break
    }
})

bot.on('inline_query', async (msg) => {
    let queryId = msg.id;
    let query = msg.query;

    switch (helpers.getLinkType(query)) {
        case 'tiktok':
            {
                helpers.handleTikTokLink(query)
                    .then((data) => {
                        if (data === undefined || data === null) {
                            console.log(`inline_query(${query})|failed to handle your link...`)
                        }
                        else if (data?.urls) {
                            let results = data.urls.map((item, index) => {
                                return {
                                    type: 'video',
                                    id: index,
                                    video_url: item,
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
                                console.log(err.code);
                                console.log(err.response.body);
                            })
                        } else if (data?.images) {
                            let results = data.images.flat(1).map((item, index) => {
                                return {
                                    type: 'photo',
                                    id: index,
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
                    })
                break
            }
        case 'instagram':
            {
                helpers.handleInstagramLink(query, instagramToken)
                    .then((data) => {
                        if (data === undefined || data === null) {
                            console.log(`inline_query(${query})|failed to handle your link...`)
                        }
                        else if (data?.urls) {
                            let results = data.urls.map((item, index) => {
                                return {
                                    type: 'video',
                                    id: index,
                                    video_url: item.url,
                                    title: `Quality ${item.width}x${item.height}`,
                                    thumb_url: data.covers[index].url,
                                    mime_type: 'video/mp4',
                                    reply_markup: {
                                        inline_keyboard: [
                                            [{
                                                text: 'Watch on Instagram',
                                                url: query
                                            }],
                                            [{
                                                text: 'Download',
                                                url: item.url
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
                    })

                break
            }
        case 'youtube':
            {
                helpers.handleYoutubeLink(query).then((data) => {
                    console.log(data)
                    if (data === undefined || data === null) {
                        console.log(`inline_query(${query})|failed to handle your link...`)
                    }
                    else if (data?.url) {
                        let results = [{
                            type: 'video',
                            id: 0,
                            title: data.title,
                            video_url: data.url,
                            thumb_url: data.cover,
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
                            console.log(err.code);
                            console.log(err.response.body);
                        })
                    }
                })
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

async function download(url) {
    let res = await axios.get(url, { responseType: 'arraybuffer' })
        .catch((err) => console.log(`download(${url})|failed to download video...`))

    return Buffer.from(res.data, 'utf-8')
}