# Docker Workers - Implementation Summary

## ✅ Complete Implementation

Docker services for BullMQ workers have been successfully added to all docker-compose files.

## 📁 Files Created

### 1. Worker Service Definition
**`backend/docker/workers/workers.yml`**
- Production-ready worker service definitions
- Configured for 3 workers (pdf, llm, erp)
- Health checks, logging, and restart policies
- Environment variable configuration

### 2. Documentation
**`backend/docker/workers/README.md`**
- Complete usage guide
- Monitoring and troubleshooting
- Scaling and performance tuning

**`backend/docker/workers/DOCKER_SETUP.md`**
- Setup instructions
- Configuration details
- Production checklist

## 📝 Files Modified

### 1. Production Compose
**`docker-compose.prod.yml`**
```yaml
include:
  # ... other services
  - ./backend/docker/workers/workers.yml  # ✅ Added
```

### 2. Backend Compose
**`backend/docker-compose.yml`**
```yaml
include:
  # ... other services
  - ./docker/workers/workers.yml  # ✅ Added
```

### 3. Development Compose
**`docker-compose.dev.yml`**
- Workers added as inline services
- Hot reload enabled
- Development optimizations

## 🚀 How to Use

### Production

```bash
# Start all services (including workers)
docker compose -f docker-compose.prod.yml up -d

# Workers start automatically:
# ✅ worker-pdf (PDF splitting)
# ✅ worker-llm (LLM processing)
# ⚠️ worker-erp (optional, needs --profile erp)
```

### Development

```bash
# With hot reload
docker compose -f docker-compose.dev.yml up -d

# Manual (for debugging)
cd backend/orchestration-api
npm run dev:worker:pdf    # Terminal 1
npm run dev:worker:llm    # Terminal 2
npm run dev:worker:erp    # Terminal 3
```

### Backend Only

```bash
cd backend
docker compose up -d

# All backend services + workers start
```

## 🔧 Worker Services

### worker-pdf
- **Image**: orchestration-api
- **Command**: `npm run start:worker:pdf`
- **Concurrency**: 2
- **Purpose**: PDF splitting and orchestration
- **Dependencies**: Directus, KeyDB

### worker-llm
- **Image**: orchestration-api
- **Command**: `npm run start:worker:llm`
- **Concurrency**: 3
- **Purpose**: LLM page processing
- **Dependencies**: Directus, KeyDB, Gemini API

### worker-erp
- **Image**: orchestration-api
- **Command**: `npm run start:worker:erp`
- **Concurrency**: 1
- **Purpose**: ERP integration (future)
- **Dependencies**: Directus, KeyDB
- **Profile**: `erp` (optional)

## 📊 Configuration

### Environment Variables

All configured in `backend/.env`:

```bash
# Directus (file management)
DIRECTUS_URL=http://directus:8055
DIRECTUS_API_TOKEN=your_token

# PostgreSQL
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=your_password

# KeyDB (BullMQ)
KEYDB_PASSWORD=your_password

# MinIO (via Directus)
MINIO_ROOT_USER=your_user
MINIO_ROOT_PASSWORD=your_password
MINIO_DEFAULT_BUCKET=documents

# Gemini API (for worker-llm)
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash

# Optional
SENTRY_DSN=your_dsn
LOG_LEVEL=info
NODE_ENV=production
```

### Networks

Workers connect to:
- **backend-internal**: For service communication
- No external network access (security)

### Health Checks

All workers have health checks:
- **Interval**: 30s
- **Timeout**: 10s
- **Retries**: 3
- **Start period**: 60s

## 🎯 Quick Operations

### View Status
```bash
docker ps --filter "name=worker"
```

### View Logs
```bash
docker logs worker-pdf -f
docker logs worker-llm -f
```

### Restart Worker
```bash
docker compose restart worker-pdf
```

### Scale Workers
```bash
docker compose up -d --scale worker-llm=5
```

## 📈 Monitoring

### Check Health
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | grep worker
```

### View Metrics
```bash
docker stats worker-pdf worker-llm
```

### Check Queue
```bash
docker exec -it keydb redis-cli -a $KEYDB_PASSWORD
> LLEN bull:pdf-workflow:waiting
> LLEN bull:page-llm:waiting
```

## 🐛 Troubleshooting

### Worker Not Starting

1. Check dependencies are running:
   ```bash
   docker ps | grep -E "directus|keydb"
   ```

2. Check logs:
   ```bash
   docker logs worker-pdf --tail 50
   ```

3. Verify environment variables:
   ```bash
   docker exec worker-pdf env | grep DIRECTUS
   ```

### No Jobs Processing

1. Check KeyDB connection:
   ```bash
   docker logs worker-pdf | grep "BullMQ"
   ```

2. Check Directus connection:
   ```bash
   docker logs worker-pdf | grep "Directus"
   ```

3. Verify jobs are queued:
   ```bash
   docker exec -it keydb redis-cli -a $KEYDB_PASSWORD
   > KEYS bull:*
   ```

## 🔐 Security Features

✅ **Isolated network** - Workers in backend-internal only
✅ **No exposed ports** - Internal communication only
✅ **Health checks** - Automatic restart on failure
✅ **Restart policy** - `unless-stopped`
✅ **Log rotation** - 10MB × 3 files max
✅ **Resource limits** - Can be configured

## 📚 Documentation

- **Backend Workers**
  - `backend/docker/workers/README.md` - Usage guide
  - `backend/docker/workers/DOCKER_SETUP.md` - Setup guide
  - `backend/docker/workers/workers.yml` - Service definitions

- **Orchestration API**
  - `backend/orchestration-api/PDF_WORKFLOW_README.md` - Workflow guide
  - `backend/orchestration-api/IMPLEMENTATION_SUMMARY.md` - Technical details
  - `backend/orchestration-api/DIRECTUS_FILE_MANAGEMENT.md` - File management
  - `backend/orchestration-api/FINAL_SUMMARY.md` - Complete overview

## ✅ Success Criteria

Workers are properly configured when:

1. ✅ Workers start without errors
2. ✅ Health checks pass
3. ✅ Workers connect to KeyDB
4. ✅ Workers connect to Directus
5. ✅ Jobs are processed successfully
6. ✅ Logs show no errors
7. ✅ Memory usage is stable
8. ✅ Workflows complete successfully

## 🎉 Summary

**Docker worker services are now fully configured** across all docker-compose files:

- ✅ **Production**: `docker-compose.prod.yml` includes workers
- ✅ **Development**: `docker-compose.dev.yml` includes workers with hot reload
- ✅ **Backend**: `backend/docker-compose.yml` includes workers
- ✅ **Documentation**: Complete guides and setup instructions
- ✅ **Configuration**: All environment variables documented
- ✅ **Monitoring**: Health checks and logging configured

The PDF workflow system can now be deployed and scaled using Docker Compose!


