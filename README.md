# attdl
This bot supports both videos and pictures.
You can add it to any chat, type inline query or just use it in private.
# deploy
Set TELEGRAM_BOT_TOKEN and TELEGRAM_CACHED_CHAT in your .env file. Then:
>docker build -t attdl .

>docker run -d --restart=always --name attdl-bot attdl
### License 
The source code for the site is licensed under the [MIT](https://github.com/Okashichan/attdl_bot/blob/master/LICENSE) license.