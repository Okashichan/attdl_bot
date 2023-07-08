#!/bin/bash
git pull

docker stop attdl-bot && docker rm attdl-bot

docker build -t attdl .
docker run -d --restart=always --name attdl-bot attdl
