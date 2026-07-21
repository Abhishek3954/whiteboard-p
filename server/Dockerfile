FROM node:20-alpine AS base

RUN mkdir /app && chown node:node /app

WORKDIR /app

ENV PORT=8080

USER node

COPY --chown=node:node package*.json .

RUN npm ci

COPY --chown=node:node . .

EXPOSE 8080

CMD ["node", "server.js"]

