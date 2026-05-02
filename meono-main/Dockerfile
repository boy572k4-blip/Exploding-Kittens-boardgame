FROM node:20-slim

WORKDIR /app

COPY package.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY client ./client
COPY server ./server

RUN npm install
RUN npm run build

EXPOSE 2567
CMD ["npm", "start"]
