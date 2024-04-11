FROM oven/bun:canary

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install

# Install dependencies
RUN apt-get update && apt-get install -y wget ffmpeg python3 python3-pip

# Install yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Install gallery-dl
RUN pip3 install gallery-dl


COPY . .

CMD [ "bun", "run" ,"index.js" ]