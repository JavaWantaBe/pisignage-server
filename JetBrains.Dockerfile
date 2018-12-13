# Created by WebStorm
FROM socc_pisignage:1.0
WORKDIR /tmp/project_modules
COPY package.json /tmp/project_modules/package.json
RUN npm install .
COPY start.sh /tmp/project_modules/start.sh