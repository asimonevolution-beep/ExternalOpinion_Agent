#!/bin/bash
set -e

echo "=========================================="
echo "  ExternalOpinion_Agent — FULL DEPLOY"
echo "=========================================="

# ---- POSTGRESQL ----
echo "[1/8] PostgreSQL..."
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='eouser') THEN CREATE USER eouser WITH ENCRYPTED PASSWORD 'Q7mR2vT9kL4pX8nS6dF1'; END IF; END \$\$;" 2>/dev/null || true
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname='externalopinion'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE externalopinion OWNER eouser;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE externalopinion TO eouser;" 2>/dev/null || true
echo "[1/8] PostgreSQL OK"

# ---- REDIS ----
echo "[2/8] Redis..."
grep -q '^maxmemory 256mb' /etc/redis/redis.conf 2>/dev/null || sed -i 's/^# maxmemory .*/maxmemory 256mb/' /etc/redis/redis.conf
grep -q '^maxmemory-policy allkeys-lru' /etc/redis/redis.conf 2>/dev/null || sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable redis-server && systemctl restart redis-server
redis-cli ping && echo "[2/8] Redis OK"

# ---- PM2 ----
echo "[3/8] PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root 2>/dev/null || true
echo "[3/8] PM2 OK"

# ---- FIREWALL ----
echo "[4/8] Firewall..."
ufw allow 22/tcp comment 'SSH' 2>/dev/null || true
ufw allow 80/tcp comment 'HTTP' 2>/dev/null || true
ufw allow 443/tcp comment 'HTTPS' 2>/dev/null || true
ufw --force enable
echo "[4/8] UFW OK"

# ---- CLONE REPO ----
echo "[5/8] Clone repository..."
if [ -d "/root/ExternalOpinion_Agent/.git" ]; then
  cd /root/ExternalOpinion_Agent && git pull origin master
  echo "[5/8] Git pull OK"
else
  rm -rf /root/ExternalOpinion_Agent
  git clone https://github.com/asimonevolution-beep/ExternalOpinion_Agent.git /root/ExternalOpinion_Agent
  echo "[5/8] Git clone OK"
fi

# ---- .env ----
echo "[6/8] Configurazione .env..."
mkdir -p /root/ExternalOpinion_Agent/OUTPUT_REPORT
cat > /root/ExternalOpinion_Agent/.env <<'ENV'
DATABASE_URL=postgresql://eouser:Q7mR2vT9kL4pX8nS6dF1@localhost:5432/externalopinion
REDIS_URL=redis://127.0.0.1:6379
NODE_ENV=production
PORT=3000
ENV
chmod 600 /root/ExternalOpinion_Agent/.env
echo "[6/8] .env OK"

# ---- NPM INSTALL + PRISMA ----
echo "[7/8] Dipendenze e database schema..."
cd /root/ExternalOpinion_Agent
npm install --omit=dev
npx prisma generate
npx prisma db push --accept-data-loss
echo "[7/8] Prisma OK"

# ---- PM2 START ----
echo "[8/8] Avvio app con PM2..."
cd /root/ExternalOpinion_Agent
pm2 delete externalopinion 2>/dev/null || true
pm2 start server-v18.3.js --name externalopinion --max-memory-restart 512M
pm2 save
echo "[8/8] App avviata"

# ---- VERIFICA FINALE ----
echo ""
echo "=========================================="
echo "  VERIFICA FINALE"
echo "=========================================="
sleep 3
pm2 status
echo ""
curl -s http://localhost:3000/health/live || echo "ATTENZIONE: health/live non risponde"
echo ""
echo "Deploy completato."
