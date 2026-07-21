## 1. Base 
FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json .

RUN npm install

COPY . .

## 2. Used for production build
FROM base AS builder

RUN npm run build

## 3. Production build.
FROM nginxinc/nginx-unprivileged:1.23-alpine-perl

COPY --link nginx.conf /etc/nginx/conf.d/default.conf

COPY --link --from=builder /app/dist/ /usr/share/nginx/html