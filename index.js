const TelegramBot = require('node-telegram-bot-api');
const locale = require('./locale');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const cachedChat = process.env.TELEGRAM_CACHED_CHAT;

// const urlRe = /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/ig;
const urlRe = /https?:\/\/(?:m|www|vm|vt)\.tiktok\.com\//gm;

const bot = new TelegramBot(token, { polling: true, filepath: false });

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const language = msg.from.language_code;

    const startText = language === 'uk' ? locale['UA'].start : locale['EN'].start;
  
    bot.sendMessage(chatId, startText);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const language = msg.from.language_code;

    const helpText = language === 'uk' ? locale['UA'].help : locale['EN'].help;
  
    bot.sendMessage(chatId, helpText);
});

bot.onText(urlRe, async (msg) => {
    const chatId = msg.chat.id;
    const userMsgId = msg.message_id;
    const userMsg = msg?.text;
    const chatType = msg.chat.type;
    // const url = match[0];

    let dl = await handle_link(userMsg);
    if (dl === undefined || dl === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`);    
    } else if (dl?.urls) {
        const sendVideoOptions = { 
            reply_to_message_id: userMsgId, 
            allow_sending_without_reply: true 
        };

        bot.sendVideo(chatId, dl.urls[0], sendVideoOptions).catch(async (err) => {
            console.log(err.code);
            console.log(err.response?.body);

            if (dl.data_size > 52428800) {
                console.log(`onText(${userMsg})|video is to big(${dl.data_size} bytes)...`);
                bot.sendMessage(chatId, '🐌 Sowwy onii-chan... it\'s too big for me');
                return;
            }

            console.log(`onText(${userMsg})|Trying to download video...`);

            if (err.response?.body.error_code === 400){
                bot.sendMessage(chatId, '🐌 I\'m Fast as Fuck Boi');

                let videoBuffer = await download(dl.urls[0]);
                if (videoBuffer === undefined || videoBuffer === null) return;

                bot.sendChatAction(chatId, 'upload_video');

                const statusInterval = setInterval(() => {
                    bot.sendChatAction(chatId, 'upload_video');
                }, 5000);

                bot.sendVideo(chatId, videoBuffer, sendVideoOptions).catch(async (err) => {
                    console.log(err.code);
                    console.log(err.response?.body);
                })
                .then(() => {
                    clearInterval(statusInterval);
                });
            }
        });
    } else if (dl?.imgs){
        let interval = chatType === 'private' ? 3000 : 65000;
        // let interval = chatType === 'private' ? 3000 : dl.imgs.length > 2 ? 65000 : 10000;
        sendMediaGroupOptions = { 
            reply_to_message_id: userMsgId, 
            disable_notification: true, 
            allow_sending_without_reply: true 
        };

        dl.imgs.forEach(function (el, index) {
            setTimeout(function () {
                console.log(`       part #${index+1}; size=${el.length}; timeout=${interval * index}`);
                bot.sendMediaGroup(chatId, el, sendMediaGroupOptions).catch((err) => {
                    console.log(err.code);
                    console.log(err.response?.body);
                }).finally(async () => {
                        if (index == dl.imgs.length - 1) {
                            bot.sendChatAction(chatId, 'upload_audio');
                            let audioBuffer = await download(dl.song.url);
                            if (audioBuffer === undefined || audioBuffer === null) return;

                            const sendAudioOptions = {
                                reply_to_message_id: userMsgId,
                                disable_notification: true, 
                                allow_sending_without_reply: true, 
                                performer: dl.song.author, 
                                title: dl.song.title, 
                                duration: dl.song.duration, 
                            };

                            bot.sendAudio(chatId, audioBuffer, sendAudioOptions, { filename: dl.song.title + '.mp3' });
                        }
                    });
            }, interval * index);
        });
        // dl.imgs.forEach(async el => {
        //     bot.sendMediaGroup(chatId, el, { reply_to_message_id: userMsgId }).catch((err) => {
        //         console.log(err.code);
        //         console.log(err.response.body);
        //     });
        //     await sleep(1000);
        //     console.log('xd');
        // });
    }
    else {
        console.log(`onText(${userMsg})|Something realy went wrong...`);
    }

    // let videoBuffer = await download(dl);
    // if (videoBuffer === undefined || videoBuffer === null) {
    //     console.log('failed to download video..');    
    //     return;
    // }

    //return bot.sendVideo(chatId, dl.urls[0], { reply_to_message_id: userMsgId, parse_mode: 'MarkdownV2', caption: `[Download](${dl.urls[0]}) \\| [Source](${dl.origin_url})` })
    
});

