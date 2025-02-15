### Dockerfile für das Frontend (React/Next.js)
# frontend/Dockerfile
FROM node:18

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]