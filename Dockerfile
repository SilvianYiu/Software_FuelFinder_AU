FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 8080
ENV PORT=8080

CMD ["node", "dist/index.cjs"]
