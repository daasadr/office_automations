# Docker Workers Setup - Complete

## ✅ What Was Added

### 1. Worker Service File
**File**: `backend/docker/workers/workers.yml`

Contains 3 worker services:
- **worker-pdf** - PDF splitting and orchestration
- **worker-llm** - LLM page processing  
- **worker-erp** - ERP sync (optional, uses profile)

### 2. Updated Docker Compose Files

#### Production (`docker-compose.prod.yml`)
```yaml
include:
  # ... other services
  - ./backend/docker/workers/workers.yml  # ✅ Added
```

#### Backend (`backend/docker-compose.yml`)
```yaml
include:
  # ... other services
  - ./docker/workers/workers.yml  # ✅ Added
```

#### Development (`docker-compose.dev.yml`)
Workers added as inline services with hot reload support.

### 3. Documentation
- **README.md** - Usage guide
- **DOCKER_SETUP.md** - This file

## 🚀 Quick Start

### Production

```bash
# Start all services including workers
docker compose -f docker-compose.prod.yml up -d

# Check worker status
docker ps --filter "name=worker"

# View logs
docker logs worker-pdf -f
docker logs worker-llm -f
```

### Development

```bash
# Start with hot reload
docker compose -f docker-compose.dev.yml up -d

# Workers will auto-reload on code changes
```

### Backend Only

```bash
cd backend
docker compose up -d

# All backend services including workers will start
```

## 📋 Worker Configuration

### Environment Variables

Each worker needs these variables (set in `backend/.env`):

```bash
# Directus (file management)
DIRECTUS_URL=http://directus:8055
DIRECTUS_API_TOKEN=your_token

# Database
DB_HOST=postgres
DB_DATABASE=directus
DB_USER=directus
DB_PASSWORD=your_password

# KeyDB (BullMQ)
REDIS_HOST=keydb
KEYDB_PASSWORD=your_password

# MinIO (via Directus)
MINIO_ENDPOINT=minio
MINIO_ROOT_USER=your_user
MINIO_ROOT_PASSWORD=your_password
MINIO_DEFAULT_BUCKET=documents

# LLM (for worker-llm only)
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

### Worker Specifics

#### worker-pdf
- **Concurrency**: 2
- **Memory**: ~500MB per worker
- **Depends on**: Directus, KeyDB
- **Ports**: None (internal only)

#### worker-llm
- **Concurrency**: 3
- **Memory**: ~300MB per worker
- **Depends on**: Directus, KeyDB
- **Ports**: None (internal only)
- **Requires**: `GEMINI_API_KEY`

#### worker-erp
- **Concurrency**: 1
- **Memory**: ~200MB per worker
- **Depends on**: Directus, KeyDB
- **Ports**: None (internal only)
- **Profile**: `erp` (optional)

## 🔧 Common Operations

### Start/Stop Workers

```bash
# Start all workers
docker compose -f docker-compose.prod.yml up -d worker-pdf worker-llm worker-erp

# Stop all workers
docker compose -f docker-compose.prod.yml stop worker-pdf worker-llm worker-erp

# Restart specific worker
docker compose -f docker-compose.prod.yml restart worker-pdf
```

### Scale Workers

```bash
# Scale LLM workers to 5 instances
docker compose -f docker-compose.prod.yml up -d --scale worker-llm=5

# Note: Remove container_name to allow scaling
```

### View Logs

```bash
# All workers
docker compose -f docker-compose.prod.yml logs -f worker-pdf worker-llm

# Last 100 lines
docker logs worker-pdf --tail 100

# Follow logs
docker logs worker-llm -f
```

### Check Health

```bash
# Worker status
docker ps --filter "name=worker" --format "table {{.Names}}\t{{.Status}}"

# Health check details
docker inspect worker-pdf | jq '.[0].State.Health'
```

## 🐛 Troubleshooting

### Worker Not Starting

1. **Check dependencies**:
   ```bash
   docker ps | grep -E "directus|keydb|postgres"
   ```

2. **Check environment variables**:
   ```bash
   docker exec worker-pdf env | grep -E "DIRECTUS|KEYDB|DB_"
   ```

3. **Check logs for errors**:
   ```bash
   docker logs worker-pdf --tail 50
   ```

### Worker Crashes

1. **Check memory**:
   ```bash
   docker stats worker-pdf
   ```

2. **Check disk space**:
   ```bash
   docker exec worker-pdf df -h
   ```

3. **Restart worker**:
   ```bash
   docker compose -f docker-compose.prod.yml restart worker-pdf
   ```

### No Jobs Processing

1. **Check KeyDB connection**:
   ```bash
   docker logs worker-pdf | grep "BullMQ"
   ```

2. **Check queue length**:
   ```bash
   docker exec -it keydb redis-cli -a $KEYDB_PASSWORD
   > LLEN bull:pdf-workflow:waiting
   ```

3. **Check Directus connection**:
   ```bash
   docker logs worker-pdf | grep "Directus"
   ```

## 📊 Monitoring

### Key Metrics

- **Queue Length**: Number of jobs waiting
- **Processing Time**: Time to process each job
- **Memory Usage**: Worker memory consumption
- **Error Rate**: Failed jobs / total jobs

### Log Patterns

```bash
# Successful processing
docker logs worker-pdf | grep "completed successfully"

# Errors
docker logs worker-llm | grep "ERROR"

# Rate limiting
docker logs worker-llm | grep "rate"

# Job counts
docker logs worker-pdf | grep "Job completed"
```

## 🔐 Security

### Best Practices

1. **Use secrets for sensitive data**:
   ```yaml
   secrets:
     - directus_token
     - gemini_api_key
   ```

2. **Limit network access**:
   ```yaml
   networks:
     - backend-internal  # No external access
   ```

3. **Read-only root filesystem**:
   ```yaml
   read_only: true
   tmpfs:
     - /tmp
   ```

4. **Run as non-root user**:
   ```dockerfile
   USER node
   ```

## 🎯 Production Checklist

- [ ] Set all environment variables in `backend/.env`
- [ ] Build images: `docker compose build`
- [ ] Start dependencies: `docker compose up -d directus keydb`
- [ ] Start workers: `docker compose up -d worker-pdf worker-llm`
- [ ] Verify workers running: `docker ps | grep worker`
- [ ] Check logs for errors: `docker logs worker-pdf`
- [ ] Test with sample workflow
- [ ] Monitor resource usage
- [ ] Set up log aggregation (optional)
- [ ] Set up alerting (optional)

## 📚 Related Files

- **workers.yml** - Worker service definitions
- **README.md** - Usage documentation
- **../../orchestration-api/PDF_WORKFLOW_README.md** - Workflow guide
- **../../orchestration-api/IMPLEMENTATION_SUMMARY.md** - Technical details

## 🆘 Support

For issues:

1. Check logs: `docker logs worker-name`
2. Check health: `docker inspect worker-name`
3. Restart: `docker compose restart worker-name`
4. Review documentation in `orchestration-api/` directory

## ✅ Success Indicators

Workers are working correctly when:

1. ✅ Containers show "healthy" status
2. ✅ Logs show "Worker started" messages
3. ✅ Jobs are being processed (check workflow status)
4. ✅ No error messages in logs
5. ✅ Memory usage is stable
6. ✅ CPU usage is reasonable


