const startTextEn = `
This bot downloads TikTok videos or images directly to telegram.\nType /help to see additional info.
`;

const helpTextEn = `
There are 3 ways of usage:\n
1. Just send video to this bot, and it will download it for you.
2. Add this bot to any group, so it will handle all tiktok links that were sent and answer with video.
3. Use inline query (e.g. @attdl_bot url)\n
For TikTok's with images, there are 1 min delay in sending because of Telegram limits. (If there are less than 18 pictures, then it will send them with a delay of 5 seconds)
In private chat with the bot, there is only 3 sec delay. 
Also, if there are a lot of images, the inline query might work only after you sent TikTok to any chat, which were handled.
`;

exports.startTextEn = startTextEn;
exports.helpTextEn = helpTextEn;