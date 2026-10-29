FROM node:trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS base

RUN mkdir /app && chown node:node /app

WORKDIR /app

ENV PORT=8080

USER node

COPY --chown=node:node package*.json .

RUN npm ci

COPY --chown=node:node . .

EXPOSE 8080

CMD ["node", "server.js"]

