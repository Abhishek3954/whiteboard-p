## 1. Base 
FROM node:trixie-slim@sha256:e4db4c914bf8ad241bd24804fc25d272d89bad97e68cdc8a1414862790a02c39 AS base

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

## 2. Used for production build
FROM base AS builder

RUN npm run build

## 3. Production build.
FROM nginxinc/nginx-unprivileged:1.23-alpine-perl

COPY --link nginx.conf /etc/nginx/nginx.conf

COPY --link --from=builder /app/dist/ /usr/share/nginx/html
