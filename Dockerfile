FROM oven/bun:alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install

RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir requests yt-dlp

COPY . .

CMD [ "bun", "run" ,"index.js" ]