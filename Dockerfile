FROM node:22-alpine AS build

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine

RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/ server/
COPY --from=build /app/dist dist/

ENV HOST=0.0.0.0
ENV PORT=8191
EXPOSE 8191

CMD ["node", "server/index.js"]
