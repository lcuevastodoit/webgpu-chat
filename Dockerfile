FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV PORT=8082
ENV NODE_ENV=production

EXPOSE 8082

CMD ["node", "server.js"]
