const locale = {
    'EN': {
        start: `
This bot downloads TikTok videos or images directly to telegram.\nType /help to see additional info.
`,
        help: `
There are 3 ways of usage:\n
1. Just send video to this bot, and it will download it for you.
2. Add this bot to any group, so it will handle all tiktok links that were sent and answer with video.
3. Use inline query (e.g. @attdl_bot url)\n
For TikTok's with images, there are 1 min delay in sending because of Telegram limits.
In private chat with the bot, there is only 3 sec delay. 
Also, if there are a lot of images, the inline query might work only after you sent TikTok to any chat, which were handled.
`
    },
    'UA': {
        start: `
Цей бот завантажує відео чи відео-зображення з TikTok безпосередньо в Telegram.\nНапишіть /help, щоб переглянути додаткову інформацію.
        `,
        help: `
Є 3 способи використання:\n
1. Просто надішліть TikTok цьому боту, і він завантажить його для вас.
2. Додайте цього бота до будь-якої групи, щоб він обробляв усі надіслані посилання TikTok та надсилав їх у відповідь.
3. Використовуйте вбудований запит (наприклад, @attdl_bot url)\n
Для TikTok із зображеннями присутня 1 хвилина затримки надсилання через обмеження Telegram.
У приватному чаті з ботом затримка всього 3 секунди.
Крім того, якщо зображень багато вбудований запит може запрацювати лише після того як ви надіслали TikTok до будь-якого чату, який було оброблено ботом.
        `
    }
};

module.exports = locale;