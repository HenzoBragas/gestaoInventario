FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_API_URL=/api/products
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV BACKEND_URL=http://backend:8080

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=build --chown=nodeapp:nodeapp /app/dist ./dist
COPY --chown=nodeapp:nodeapp server.js ./server.js

USER nodeapp

EXPOSE 3000

CMD ["node", "server.js"]
