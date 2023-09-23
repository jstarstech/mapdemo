FROM node:18-bookworm-slim AS appbuild
WORKDIR /app

COPY ["./src/app/package.json","./src/app/package-lock.json", "./src/app/"]
RUN cd ./src/app/ && npm install
COPY . .
RUN cd ./src/app/ && npm run build

FROM node:18-bookworm-slim
WORKDIR /app

COPY ["package.json","package-lock.json", "./"]
RUN npm install --production
COPY . .
COPY --from=appbuild /app/public ./public

EXPOSE 3000/tcp
CMD ["npm", "start"]
