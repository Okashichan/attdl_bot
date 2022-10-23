const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
// const urlRe = /[(http(s)?):\/\/(www\.)?a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/ig;
const urlRe = /https?:\/\/(?:m|www|vm|vt)\.tiktok\.com\//gm;

const bot = new TelegramBot(token, {polling: true});

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
  
    bot.sendMessage(chatId, 'This bot downloads tiktok videos directly to telegram.\nThere are 3 ways of usage:\n\n1. Just send video to this bot, and it will download it for you.\n2. Add this bot to any group, so it will handle all tiktok links that were sent and answer with video.\n3. Use inline query (e.g. @attdl_bot url)');
});

bot.onText(urlRe, async (msg) => {
    const chatId = msg.chat.id;
    const userMsgId = msg.message_id;
    const userMsg = msg?.text;

    let dl = await handle_link(userMsg);
    if (dl === undefined || dl === null) {
        console.log(`onText(${userMsg})|failed to handle your link...`);    
    } else if (dl?.urls) {
        bot.sendVideo(chatId, dl.urls[0], { reply_to_message_id: userMsgId }).catch((err) => {
            console.log(err.code);
            console.log(err.response.body);
        });
    } else if (dl?.imgs){
        let interval = 3000; 
        dl.imgs.forEach(function (el, index) {
            setTimeout(function () {
                bot.sendMediaGroup(chatId, el, { reply_to_message_id: userMsgId }).catch((err) => {
                    console.log(err.code);
                    console.log(err.response.body);
                });
            }, index * interval);
        });
        // dl.imgs.forEach(async el => {
        //     bot.sendMediaGroup(chatId, el, { reply_to_message_id: userMsgId }).catch((err) => {
        //         console.log(err.code);
        //         console.log(err.response.body);
        //     });
        //     await sleep(1000);
        //     console.log('xd');
        // });а бля
    }
    else {
        console.log(`onText(${userMsg})|Something realy went wrong...`);
    }

    // let videoBuffer = await download_video(dl);
    // if (videoBuffer === undefined || videoBuffer === null) {
    //     console.log('failed to download video..');    
    //     return;
    // }

    //return bot.sendVideo(chatId, dl.urls[0], { reply_to_message_id: userMsgId, parse_mode: 'MarkdownV2', caption: `[Download](${dl.urls[0]}) \\| [Source](${dl.origin_url})` })
    
});

bot.on('inline_query', async (msg) => {
    let queryId = msg.id;
    let query = msg.query;

    let dl = await handle_link(query);
    if (dl === undefined || dl === null) {
        console.log(`inline_query(${query})|failed to handle your link...`);    
        return;
    } else if (dl?.urls) {
        let results = dl.urls.map((item, index) => {
            return {
                type: 'video',
                id: index,
                video_url: item,
                title: `Link ${index+1}`,
                thumb_url: dl.cover,
                mime_type: 'video/mp4',
                input_message_content: {
                    message_text: `[Download](${item}) \\| [Source](${dl.origin_url})`,
                    parse_mode: 'MarkdownV2'
                }
            }
        });

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code);
            console.log(err.response.body);
        });
    } else if (dl?.imgs){
        let results = dl.imgs.flat(1).map((item, index) => {
            return {
                type: 'photo',
                id: index,
                photo_url: item.media,
                thumb_url: item.media,
                input_message_content: {
                    message_text:`[Download](${item.media}) \\| [Source](${query})`,
                    parse_mode: 'MarkdownV2'
                }
            }
        });

        bot.answerInlineQuery(queryId, results).catch((err) => {
            console.log(err.code);
            console.log(err.response.body);
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
    console.log(err.response.body);
});

async function get_real_id(url){
    return axios({
        method: 'get',
        url: url,
    })
    .then(res => res.request.res.responseUrl)
        .catch(err => console.log(err));
}

async function handle_link(url, id, msgId){
    if (url.split(' ').length > 1) return;
    if (!url.includes('tiktok')) return;
    if (url.includes('vt.tiktok.com')) url = await get_real_id(url);
    if (url.includes('vm.tiktok.com')) url = await get_real_id(url);

    const re = /(@[a-zA-z0-9]*|.*)(\/.*\/|trending.?shareId=|item_id=)([\d]*)/gm;

    let videoId = url.split(re)[3];

    console.log(videoId)

    let res = await axios({
        method: 'get',
        url: `https://api16-normal-useast5.us.tiktokv.com/aweme/v1/aweme/detail/?aweme_id=${videoId}`,
    }).catch(e => console.log(e));

    //console.log(res.data.aweme_detail.image_post_info.images[0].display_image.url_list[1]);

    // res.data.aweme_detail.image_post_info.images.forEach(element => {
    //     console.log(element.display_image.url_list[1]);
    // });

    if (res.data.aweme_detail === undefined || res.data.aweme_detail === null) {
        console.log(`handle_link(${url})|failed to handle api request...`);    
        return;
    }

    if(res.data.aweme_detail?.image_post_info?.images) {
        let imgs = res.data.aweme_detail.image_post_info.images.map((el) => {
                return {
                    type: 'photo',
                    media: el.display_image.url_list[1]
                }
            });
        
        const perChunk = 10 // images limit

        const result = imgs.reduce((resultArray, item, index) => { 
            const chunkIndex = Math.floor(index / perChunk)

            if(!resultArray[chunkIndex]) {
                resultArray[chunkIndex] = [] 
            }

            resultArray[chunkIndex].push(item)

            return resultArray
        }, []);

        return {
            imgs: result
        };
    }

    return {
        urls: res.data.aweme_detail?.video.play_addr.url_list,
        cover: res.data.aweme_detail?.video.cover.url_list[0],
        origin_url: res.data.aweme_detail?.share_info.share_url
    };
}

async function download_video(url){
    let res = await axios.get(url, { responseType: 'arraybuffer' })
        .catch(e => console.log(e));

    return Buffer.from(res.data, 'utf-8');
}