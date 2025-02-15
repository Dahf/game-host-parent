### Dockerfile für das Backend (Node.js/Express)
# backend/Dockerfile
FROM node:18

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 4000
CMD ["node", "server.js"]
