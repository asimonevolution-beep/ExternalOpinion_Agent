#!/bin/bash
set -e

echo "=========================================="
echo "  ExternalOpinion_Agent — VPS Setup"
echo "=========================================="

# ---- POSTGRESQL ----
echo "[1/6] Configurazione PostgreSQL..."
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'eouser') THEN
    CREATE USER eouser WITH ENCRYPTED PASSWORD 'zIpiPNLeNAErUKlBRp11';
  END IF;
END
$$;
SELECT 1 FROM pg_database WHERE datname = 'externalopinion';
CREATE DATABASE externalopinion OWNER eouser;
GRANT ALL PRIVILEGES ON DATABASE externalopinion TO eouser;
SQL
echo "[1/6] PostgreSQL OK"

# ---- REDIS ----
echo "[2/6] Configurazione Redis..."
grep -q '^maxmemory 256mb' /etc/redis/redis.conf || \
  sed -i 's/^# maxmemory .*/maxmemory 256mb/' /etc/redis/redis.conf
grep -q '^maxmemory-policy allkeys-lru' /etc/redis/redis.conf || \
  sed -i 's/^# maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable redis-server
systemctl restart redis-server
redis-cli ping && echo "[2/6] Redis OK"

# ---- NODE.JS / NPM check ----
echo "[3/6] Node.js: $(node --version), npm: $(npm --version)"

# ---- PM2 ----
echo "[4/6] Installazione PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1
echo "[4/6] PM2 OK"

# ---- FIREWALL ----
echo "[5/6] Configurazione UFW..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status
echo "[5/6] UFW OK"

# ---- DIRECTORY + .env ----
echo "[6/6] Directory progetto e .env..."
mkdir -p /root/ExternalOpinion_Agent/OUTPUT_REPORT
cat > /root/ExternalOpinion_Agent/.env <<'ENV'
DATABASE_URL=postgresql://eouser:zIpiPNLeNAErUKlBRp11@localhost:5432/externalopinion
REDIS_URL=redis://127.0.0.1:6379
NODE_ENV=production
PORT=3000
ENV
chmod 600 /root/ExternalOpinion_Agent/.env
echo "[6/6] .env OK"

# ---- VERIFICA FINALE ----
echo ""
echo "=========================================="
echo "  VERIFICA FINALE"
echo "=========================================="
systemctl is-active postgresql && echo "PostgreSQL: ATTIVO"
systemctl is-active redis-server && echo "Redis:      ATTIVO"
node --version
pm2 --version
echo "DATABASE_URL: $(grep DATABASE_URL /root/ExternalOpinion_Agent/.env)"
echo ""
echo "Setup completato. Incolla l'output qui."
