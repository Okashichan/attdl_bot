FROM oven/bun:latest

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install

COPY . .

CMD [ "bun", "run" ,"index.js" ]