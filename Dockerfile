# 1. Install deps
FROM node:20-alpine AS deps
WORKDIR /app

# Устанавливаем git, если его нет в базовом образе
RUN apk add --no-cache git

# Клонируем репозиторий
RUN git clone https://github.com/lolban72/satl.git .

# Устанавливаем зависимости
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . . 
RUN npx prisma generate
RUN npm run build

# 3. Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./ 

EXPOSE 3000

CMD ["npm", "start"]