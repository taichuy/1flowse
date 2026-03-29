FROM node:22-alpine

WORKDIR /app

COPY package.json ./

RUN corepack enable && pnpm install

COPY . .

RUN pnpm build

EXPOSE 3100

CMD ["pnpm", "start"]
