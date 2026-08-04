FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Nessun browser nell'immagine: worker-scraper usa solo axios/cheerio/pdf-parse.
# Il fallback Puppeteer è stato rimosso di proposito (un browser seguirebbe
# redirect e JS della pagina fino a raggiungere servizi privati — SSRF).
# Queste variabili impediscono a puppeteer (optionalDependency) di tentare il
# download di Chrome: prima vivevano in nixpacks.toml, che Railway ignora
# perché railway.toml imposta builder = "dockerfile".
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && (node scripts/init-ledger.js || echo '[LEDGER] init non-fatal, skip') && node server.js"]
