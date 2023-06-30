# https://hub.docker.com/_/node/tags
# On Debian Bookworm, there's no libssl-1.1 required by the specified version of Prisma, so we're going to downgrade to Bullseye for the time being.
FROM node:18.16-bullseye-slim

ARG DATABASE_URL
ARG PORT=3000

WORKDIR /usr/src/app

COPY package*.json .npmrc ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc scr/*.ts

EXPOSE ${PORT}

CMD ./launch-service.sh -p ${PORT}
