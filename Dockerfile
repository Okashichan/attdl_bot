FROM oven/bun:alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install

RUN apk add --no-cache python3 py3-pip ffmpeg && \
    pip install --break-system-packages --no-cache-dir requests yt-dlp && \
    yt-dlp --update-to nightly

COPY . .

CMD [ "bun", "run" ,"index.js" ]
