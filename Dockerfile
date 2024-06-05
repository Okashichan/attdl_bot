FROM oven/bun:latest

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install

RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    pip3 install --no-cache-dir requests && \
    rm -rf /var/lib/apt/lists/*
# Install dependencies
# RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip

# # Install yt-dlp
# RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
#     chmod a+rx /usr/local/bin/yt-dlp

# Install gallery-dl
# RUN pip3 install gallery-dl

COPY . .

CMD [ "bun", "run" ,"index.js" ]