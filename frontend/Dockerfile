# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci
COPY . .
RUN npm run build

FROM docker.io/library/nginx:1.27-alpine

# Prepare writable dirs for non-root nginx
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx \
    && touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

USER nginx
CMD ["nginx", "-g", "daemon off;"]
