# Traefik-Based Production Setup

Complete guide for deploying the Office Automation system with Traefik reverse proxy, HTTPS, and proper network isolation.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Domain Configuration](#domain-configuration)
- [SSL/TLS Certificates](#ssltls-certificates)
- [Network Architecture](#network-architecture)
- [Service Access](#service-access)
- [Production Deployment](#production-deployment)
- [Local Development](#local-development)
- [Troubleshooting](#troubleshooting)

## Overview

This setup uses **Traefik v3** as a reverse proxy to provide:

- ✅ HTTPS with automatic Let's Encrypt certificates
- ✅ Domain-based routing (dejtoai.cz in production, dev-dejtoai.local for development)
- ✅ Network isolation (public vs internal services)
- ✅ Load balancing and health checks
- ✅ Security headers and compression
- ✅ Centralized SSL/TLS management

### What's Publicly Accessible

**Production (dejtoai.cz):**
- Frontend: `https://dejtoai.cz`
- Directus Admin: `https://dejtoai.cz/admin`
- Traefik Dashboard: `https://traefik.dejtoai.cz` (optional, with auth)

**Development (dev-dejtoai.local):**
- Frontend: `https://dev-dejtoai.local`
- Directus Admin: `https://dev-dejtoai.local/admin`
- Traefik Dashboard: `https://traefik.dev-dejtoai.local`

### What's Internal Only

These services communicate only within Docker networks:
- Orchestration API (accessed via frontend proxy)
- PostgreSQL
- KeyDB
- MinIO (ports exposed for development only)
- MailHog (development only)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Internet                                   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                  HTTPS (443) / HTTP (80)
                          │
┌─────────────────────────▼───────────────────────────────────────────┐
│                       Traefik Reverse Proxy                          │
│  • SSL/TLS Termination  • Domain Routing  • Load Balancing          │
│  • Let's Encrypt        • Health Checks    • Security Headers        │
└─────┬───────────────────────────────────────────────┬───────────────┘
      │ traefik-public network                        │
      │                                               │
┌─────▼────────────────────┐              ┌──────────▼───────────────┐
│  Frontend                │              │  Directus CMS            │
│  (Astro + React)         │              │  /admin path             │
│  • Main UI               │◄─────────────┤  • Admin Interface       │
│  • API Proxy             │              │  • Content Management    │
└─────┬────────────────────┘              └──────────┬───────────────┘
      │                                               │
      │ backend-internal network                      │
      │                                               │
      ├──────────┬────────────┬────────────┬──────────┤
      │          │            │            │          │
┌─────▼─────┐ ┌─▼────────┐ ┌─▼───────┐ ┌─▼────┐ ┌──▼──────┐
│Orchestr.  │ │PostgreSQL│ │ MinIO   │ │KeyDB│ │ MailHog │
│   API     │ │          │ │         │ │     │ │  (dev)  │
└───────────┘ └──────────┘ └─────────┘ └─────┘ └─────────┘
   (Internal services - not directly accessible from internet)
```

## Prerequisites

1. **Docker & Docker Compose**
   - Docker Engine 24.0+
   - Docker Compose 2.20+

2. **Domain Name** (for production)
   - DNS A record pointing to your server IP
   - Wildcard subdomain (optional, for easier management)

3. **For Local Development**
   - Add to `/etc/hosts` (Mac/Linux) or `C:\Windows\System32\drivers\etc\hosts` (Windows):
     ```
     127.0.0.1 dev-dejtoai.local
     127.0.0.1 traefik.dev-dejtoai.local
     ```

4. **SSL Requirements**
   - Port 80 and 443 open on firewall
   - Email address for Let's Encrypt notifications

## Quick Start

### 1. Clone and Setup

```bash
# Clone repository
git clone <repository-url>
cd office_automations

# Create environment file
cp env.template .env
nano .env  # Edit with your values
```

### 2. Generate Secrets

```bash
# Generate all required secrets
KEY=$(openssl rand -hex 16)
SECRET=$(openssl rand -base64 32)
API_SECRET_KEY=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)

# Add these to your .env file
echo "KEY=$KEY" >> .env
echo "SECRET=$SECRET" >> .env
echo "API_SECRET_KEY=$API_SECRET_KEY" >> .env
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET" >> .env
echo "SESSION_SECRET=$SESSION_SECRET" >> .env
```

### 3. Start All Services

```bash
# Start the entire stack
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### 4. Import Directus Schema

```bash
# First time setup - import schema
cd backend
./scripts/quick-import-schema.sh
```

### 5. Access the Application

**Production:**
- https://dejtoai.cz (frontend)
- https://dejtoai.cz/admin (Directus)

**Development:**
- https://dev-dejtoai.local (frontend)
- https://dev-dejtoai.local/admin (Directus)

## Domain Configuration

### Production Setup (dejtoai.cz)

1. **Update `.env` file:**
   ```bash
   DOMAIN=dejtoai.cz
   ACME_EMAIL=admin@dejtoai.cz
   NODE_ENV=production
   ```

2. **DNS Configuration:**
   ```
   # A Records
   dejtoai.cz              A   <your-server-ip>
   
   # Optional wildcard
   *.dejtoai.cz            A   <your-server-ip>
   ```

3. **Firewall Rules:**
   ```bash
   # Allow HTTP (for Let's Encrypt challenge)
   sudo ufw allow 80/tcp
   
   # Allow HTTPS
   sudo ufw allow 443/tcp
   ```

### Development Setup (dev-dejtoai.local)

1. **Update `.env` file:**
   ```bash
   DOMAIN=dev-dejtoai.local
   ACME_EMAIL=admin@dejtoai.cz
   NODE_ENV=development
   ```

2. **Update hosts file:**
   ```bash
   # Mac/Linux: /etc/hosts
   # Windows: C:\Windows\System32\drivers\etc\hosts
   127.0.0.1 dev-dejtoai.local
   127.0.0.1 traefik.dev-dejtoai.local
   ```

3. **Use self-signed certificates (optional):**
   For local development, you can use self-signed certificates:
   ```bash
   # Generate self-signed cert
   openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout docker/traefik/local-key.pem \
     -out docker/traefik/local-cert.pem \
     -subj "/CN=dev-dejtoai.local"
   ```
   
   Then uncomment the TLS certificates section in `docker/traefik/dynamic-config.yml`.

## SSL/TLS Certificates

### Automatic Let's Encrypt (Production)

Traefik automatically obtains and renews Let's Encrypt certificates:

1. **HTTP Challenge** (default):
   - Best for single-server setups
   - Requires ports 80 and 443 accessible
   - Configured in `docker/traefik/traefik-config.yml`

2. **DNS Challenge** (for wildcard certs):
   - Uncomment DNS challenge section in `traefik-config.yml`
   - Configure your DNS provider credentials
   - Enables `*.dejtoai.cz` certificates

### Certificate Storage

Certificates are stored in Docker volume:
```bash
# View certificates
docker volume inspect traefik-certificates

# Backup certificates
docker run --rm -v traefik-certificates:/certs \
  -v $(pwd):/backup alpine \
  tar czf /backup/certs-backup.tar.gz -C /certs .
```

### Testing with Let's Encrypt Staging

To avoid rate limits during testing:

```yaml
# In docker/traefik/traefik-config.yml
certificatesResolvers:
  letsencrypt:
    acme:
      caServer: https://acme-staging-v02.api.letsencrypt.org/directory
```

## Network Architecture

### Network Types

1. **traefik-public** (Bridge)
   - Connects Traefik to publicly accessible services
   - Frontend and Directus attached
   - Handles incoming HTTPS traffic

2. **backend-internal** (Bridge)
   - Internal service communication
   - All backend services attached
   - Not directly accessible from internet
   - Can be set to `internal: true` for complete isolation

### Network Diagram

```
Internet
   │
   ▼
┌──────────────────────────────────────┐
│  traefik-public network              │
│  • Traefik                           │
│  • Frontend                          │
│  • Directus                          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│  backend-internal network            │
│  • Frontend (server-side)            │
│  • Directus                          │
│  • Orchestration API                 │
│  • PostgreSQL                        │
│  • MinIO                             │
│  • KeyDB                             │
│  • MailHog                           │
└──────────────────────────────────────┘
```

## Service Access

### External Access (via Traefik)

| Service | URL | Access |
|---------|-----|--------|
| Frontend | https://dejtoai.cz | Public |
| Directus | https://dejtoai.cz/admin | Public |
| Traefik Dashboard | https://traefik.dejtoai.cz | Basic Auth |

### Internal Access (Docker network only)

| Service | Internal URL | Purpose |
|---------|--------------|---------|
| Orchestration API | http://spur_odpady_orchestration-api:3001 | Backend API |
| Directus | http://spur_odpady_directus:8055 | CMS API |
| PostgreSQL | postgresql://spur_odpady_postgres:5432 | Database |
| MinIO | http://spur_odpady_minio:9000 | Object Storage |
| KeyDB | redis://spur_odpady_keydb:6379 | Cache |

### Development Ports (Optional)

For development/debugging, you can uncomment port mappings:

```yaml
# In respective service .yml files
ports:
  - "3001:3001"  # Orchestration API
  - "8055:8055"  # Directus
  - "5432:5432"  # PostgreSQL
  - "9000:9000"  # MinIO
  - "6379:6379"  # KeyDB
```

⚠️ **Remove these port mappings in production!**

## Production Deployment

### Pre-Deployment Checklist

- [ ] Domain DNS configured
- [ ] Firewall rules set (ports 80, 443)
- [ ] Environment variables configured
- [ ] Secrets generated
- [ ] SSL email configured
- [ ] Port mappings disabled (security)
- [ ] `NODE_ENV=production` set

### Deployment Steps

```bash
# 1. Build and start services
docker compose build
docker compose up -d

# 2. Verify all services are healthy
docker compose ps

# 3. Check Traefik dashboard
# Access: https://traefik.dejtoai.cz
# Credentials: admin / changeme (change this!)

# 4. Import Directus schema
cd backend
./scripts/quick-import-schema.sh

# 5. Test the application
curl -I https://dejtoai.cz
curl -I https://dejtoai.cz/admin

# 6. Monitor logs
docker compose logs -f traefik
docker compose logs -f frontend
docker compose logs -f directus
```

### Post-Deployment

1. **Change default passwords**
   - Traefik dashboard (update in `docker/traefik/traefik.yml`)
   - Directus admin
   - Database passwords

2. **Configure backups**
   ```bash
   # Backup script
   ./scripts/backup-all.sh
   ```

3. **Set up monitoring**
   - Enable Traefik metrics (Prometheus)
   - Configure health check alerts
   - Monitor SSL certificate expiration

## Local Development

### Development Workflow

```bash
# Start all services
docker compose up -d

# Develop frontend locally (hot reload)
cd frontend
npm install
npm run dev
# Access: http://localhost:4321

# View logs
docker compose logs -f orchestration-api
docker compose logs -f directus

# Stop services
docker compose down

# Reset everything
docker compose down -v
```

### Development Tools

**Access Development Services:**
```bash
# MinIO Console
http://localhost:9001

# MailHog UI
http://localhost:8025

# Directus (direct access)
http://localhost:8055

# Orchestration API (direct access)
http://localhost:3001/health
```

## Troubleshooting

### Traefik Issues

**Dashboard not accessible:**
```bash
# Check if Traefik is running
docker compose ps traefik

# View logs
docker compose logs traefik

# Verify labels
docker inspect spur_odpady_traefik | jq '.[0].Config.Labels'
```

**SSL certificate issues:**
```bash
# Check certificate resolver
docker compose logs traefik | grep -i acme

# Verify Let's Encrypt challenge
docker compose logs traefik | grep -i challenge

# Remove and regenerate certificates
docker volume rm traefik-certificates
docker compose restart traefik
```

### Service Not Accessible

**Check Traefik routing:**
```bash
# View all routers
curl -u admin:changeme http://localhost:8080/api/http/routers

# Check specific service
docker compose logs traefik | grep -i <service-name>
```

**Verify network connectivity:**
```bash
# Check if service is on correct network
docker network inspect traefik-public

# Test internal connectivity
docker compose exec frontend curl http://spur_odpady_orchestration-api:3001/health
```

### DNS Issues

**Local development domain not resolving:**
```bash
# Verify hosts file
cat /etc/hosts | grep dev-dejtoai

# Add if missing
echo "127.0.0.1 dev-dejtoai.local" | sudo tee -a /etc/hosts
echo "127.0.0.1 traefik.dev-dejtoai.local" | sudo tee -a /etc/hosts
```

**Production DNS not resolving:**
```bash
# Check DNS propagation
dig dejtoai.cz
nslookup dejtoai.cz

# Test from external
curl -I https://dejtoai.cz
```

### Common Errors

**"no matching manifest":**
```bash
# Rebuild images
docker compose build --no-cache
```

**"network not found":**
```bash
# Recreate networks
docker network create traefik-public
docker network create backend-internal
```

**"port already in use":**
```bash
# Find process using port
lsof -i :443
lsof -i :80

# Stop conflicting service or change port
```

## Security Best Practices

1. **Change Default Passwords**
   - Update Traefik dashboard credentials
   - Use strong database passwords
   - Rotate secrets regularly

2. **Network Isolation**
   - Set `internal: true` for backend-internal network in production
   - Remove unnecessary port mappings
   - Use Docker secrets for sensitive data

3. **SSL/TLS Configuration**
   - Use TLS 1.2+ only
   - Strong cipher suites (configured in dynamic-config.yml)
   - Enable HSTS headers

4. **Access Control**
   - Implement authentication for sensitive endpoints
   - Use Traefik middleware for rate limiting
   - Enable CORS only for trusted origins

5. **Monitoring**
   - Enable Traefik access logs
   - Monitor certificate expiration
   - Set up health check alerts

## Advanced Configuration

### Custom Middleware

Add to `docker/traefik/dynamic-config.yml`:

```yaml
http:
  middlewares:
    auth:
      basicAuth:
        users:
          - "admin:$apr1$..."
    
    rate-limit-api:
      rateLimit:
        average: 50
        period: 1s
        burst: 100
```

### Multiple Domains

```yaml
# In service labels
- "traefik.http.routers.frontend.rule=Host(`dejtoai.cz`) || Host(`www.dejtoai.cz`)"
```

### WebSocket Support

WebSocket connections work automatically through Traefik.

## Backup and Recovery

### Backup All Data

```bash
# Backup script
docker compose exec postgres pg_dump -U directus directus > backup.sql
docker volume inspect traefik-certificates
docker volume inspect spur_odpady_postgres-data
```

### Restore from Backup

```bash
# Restore database
cat backup.sql | docker compose exec -T postgres psql -U directus directus

# Restore certificates
docker run --rm -v traefik-certificates:/certs \
  -v $(pwd):/backup alpine \
  tar xzf /backup/certs-backup.tar.gz -C /certs
```

## Support

For issues and questions:
- Check Traefik logs: `docker compose logs traefik`
- Review service health: `docker compose ps`
- Consult Traefik docs: https://doc.traefik.io/traefik/

---

**Last Updated:** October 27, 2025
**Traefik Version:** 3.0
**Status:** Production Ready ✅

