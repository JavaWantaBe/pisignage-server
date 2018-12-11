FROM node:10-stretch

ENV NODE_ENV development
WORKDIR /usr/app

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install ffmpeg && \
    rm -rf /var/lib/apt/lists/*

VOLUME ${WORKDIR}

EXPOSE 3000