bot.on('inline_query', async (msg) => {
    let queryId = msg.id;
    let query = msg.query.includes('audio') ? msg.query.replace('audio', '') : msg.query;

    let dl = await handle_link(query);
    if (dl === undefined || dl === null) {
        console.log(`inline_query(${query})|failed to handle your link...`);
    }
    else if (dl?.urls) {
        let results = dl.urls.map((item, index) => {
            return {
                type: 'video',
                id: index,
                video_url: item,
                title: `Link ${index+1}`,
                thumb_url: dl.cover,
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
        });

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code);
            console.log(err.response.body);
        });
    } else if (msg.query.includes('audio')){

        let audioBuffer = await download(dl.song.url);
        if (audioBuffer === undefined || audioBuffer === null) return;

        const sendAudioOptions = {
            disable_notification: true,
            performer: dl.song.author, 
            title: dl.song.title, 
            duration: dl.song.duration, 
        };

        console.log(`inline_query(${query})|trying to cache audio...`);

        bot.sendAudio(cachedChat, audioBuffer, sendAudioOptions, { filename: dl.song.title + '.mp3' })
            .then(msg => {
                let file_id = msg.audio.file_id;

                result = [{
                    type: 'audio',
                    id: 0,
                    audio_file_id: file_id
                }];
        
                bot.answerInlineQuery(queryId, result).catch((err) => {
                    console.log(err.code);
                    console.log(err.response.body);
                });
            }).catch((err) => {
                console.log(err.code);
                console.log(err.response?.body);
            });
    } else if (dl?.imgs){
        let results = dl.imgs.flat(1).map((item, index) => {
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
                            text: 'DL',
                            url: item.media
                        },
                        {
                            text: 'Audio',
                            switch_inline_query_current_chat: query + 'audio'
                        },
                        {
                            text: 'Pics',
                            switch_inline_query_current_chat: query
                        }]
                    ]
                }
            }
        });

        // results.push({
        //     type: 'audio',
        //     id: 0,
        //     audio_url: dl.song.url,
        //     title: dl.song.title,
        //     caption: dl.song.title
        // });

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code);
            console.log(err.response?.body);
        });
        //console.log(`inline_query(${query})|Images are not implemented...`);
    }
    else {
        console.log(`inline_query(${query})|Something realy went wrong...`);
    }

    // let results = dl.map((item, index) => {
    //     return {
    //         type: 'video',
    //         id: index,
    //         video_url: item,
    //         title: `Link ${index+1}`,
    //         thumb_url: item,
    //         mime_type: 'video/mp4'
    //     }
    // });
});

bot.on('polling_error', (err) => {
    console.log(err.code);
    console.log(err.response?.body);
});

async function get_real_id(url){
    return axios({
        method: 'get',
        url: url,
    })
    .then(res => res.request.res.responseUrl)
        .catch(err => {
            console.log(`get_real_id(${url})|Somehow failed to get real id...`);
            if (err.response.status === 404) return err.request.res.responseUrl;
        });
}

async function handle_link(url){
    if (url.split(' ').length > 1) return;
    if (!url.includes('tiktok')) return;
    if (url.includes('vt.tiktok.com')) url = await get_real_id(url);
    if (url.includes('vm.tiktok.com')) url = await get_real_id(url);

    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=)([\d]*)/gm;

    let videoId = url.split(re)[3];

    console.log(videoId);

    let res = await axios({
        method: 'get',
        url: `https://api16-normal-useast5.us.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${videoId}`,
    }).catch(e => console.log(e));

    //console.log(res.data.aweme_detail.image_post_info.images[0].display_image.url_list[1]);

    // res.data.aweme_detail.image_post_info.images.forEach(element => {
    //     console.log(element.display_image.url_list[1]);
    // });

    if (res?.data.aweme_detail === undefined || res?.data.aweme_detail === null) {
        console.log(`handle_link(${url})|failed to handle api request...`);    
        return;
    }

    if(res.data.aweme_detail?.image_post_info?.images) {
        let imgs = res.data.aweme_detail.image_post_info.images.map((el) => {
                return {
                    type: 'photo',
                    media: el.display_image.url_list[1].includes('.webp') ? el.display_image.url_list[2] : el.display_image.url_list[1]
                }
        });

        console.log(`   chunk size: ${imgs.length}`);
        
        const perChunk = 9; // images limit

        const result = imgs.reduce((resultArray, item, index) => { 
            const chunkIndex = Math.floor(index / perChunk);

            if(!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = [] 
            }

            resultArray[chunkIndex].push(item);

            return resultArray;
        }, []);

        return {
            imgs: result,
            song: {
                url: res.data.aweme_detail.music.play_url.uri,
                duration: res.data.aweme_detail.music.duration,
                title: res.data.aweme_detail.music.title,
                author: res.data.aweme_detail.music.owner_handle.length && res.data.aweme_detail.music.owner_handle.length !== 0 < res.data.aweme_detail.music.author.length ? res.data.aweme_detail.music.owner_handle : res.data.aweme_detail.music.author,
                cover: res.data.aweme_detail.music.cover_thumb.url_list[2]	
            }
        };
    }

    return {
        urls: res.data.aweme_detail?.video.play_addr.url_list,
        cover: res.data.aweme_detail?.video.cover.url_list[0],
        origin_url: res.data.aweme_detail?.share_info.share_url,
        data_size: res.data.aweme_detail?.video.play_addr.data_size
    };
}

async function download(url){
    let res = await axios.get(url, { responseType: 'arraybuffer' })
        .catch((err) => console.log(`download(${url})|failed to download video...`));

    return Buffer.from(res.data, 'utf-8');
}