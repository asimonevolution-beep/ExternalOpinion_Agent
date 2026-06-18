FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (node scripts/init-ledger.js || echo '[LEDGER] init non-fatal, skip') && node server.js"]
