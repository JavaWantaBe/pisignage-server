FROM node:10-stretch

ENV NODE_ENV development
ENV WORK_DIR /usr/app
WORKDIR ${WORK_DIR}

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install ffmpeg imagemagick && \
    rm -rf /var/lib/apt/lists/*

VOLUME ${WORK_DIR}

EXPOSE 3000