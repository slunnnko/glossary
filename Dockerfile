FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# Create runtime image
FROM nginxinc/nginx-unprivileged:1.27.1-alpine-slim

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

USER 101
EXPOSE 8080

ENTRYPOINT ["nginx", "-g", "daemon off;"]
