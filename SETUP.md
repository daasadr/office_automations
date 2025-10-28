# Office Automation - Complete Setup Guide

> **Get up and running in 5 minutes with a single command!**

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Prerequisites](#-prerequisites)
- [Development vs Production](#-development-vs-production)
- [Setup Process Flow](#-setup-process-flow)
- [Detailed Setup Process](#-detailed-setup-process)
- [Development Environment](#-development-environment)
- [Production Environment](#-production-environment)
- [Commands Reference](#-commands-reference)
- [Accessing Your Application](#-accessing-your-application)
- [Managing Credentials](#-managing-credentials)
- [Development Workflow](#-development-workflow)
- [Troubleshooting](#-troubleshooting)
- [Architecture Overview](#-architecture-overview)
- [Implementation Details](#-implementation-details)
- [Advanced Topics](#-advanced-topics)

---

## 🚀 Quick Start

### Development (with Hot-Reload)

```bash
# One command setup with hot module reload
make dev-up
```

That's it! Your development environment is now running with:
- ✅ **Frontend** - Hot reload enabled (changes reflect instantly)
- ✅ **Orchestration API** - Auto-restart on code changes
- ✅ **All Services** - Postgres, KeyDB, MinIO, Directus, MailHog

**Access your app:**
- Frontend: http://dev-dejtoai.local or http://localhost:4321
- Directus: http://directus.dev-dejtoai.local or http://localhost:8055
- MailHog: http://mailhog.dev-dejtoai.local or http://localhost:8025

### Production (Optimized Builds)

```bash
# Production setup with optimized builds
make prod-up
```

### First Time Setup

If this is your first time:

```bash
# Generate environment files and configure everything
make setup-dev    # For development
# or
make setup-prod   # For production
```

This will:
1. Generate secure passwords and secrets
2. Create all environment files
3. Setup local domain (dev only)
4. Build and start all Docker services
5. Import Directus database schema
6. Guide you through API token creation
7. Test all services

---

## 📋 Prerequisites

### Required

- ✅ **Docker & Docker Compose** (v24.0+ / v2.20+) - [Install Docker](https://docs.docker.com/get-docker/)
- ✅ **Make** command (pre-installed on macOS/Linux)
- ✅ **Git** for version control
- ✅ **curl** (for health checks)
- ✅ **sudo access** (for /etc/hosts modification in development)
- ✅ **5-10 minutes** for first-time setup

### Optional

- **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
  - You can add this later if you don't have it yet
  - Required for AI-powered document processing

### System Requirements

- **Minimum 4GB RAM** (8GB recommended)
- **10GB disk space** for Docker volumes
- **macOS, Linux, or Windows with WSL2**

---

## 🔄 Development vs Production

The project has separate Docker Compose configurations optimized for different environments:

### Quick Comparison

| Feature | Development (`make dev-up`) | Production (`make prod-up`) |
|---------|----------------------------|----------------------------|
| **Start Command** | `make dev-up` | `make prod-up` |
| **Frontend Build** | Dockerfile.dev (fast) | Dockerfile (optimized) |
| **API Build** | development target | production target |
| **Hot Reload** | ✅ Yes (instant) | ❌ No |
| **Volume Mounts** | ✅ Yes (source code) | ❌ No (immutable) |
| **Build Time** | ~30 seconds | ~2-3 minutes |
| **Code Changes** | Instant | Requires rebuild |
| **Optimization** | None (faster dev) | Full (minify, tree-shake) |
| **Source Maps** | ✅ Yes | ❌ No |
| **MailHog** | ✅ Included | ❌ Not included |
| **Container User** | root (dev mode) | nodejs (non-root) |
| **Bundle Size** | Larger | Optimized/Smaller |
| **Debugging** | Easy | Limited |

### When to Use Which

**Use Development (`make dev-up`) when:**
- Daily coding and development
- Testing new features
- Debugging issues
- You want instant feedback on code changes

**Use Production (`make prod-up`) when:**
- Testing production builds locally
- Deploying to server
- Performance testing
- Final validation before deployment

### Switching Between Environments

```bash
# Currently running dev? Switch to prod:
make dev-down
make prod-up

# Currently running prod? Switch to dev:
make prod-down
make dev-up
```

---

## 📊 Setup Process Flow

Here's a visual overview of what happens when you run `make setup-dev` or `make setup-prod`:

```
┌─────────────────────────────────────────────────────────────────┐
│                     START: make setup-dev                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │  Docker Check      │
                    │  docker info       │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼─────────┐
                    │  Docker running?  │
                    └─┬───────────────┬─┘
                      │               │
                 NO   │               │  YES
                      │               │
        ┌─────────────▼──────┐        │
        │  Show Error:       │        │
        │  "Docker not       │        │
        │   running!"        │        │
        │                    │        │
        │  Platform-specific │        │
        │  start instructions│        │
        │                    │        │
        │  EXIT              │        │
        └────────────────────┘        │
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 1: Environment Selection  │
                      │  • Choose Dev or Prod           │
                      │  • Configure domain             │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 2: Generate Secrets       │
                      │  • PostgreSQL password          │
                      │  • KeyDB password               │
                      │  • MinIO keys                   │
                      │  • Directus KEY/SECRET          │
                      │  • Admin password               │
                      │  • API secrets                  │
                      │  • Session secret               │
                      │  (All cryptographically secure) │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 3: Collect Configuration  │
                      │  • Admin email                  │
                      │  • SSL email (prod)             │
                      │  • Gemini API key (optional)    │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 4: Create Env Files       │
                      │  • .env (root)                  │
                      │  • backend/.env                 │
                      │  • frontend/.env                │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 5: Setup Domain (dev)     │
                      │  • Add to /etc/hosts            │
                      │  • dev-dejtoai.local            │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 6: Start Docker Services  │
                      │  • Build all images             │
                      │  • Start containers             │
                      │  • Wait 30s for init            │
                      └───────────────┬────────────────┘
                                      │
                                      ▼
                            ☕ Coffee Break!
                              (~3-5 minutes)
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 7: Import Schema          │
                      │  • Wait for Directus ready      │
                      │  • Copy schema file             │
                      │  • Apply schema                 │
                      │  • Create collections           │
                      └───────────────┬────────────────┘
                                      │
                      ┌───────────────▼────────────────┐
                      │  STEP 8: API Token Setup        │
                      │  • Display credentials          │
                      │  • Guide token creation         │
                      │  • Prompt for token             │
                      │  • Update env files             │
                      └───────────────┬────────────────┘
                                      │
                              ┌───────▼────────┐
                              │ Token provided? │
                              └───┬────────┬───┘
                                  │        │
                             YES  │        │  NO (skipped)
                                  │        │
                   ┌──────────────▼──┐     │
                   │  STEP 9: Rebuild │     │
                   │  • Restart API    │     │
                   │  • Restart Frontend│    │
                   │  • Wait 10s       │     │
                   └──────────────┬───┘     │
                                  │         │
                                  └────┬────┘
                                       │
                      ┌────────────────▼────────────────┐
                      │  STEP 10: Test & Verify         │
                      │  • Health check all services    │
                      │  • Test endpoints               │
                      │  • Report status                │
                      └────────────────┬────────────────┘
                                       │
                      ┌────────────────▼────────────────┐
                      │  Display Summary                 │
                      │  • Access URLs                   │
                      │  • Credentials                   │
                      │  • Useful commands               │
                      │  • Next steps                    │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │   ✅ SETUP COMPLETE! 🎉         │
                      │   Your app is ready to use!     │
                      └─────────────────────────────────┘
```

**Key Features:**
- ✅ **Automatic** - No manual intervention needed (except API token)
- ✅ **Secure** - Crypto-strong secrets generated
- ✅ **Fast** - ~5 minutes total
- ✅ **Verified** - Health checks ensure everything works
- ✅ **Guided** - Clear instructions at each step

---

## 🎯 Detailed Setup Process

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd office_automations
```

### Step 2: Run Setup Command

**For Development:**
```bash
make setup-dev
```

**For Production:**
```bash
make setup-prod
```

**Docker Check:**
The script will first check if Docker engine is running. If Docker is not running, you'll see:
```
✗ Docker engine is not running!
```
Simply start Docker Desktop (macOS/Windows) or the Docker service (Linux), then run the command again.

### Step 3: Interactive Configuration

The script will ask you:

#### Question 1: Environment Type
- **Development (Option 1)** - Hot reloading, debug logs, local domain
- **Production (Option 2)** - Optimized builds, production domain

#### Question 2: Admin Email
- Your email address for admin account
- Used for Directus CMS login

#### Question 3: SSL Certificate Email (Production Only)
- Email for Let's Encrypt certificates
- Defaults to admin email if not specified

#### Question 4: Gemini API Key
- Optional - press Enter to skip
- Can be added later in `backend/.env`

### Step 4: Automated Setup (~3-5 minutes)

The script automatically performs:

**Phase 1: Secret Generation**
- PostgreSQL password (24 chars, cryptographically secure)
- KeyDB/Redis password (24 chars)
- MinIO access keys (16/32 chars)
- Directus KEY and SECRET
- Admin password (16 chars)
- API secret keys (32 bytes)
- Session secret (32 bytes)

**Phase 2: Environment Configuration**
- Creates `.env` (root configuration)
- Creates `backend/.env` (backend services)
- Creates `frontend/.env` (frontend app)

**Phase 3: Domain Setup** (Development Only)
- Adds `dev-dejtoai.local` to `/etc/hosts`
- Configures Traefik routing

**Phase 4: Docker Services**
- Builds all Docker images
- Starts all containers
- Waits for services to initialize (30s)

**Phase 5: Database Schema**
- Waits for Directus to be ready
- Imports schema snapshot
- Creates collections and relationships

☕ **Perfect time for a coffee break!**

### Step 5: API Token Creation

When the script prompts you:

1. **Open Directus** in your browser (URL shown in terminal)
   - Development: http://localhost:8055
   - Production: https://your-domain.com/admin

2. **Login** with the credentials displayed in the terminal
   - Email: (shown in setup output)
   - Password: (shown in setup output)

3. **Navigate to Settings**
   - Click the gear icon (⚙️) in the sidebar
   - Select "Access Tokens"

4. **Create Token**
   - Click "Create Token" button
   - Set name: "API Access" (or any name)
   - Set type: **Admin** (important!)
   - Optionally set expiration
   - Click "Save"

5. **Copy the Token**
   - The token will be displayed once
   - Copy it to clipboard

6. **Paste in Terminal**
   - Return to the terminal
   - Paste the token when prompted
   - Press Enter

**⚠️ Important:** Save the admin password shown earlier - you'll need it to login!

### Step 6: Service Restart

If you provided a token, the script will:
- Update `backend/.env` with the token
- Update `frontend/.env` with the token
- Restart `orchestration-api` service
- Restart `frontend` service
- Wait for services to reload (10s)

### Step 7: Health Verification

The script tests all services:
- ✅ Traefik (reverse proxy)
- ✅ Frontend (web application)
- ✅ Directus (CMS)
- ✅ Orchestration API (backend)
- ✅ PostgreSQL (database)
- ✅ MinIO (object storage)

### Step 8: Setup Complete! 🎉

You'll receive:
- ✅ Access URLs for all services
- ✅ Login credentials
- ✅ Useful commands reference
- ✅ Next steps guide

---

## 🔥 Development Environment

The development environment is optimized for rapid development with instant feedback.

### Features

- **Frontend (Astro)**: Hot module reload with live changes
- **Orchestration API**: TypeScript watch mode with automatic restart
- **Volume Mounts**: Source code is mounted, so changes reflect immediately
- **MailHog**: Email testing interface
- **All Backend Services**: PostgreSQL, KeyDB, MinIO, Directus

### How Hot Module Reload Works

#### Frontend Hot Reload

**How it works:**
1. Source code mounted: `./frontend/src:/app/src`
2. Astro dev server watches for changes
3. Browser hot-reloads automatically

**What triggers reload:**
- `.astro` files
- `.tsx` / `.jsx` components
- `.ts` / `.js` files
- `.css` files
- Config changes (astro.config.mjs, etc.)

**What gets mounted:**
- `frontend/src/` → Hot reload for all components, pages, layouts
- `frontend/public/` → Static assets
- `frontend/*.config.*` → Configuration files
- `frontend/node_modules` → Preserved in container (platform-specific)

#### Orchestration API Hot Reload

**How it works:**
1. Source code mounted: `./backend/orchestration-api/src:/app/src`
2. `tsx watch` monitors TypeScript files
3. Server restarts automatically on changes

**What triggers reload:**
- `.ts` files in `src/`
- Changes to imported modules
- Configuration files (tsconfig.json)

**What gets mounted:**
- `backend/orchestration-api/src/` → Hot reload for all TypeScript code
- `backend/orchestration-api/tsconfig.json` → TypeScript configuration
- `backend/orchestration-api/node_modules` → Preserved in container

### Node Modules Preservation

Both services use named volumes for `node_modules`:
- `frontend_node_modules:/app/node_modules`
- `orchestration_node_modules:/app/node_modules`

This ensures:
- Platform-specific builds stay in container
- Faster startup (no rebuild on every mount)
- No conflicts between host and container packages

### Adding New Dependencies

When you add new npm packages:

**Frontend:**
```bash
cd frontend
npm install <package-name>

# Rebuild container with new dependencies
make dev-down
make dev-build
make dev-up
```

**Orchestration API:**
```bash
cd backend/orchestration-api
npm install <package-name>

# Rebuild container with new dependencies
make dev-down
make dev-build
make dev-up
```

### Development Workflow

#### Starting Your Day
```bash
# Start development environment
make dev-up

# Watch logs in separate terminal (optional)
make dev-logs-frontend
# or
make dev-logs-api
```

#### During Development
- Edit files in `frontend/src/` or `backend/orchestration-api/src/`
- Changes automatically detected and reloaded
- No need to restart services

#### Configuration Changes
If you modify:
- `package.json` → Rebuild: `make dev-build`
- `Dockerfile` or `Dockerfile.dev` → Rebuild: `make dev-build`
- Environment variables → Restart: `make dev-restart`

#### Ending Your Day
```bash
make dev-down
```

### File Structure for Development

```
office_automations/
├── docker-compose.dev.yml          # Development configuration
├── backend/
│   ├── orchestration-api/
│   │   ├── Dockerfile              # Multi-stage: development & production
│   │   └── src/                    # Mounted in dev, copied in prod
│   └── docker/
│       └── orchestration/
│           ├── orchestration.yml         # Base config (shared)
│           ├── orchestration.dev.yml     # Dev overrides
│           └── orchestration.prod.yml    # Prod overrides
└── frontend/
    ├── docker/
    │   ├── Dockerfile              # Production build
    │   ├── Dockerfile.dev          # Development build
    │   └── frontend.yml            # Base config (shared)
    └── src/                        # Mounted in dev, copied in prod
```

---

## 🚀 Production Environment

The production environment is optimized for performance, security, and stability.

### Features

**Frontend:**
- Uses `Dockerfile` (optimized production build)
- Code baked into image (no volumes)
- Runs `npm run start` (production mode)
- Minified, tree-shaken, optimized

**Orchestration API:**
- Uses Dockerfile `production` target
- Code baked into image (no volumes)
- Runs `node dist/index.js` (compiled)
- Non-root user for security

**Backend Services:**
- Postgres, KeyDB, MinIO, Directus
- No MailHog (not needed in production)

### Security Features

- ✅ Non-root users in containers
- ✅ No volume mounts (immutable containers)
- ✅ No development tools included
- ✅ Healthchecks enabled
- ✅ HTTPS via Let's Encrypt
- ✅ Resource limits can be added

### Deploying to Production

1. **Run production setup** on server:
   ```bash
   make setup-prod
   ```

2. **Or update existing** deployment:
   ```bash
   git pull
   make prod-up
   ```

3. **Monitor deployment:**
   ```bash
   make status
   make health
   make logs
   ```

---

## 📚 Commands Reference

### Development Commands

| Command | Description |
|---------|-------------|
| `make dev-up` | Start development with hot-reload |
| `make dev-down` | Stop development |
| `make dev-restart` | Restart development |
| `make dev-logs` | View all dev logs |
| `make dev-logs-frontend` | View frontend logs |
| `make dev-logs-api` | View API logs |
| `make dev-build` | Rebuild dev containers |

### Production Commands

| Command | Description |
|---------|-------------|
| `make prod-up` | Start production |
| `make prod-down` | Stop production |
| `make prod-logs` | View all prod logs |
| `make prod-build` | Rebuild prod containers |

### General Commands (Auto-detect)

| Command | Description |
|---------|-------------|
| `make status` | Show service status |
| `make logs` | View logs |
| `make down` | Stop all services |
| `make logs-frontend` | View frontend logs |
| `make logs-api` | View API logs |
| `make health` | Test all services |
| `make restart` | Restart services |

### Setup Commands

| Command | Alias For | Description |
|---------|-----------|-------------|
| `make setup-dev` | `make dev-up` | First-time development setup |
| `make setup-prod` | `make prod-up` | First-time production setup |
| `make setup-env` | - | Generate environment files only |
| `make setup-directus-token` | - | Update API token interactively |
| `make setup-domain` | - | Setup local domain |

### Maintenance Commands

```bash
# Import Directus schema
make import-schema

# Backup database
make backup

# Pull latest images
make pull

# Full rebuild
make rebuild

# Access container shells
make shell-api
make shell-frontend
make shell-directus
make shell-postgres

# Rebuild API after dependency changes
make rebuild-orchestration

# Clean everything (WARNING: destroys data!)
make clean
```

### See All Commands

```bash
make help
```

---

## 🌐 Accessing Your Application

After setup completes, you can access:

### Development Environment

#### Direct Access (Recommended)

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:4321 | Main application |
| **Directus** | http://localhost:8055 | CMS admin panel |
| **API** | http://localhost:3001 | Backend API |
| **API Docs** | http://localhost:3001/api-docs | API documentation |
| **MinIO Console** | http://localhost:9001 | Object storage |
| **MailHog** | http://localhost:8025 | Email testing |
| **Traefik Dashboard** | http://traefik.dev-dejtoai.local:8080 | Reverse proxy |

#### Via Domain

| Service | URL |
|---------|-----|
| **Main Site** | http://dev-dejtoai.local |
| **Directus** | http://directus.dev-dejtoai.local |
| **MailHog** | http://mailhog.dev-dejtoai.local |

### Production Environment

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Site** | https://your-domain.com | Public application |
| **Directus** | https://your-domain.com/admin | CMS admin |
| **Traefik Dashboard** | https://traefik.your-domain.com | Reverse proxy |

---

## 🔑 Managing Credentials

### Your Credentials

**Save these securely!** They're shown during setup.

#### Directus Admin
- **URL:** http://localhost:8055 (or your domain)
- **Email:** (shown during setup)
- **Password:** (shown during setup)

#### MinIO Console
- **URL:** http://localhost:9001
- **Access Key:** (shown during setup)
- **Secret Key:** (shown during setup)

#### API Token
- **Directus API Token:** (created by you in Step 5)

⚠️ **Important:** These credentials are only shown once during setup!

### Finding Lost Credentials

If you lose your credentials, you can find them in:

1. **Environment Files:**
   ```bash
   # Directus admin password
   cat backend/.env | grep ADMIN_PASSWORD
   
   # MinIO keys
   cat backend/.env | grep MINIO_ACCESS_KEY
   cat backend/.env | grep MINIO_SECRET_KEY
   
   # API token
   cat backend/.env | grep DIRECTUS_API_TOKEN
   ```

2. **Or Reset by Running Setup Again:**
   ```bash
   make clean  # Warning: Deletes all data!
   make setup-dev
   ```

---

## 🔄 Development Workflow

### Typical Daily Usage

```bash
# Day 1: Initial setup
git clone <repo>
cd office_automations
make setup-dev
# ... coffee break while it sets up ...
# Access app at http://localhost:4321

# Day 2+: Development
make dev-up                # Start if not running
# Edit code in src/
# Changes auto-reload!

# View logs in separate terminal
make dev-logs-frontend
# or
make dev-logs-api

# After dependency changes
make dev-down
make dev-build
make dev-up

# Stop when done
make dev-down
```

### Making Code Changes

#### Frontend Development

```bash
# Frontend code is in:
cd frontend/src/

# Key directories:
# - components/  - React components
# - pages/       - Astro pages & API routes
# - layouts/     - Page layouts
# - lib/         - Utilities

# Changes auto-reload in development mode!
# Edit any file and watch it update in browser
```

#### Backend API Development

```bash
# Backend API code is in:
cd backend/orchestration-api/src/

# Key directories:
# - routes/      - API endpoints
# - services/    - Business logic
# - middleware/  - Custom middleware
# - utils/       - Utilities

# Changes auto-reload in development mode!
# Edit any TypeScript file and server restarts automatically
```

### Making Schema Changes

1. **Modify collections/fields** in Directus admin panel

2. **Export schema:**
   ```bash
   cd backend
   docker compose exec directus npx directus schema snapshot ./snapshots/new_schema.json
   ```

3. **Commit the schema file:**
   ```bash
   git add docker/directus/schema/
   git commit -m "Update Directus schema"
   ```

### Testing Changes

```bash
# Check service health
make health

# View real-time logs
make dev-logs              # All services
make dev-logs-api          # API only
make dev-logs-frontend     # Frontend only

# Test API endpoints
curl http://localhost:3001/health
curl http://localhost:3001/api-docs
```

---

## 🐛 Troubleshooting

### Common Issues

#### Docker Not Running

If you see "Docker engine is not running" error:

**macOS/Windows:**
```bash
# Open Docker Desktop application
# Wait for the whale icon to show "Docker Desktop is running"
```

**Linux:**
```bash
# Start Docker service
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Check Docker status
sudo systemctl status docker
```

**Verify Docker is running:**
```bash
docker info
```

#### Services Not Starting

```bash
# Check status
make status

# View logs
make logs

# Restart specific service
docker compose restart <service-name>

# Full restart
make restart
```

#### Changes Not Reflecting (Development)

**Frontend:**
```bash
# Check if volumes are mounted correctly
docker compose -f docker-compose.dev.yml exec frontend ls -la /app/src

# Restart the frontend service
docker compose -f docker-compose.dev.yml restart frontend
# or
make dev-restart
```

**Orchestration API:**
```bash
# Check logs for errors
make dev-logs-api

# Restart the API service
docker compose -f docker-compose.dev.yml restart orchestration-api
```

#### "Cannot find module" Errors

Node modules might be out of sync:
```bash
make dev-down
make dev-build
make dev-up
```

#### Can't Access Frontend

1. Check if service is running:
   ```bash
   make status
   ```

2. Try direct URL:
   ```bash
   curl http://localhost:4321
   ```

3. Check logs:
   ```bash
   make dev-logs-frontend
   ```

4. Check browser console for errors

#### Port Already in Use

If you see "port already in use" errors:

1. Check what's using the port:
   ```bash
   lsof -i :PORT
   # Example: lsof -i :4321
   ```

2. Stop the conflicting service

3. Or stop all environments:
   ```bash
   make down
   ```

4. Restart:
   ```bash
   make dev-up
   ```

**Common ports used:**
- 80, 443 (Traefik)
- 4321 (Frontend)
- 8055 (Directus)
- 3001 (Orchestration API)
- 5432 (PostgreSQL)
- 6379 (Redis/KeyDB)
- 9000, 9001 (MinIO)
- 8025 (MailHog - dev only)

#### Domain Not Working (Development)

```bash
# Check /etc/hosts
cat /etc/hosts | grep dev-dejtoai.local

# If missing, add it
make setup-domain

# Or manually:
echo "127.0.0.1 dev-dejtoai.local directus.dev-dejtoai.local mailhog.dev-dejtoai.local traefik.dev-dejtoai.local" | sudo tee -a /etc/hosts
```

#### Directus Schema Import Failed

```bash
# Import manually
make import-schema

# Or use the full script
cd backend
./scripts/import-directus-schema.sh
```

#### API Token Not Working

1. **Verify token is correct** in both files:
   ```bash
   cat backend/.env | grep DIRECTUS_API_TOKEN
   cat frontend/.env | grep DIRECTUS_TOKEN
   ```

2. **Update token if needed:**
   ```bash
   make setup-directus-token
   ```

3. **Restart affected services:**
   ```bash
   docker compose restart orchestration-api frontend
   # or
   make dev-restart
   ```

4. **Check Directus token permissions** (should be Admin)

#### Services Failing Health Check

```bash
# Wait a bit longer (services may still be initializing)
sleep 30
make health

# Check if containers are running
docker compose ps

# Check container logs
docker compose logs <service-name>

# Restart problematic service
docker compose restart <service-name>
```

#### Gemini API Issues

```bash
# Verify API key is set
cat backend/.env | grep GEMINI_API_KEY

# Test API health
curl http://localhost:3001/health

# Check API logs
make dev-logs-api

# Test with a small PDF file first
```

#### Database/Storage Issues

```bash
# Check PostgreSQL connection
docker compose exec postgres pg_isready -U directus

# Check MinIO status
curl http://localhost:9000/minio/health/live

# View data volumes
docker volume ls | grep office

# Reset database (WARNING: destroys data!)
make clean
make setup-dev
```

#### Permission Issues

The containers run as specific users. If you get permission errors:
```bash
# Frontend (runs as node user in container)
docker compose -f docker-compose.dev.yml exec frontend whoami

# API (runs as root in dev, nodejs in prod)
docker compose -f docker-compose.dev.yml exec orchestration-api whoami
```

#### Setup Script Failed

```bash
# Clean everything and retry
make clean
make setup-dev

# Or manually clean
docker compose down -v
rm .env backend/.env frontend/.env
make setup-dev
```

### Getting Help

- 📖 Check this guide's relevant sections
- 🔍 View service logs: `make logs` or `make dev-logs`
- 🧪 Test services: `make health`
- 📚 Read README.md for architecture details

---

## 🏗 Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │   Astro + React Web Application (Port 4321)              │   │
│  │   • File Upload UI  • Status Tracking  • Results Display │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP/REST API
┌───────────────────────────┼──────────────────────────────────────┐
│                    Backend Services Layer                         │
│  ┌────────────────────────▼─────────────────────────────────┐   │
│  │   Orchestration API (Port 3001)                          │   │
│  │   • PDF Processing  • Excel Generation                   │   │
│  │   • Foundation Augmentation  • Job Management            │   │
│  └──────┬───────────┬──────────────┬───────────────┬────────┘   │
│         │           │              │               │             │
│  ┌──────▼──────┐ ┌──▼────────┐ ┌──▼──────────┐ ┌──▼─────────┐  │
│  │  Directus   │ │PostgreSQL │ │   MinIO     │ │   KeyDB    │  │
│  │   CMS       │ │ Database  │ │  Storage    │ │   Cache    │  │
│  │  (8055)     │ │  (5432)   │ │  (9000)     │ │  (6379)    │  │
│  └─────────────┘ └───────────┘ └─────────────┘ └────────────┘  │
└───────────────────────────────┬──────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                      External Services                            │
│  ┌──────────────────┐          ┌──────────────────┐             │
│  │   Gemini AI      │          │    MailHog       │             │
│  │  (Google API)    │          │  (Dev Email)     │             │
│  │                  │          │    (8025)        │             │
│  └──────────────────┘          └──────────────────┘             │
└──────────────────────────────────────────────────────────────────┘
```

### Service Overview

| Service | Port(s) | Purpose | Technology |
|---------|---------|---------|------------|
| **Traefik** | 80, 443, 8080 | Reverse proxy & HTTPS | Traefik v3 |
| **Frontend** | 4321 | Web interface | Astro + React |
| **Directus** | 8055 | CMS and admin | Directus 11 |
| **Orchestration API** | 3001 | Document processing | Express.js + TypeScript |
| **PostgreSQL** | 5432 | Database | PostgreSQL 16 |
| **MinIO** | 9000, 9001 | Object storage | MinIO (S3-compatible) |
| **KeyDB** | 6379 | Cache layer | KeyDB (Redis-compatible) |
| **MailHog** | 1025, 8025 | Email testing (dev) | MailHog |

### Docker Networks

- **traefik-public** - Public-facing services (Frontend, Directus)
- **backend-internal** - Internal services (API, Database, Cache, Storage)

### Volumes

- **postgres_data** - Database persistence
- **keydb_data** - Cache persistence  
- **minio_data** - Object storage
- **directus_uploads** - File uploads
- **traefik-certificates** - SSL certificates
- **orchestration_node_modules** - API dependencies
- **frontend_node_modules** - Frontend dependencies (dev only)

---

## 💡 Implementation Details

### What the Setup Script Does

The `setup-environment.sh` script performs 10 automated steps:

#### 1. Environment Selection
- Prompts for Development or Production
- Configures domain and environment variables
- Sets Docker build targets

#### 2. Secure Secret Generation

All secrets use cryptographically secure methods:
- `openssl rand -hex N` for hex secrets
- `openssl rand -base64 N` for base64 secrets
- Fallback to `/dev/urandom` if OpenSSL unavailable

**Generated Secrets:**

| Secret | Length | Format | Purpose |
|--------|--------|--------|---------|
| PostgreSQL Password | 24 chars | Base64 | Database access |
| KeyDB Password | 24 chars | Base64 | Cache access |
| MinIO Access Key | 16 chars | Base64 | Object storage |
| MinIO Secret Key | 32 chars | Base64 | Object storage |
| Directus KEY | 16 bytes | Hex | Encryption |
| Directus SECRET | 32 chars | Base64 | Session signing |
| Admin Password | 16 chars | Base64 | Admin access |
| API Secret Key | 32 bytes | Hex | API security |
| Webhook Secret | 32 bytes | Hex | Webhook verification |
| Session Secret | 32 bytes | Hex | Session encryption |

#### 3. Configuration Input
- Admin email address
- SSL certificate email (production)
- Gemini API key (optional)

#### 4. Environment File Creation
- `.env` - Root configuration (Traefik, domain, environment)
- `backend/.env` - All backend service configurations
- `frontend/.env` - Frontend application configuration

#### 5. Local Domain Setup (Development Only)
- Adds `dev-dejtoai.local` to `/etc/hosts` (requires sudo)
- Adds `directus.dev-dejtoai.local` for CMS
- Adds `traefik.dev-dejtoai.local` for dashboard
- Adds `mailhog.dev-dejtoai.local` for email testing
- Configures Traefik for local routing

#### 6. Docker Services Startup
- Runs `docker-start.sh` helper script
- Builds all Docker images with proper targets
- Starts all containers in detached mode
- Waits 30 seconds for initialization

#### 7. Database Schema Import
- Waits for Directus to be ready (up to 10 retries)
- Checks for schema file existence
- Copies schema to container
- Applies schema using Directus CLI
- Creates all collections, fields, and relationships

#### 8. API Token Setup Guide
- Displays Directus access information
- Shows admin credentials
- Provides step-by-step token creation guide
- Prompts for token input
- Updates both backend and frontend environment files

#### 9. Service Restart (if token provided)
- Restarts `orchestration-api` container
- Restarts `frontend` container
- Waits 10 seconds for reload

#### 10. Health Verification & Summary
- Tests all service endpoints
- Reports status of each service
- Displays access URLs
- Shows credentials
- Lists useful commands
- Provides next steps

### Visual Design Features

The script provides excellent user experience:

- ✅ **Color-coded output** - Info (blue), success (green), warning (yellow), error (red)
- ✅ **Step-by-step progress** - Clear section headers with ASCII borders
- ✅ **Real-time feedback** - Updates as each step completes
- ✅ **ASCII banners** - Professional appearance
- ✅ **Formatted tables** - Easy-to-read information layout

### Error Handling

The script gracefully handles:

- ✅ Missing environment files (creates them)
- ✅ Port conflicts (reports them clearly)
- ✅ Service failures (reports which failed)
- ✅ Missing schema files (skips import with warning)
- ✅ Timeout issues (provides retry commands)
- ✅ User cancellation (clean exit)

---

## 🔧 Advanced Topics

### Manual Environment Setup

If you prefer manual configuration:

```bash
# 1. Generate environment files
make setup-env

# 2. Edit configuration
nano .env
nano backend/.env
nano frontend/.env

# 3. Generate secrets manually
openssl rand -hex 16        # For KEY
openssl rand -base64 32     # For SECRET
openssl rand -hex 32        # For API_SECRET_KEY

# 4. Start services
make dev-up
```

### Updating Configuration

#### Update Gemini API Key

```bash
# Edit backend environment
nano backend/.env
# Update: GEMINI_API_KEY=your_actual_key

# Restart API
docker compose restart orchestration-api
# or
make dev-restart
```

#### Update Directus API Token

```bash
# Interactive update
make setup-directus-token

# Or manually
nano backend/.env    # Update DIRECTUS_API_TOKEN
nano frontend/.env   # Update DIRECTUS_TOKEN
docker compose restart orchestration-api frontend
# or
make dev-restart
```

#### Change Domain (Production)

```bash
# Edit root environment
nano .env
# Update: DOMAIN=new-domain.com

# Edit frontend environment
nano frontend/.env
# Update: PUBLIC_DOMAIN=new-domain.com

# Restart services
make restart
```

### Multiple Environments

You can maintain multiple environment files:

```bash
# Save current environment
cp .env .env.dev
cp backend/.env backend/.env.dev
cp frontend/.env frontend/.env.dev

# Create production environment
cp .env.dev .env.prod
# Edit .env.prod for production settings

# Switch environments
cp .env.prod .env
cp backend/.env.prod backend/.env
cp frontend/.env.prod frontend/.env
make restart
```

### Custom Docker Builds

```bash
# Build specific service (development)
docker compose -f docker-compose.dev.yml build --no-cache <service-name>

# Build specific service (production)
docker compose -f docker-compose.prod.yml build --no-cache <service-name>

# Build with specific target
DOCKER_BUILD_TARGET=development docker compose build orchestration-api

# Build and start
docker compose -f docker-compose.dev.yml up -d --build <service-name>
```

### Accessing Container Logs

```bash
# Follow logs for specific service (auto-detect environment)
make logs-frontend
make logs-api
make logs-directus

# Or use docker compose directly
docker compose logs -f <service-name>

# View last 100 lines
docker compose logs --tail=100 <service-name>

# View logs since specific time
docker compose logs --since 10m <service-name>

# Save logs to file
docker compose logs <service-name> > service.log
```

### Database Operations

```bash
# Access PostgreSQL shell
make shell-postgres

# Backup database
make backup
# Creates: backup_YYYYMMDD_HHMMSS.sql

# Restore database
docker compose exec -T postgres psql -U directus directus < backup.sql

# Export Directus schema
docker compose exec directus npx directus schema snapshot /directus/snapshots/schema.json
```

### Network Troubleshooting

```bash
# List Docker networks
docker network ls

# Inspect network
docker network inspect traefik-public
docker network inspect backend-internal

# Test connectivity between containers
docker compose exec frontend ping directus
docker compose exec orchestration-api ping postgres
```

### IDE Integration

#### VS Code

Your IDE works directly with source files. Changes are immediately reflected in Docker containers via volume mounts (development mode).

**Recommended extensions:**
- Astro
- ESLint
- Prettier
- Docker

#### Debugging

**Frontend (Browser):**
- Dev tools work normally
- Source maps available
- React DevTools compatible

**API (Node.js):**
```bash
# Attach to running container
docker compose -f docker-compose.dev.yml exec orchestration-api sh

# Check logs
make dev-logs-api
```

---

## ✅ Setup Checklist

Use this to verify your setup is complete:

- [ ] Docker and Docker Compose installed and running
- [ ] Repository cloned to local machine
- [ ] Ran `make setup-dev` or `make setup-prod`
- [ ] Setup script completed successfully
- [ ] All Docker services started
- [ ] Directus schema imported
- [ ] Created Directus API token
- [ ] Updated environment files with token
- [ ] Services restarted after token update
- [ ] All services passing health checks
- [ ] Can access Frontend at http://localhost:4321
- [ ] Can access Directus at http://localhost:8055
- [ ] Can login to Directus with admin credentials
- [ ] Credentials saved securely (password manager or secure notes)
- [ ] Tested uploading a document (optional)
- [ ] Read this setup guide
- [ ] Familiar with basic commands (`make help`)

---

## 🎉 You're All Set!

Your Office Automation environment is now fully configured and running!

### Quick Access Links

**Development:**
- 🌐 **Frontend:** http://dev-dejtoai.local or http://localhost:4321
- 🎛️ **Directus:** http://directus.dev-dejtoai.local or http://localhost:8055
- 🔧 **API:** http://localhost:3001
- 📊 **API Docs:** http://localhost:3001/api-docs
- 💾 **MinIO Console:** http://localhost:9001
- 📧 **MailHog:** http://mailhog.dev-dejtoai.local or http://localhost:8025

**Production:**
- 🌐 **Frontend:** https://your-domain.com
- 🎛️ **Directus:** https://your-domain.com/admin
- 🔧 **Traefik Dashboard:** https://traefik.your-domain.com

### Essential Commands

```bash
# Development (daily use)
make dev-up                # Start with hot-reload
make dev-down              # Stop development
make dev-logs              # View all logs
make dev-logs-frontend     # View frontend logs
make dev-logs-api          # View API logs

# Production
make prod-up               # Start production
make prod-down             # Stop production
make prod-logs             # View all logs

# General (auto-detect environment)
make status                # Check services
make logs                  # View logs
make health                # Test services
make down                  # Stop all
make restart               # Restart all

# Get help
make help                  # See all commands
```

### Next Steps

1. **Explore the application** - Try uploading a PDF document
2. **Browse Directus admin** - View collections and data
3. **Check the API docs** - http://localhost:3001/api-docs
4. **Start developing** - Edit code in `frontend/src/` or `backend/orchestration-api/src/`
   - Changes auto-reload in development mode!
5. **Read the main README** - Full project documentation

### Development Tips

- 💡 Use `make dev-up` for daily development (hot-reload enabled)
- 💡 Use `make prod-up` to test production builds
- 💡 Use `make status` to check what's running
- 💡 Use `make dev-logs-frontend` or `make dev-logs-api` to follow logs
- 💡 Use `make down` to stop everything
- 💡 Source code changes are picked up automatically in dev mode
- 💡 After adding new npm packages, rebuild: `make dev-build`

---

## 📚 Additional Resources

### Documentation

- **[README.md](README.md)** - Complete project documentation
- **[Makefile](Makefile)** - All available commands (run `make help`)

### Backend Documentation

- **[ORCHESTRATION_DEV_SETUP.md](backend/ORCHESTRATION_DEV_SETUP.md)** - API development details
- **[DIRECTUS_INTEGRATION.md](backend/orchestration-api/DIRECTUS_INTEGRATION.md)** - CMS integration
- **[DEVELOPMENT.md](backend/orchestration-api/DEVELOPMENT.md)** - Backend development guide

### Infrastructure Documentation

- **[TRAEFIK_SETUP.md](traefik/TRAEFIK_SETUP.md)** - Reverse proxy configuration
- **[ENVIRONMENT.md](backend/ENVIRONMENT.md)** - Environment variables reference

---

## 🆘 Need Help?

### Quick Debugging

```bash
# Check everything
make help                   # See all commands
make status                 # Check service status
make health                 # Test all services
make logs                   # View all logs

# Development specific
make dev-logs-frontend      # Frontend logs
make dev-logs-api           # API logs

# Specific service
docker compose logs <service-name>
docker compose restart <service-name>
```

### Common Solutions

```bash
# Services won't start
make restart

# Changes not reflecting (dev mode)
make dev-restart

# Port conflict
lsof -i :PORT  # Find what's using the port
make down      # Stop all environments
make dev-up    # Start development

# Module errors after adding packages
make dev-down
make dev-build
make dev-up

# Reset everything (loses data!)
make clean
make setup-dev
```

### Get Support

- 📖 Check relevant sections in this guide
- 🔍 Search the README.md
- 📝 Check service logs: `make logs` or `make dev-logs`
- 🧪 Test health: `make health`

---

**Happy Coding with Hot-Reload!** 🚀✨

**Complete setup system ready for development and production use with comprehensive automation, hot module reload, and user guidance.**
