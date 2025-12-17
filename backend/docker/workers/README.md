# BullMQ Workers

Docker services for BullMQ workers that process PDF workflows.

## Workers

### 1. worker-pdf
**Purpose**: PDF splitting and workflow orchestration

**Responsibilities**:
- Downloads PDF from Directus
- Splits PDF into individual pages using pdf-lib
- Uploads each page back to Directus
- Creates workflow steps
- Enqueues page LLM jobs

**Concurrency**: 2 (to avoid memory issues with large PDFs)

### 2. worker-llm
**Purpose**: LLM page processing

**Responsibilities**:
- Downloads page from Directus
- Processes page with Gemini API
- Stores LLM results in database
- Tracks workflow completion

**Concurrency**: 3 (to control LLM API rate limits)

### 3. worker-erp
**Purpose**: ERP/IFS integration (future)

**Responsibilities**:
- Syncs data to ERP system
- Implements outbox pattern for reliability
- Handles retry logic

**Concurrency**: 1 (ERP systems are fragile)

**Note**: Uses Docker profile `erp` - only starts when explicitly enabled

## Usage

### Start All Workers (Production)

```bash
# Start all services including workers
docker compose -f docker-compose.prod.yml up -d

# Workers start automatically:
# - worker-pdf
# - worker-llm
# - worker-erp (only with --profile erp)
```

### Start Specific Workers

```bash
# Start only PDF worker
docker compose -f docker-compose.prod.yml up -d worker-pdf

# Start only LLM worker
docker compose -f docker-compose.prod.yml up -d worker-llm

# Start ERP worker (requires profile)
docker compose -f docker-compose.prod.yml --profile erp up -d worker-erp
```

### Development

For development with hot reload, use `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Or run manually:

```bash
cd backend/orchestration-api

# Terminal 1
npm run dev:worker:pdf

# Terminal 2
npm run dev:worker:llm

# Terminal 3
npm run dev:worker:erp
```

## Environment Variables

Required environment variables (set in `backend/.env`):

```bash
# Directus (file management)
DIRECTUS_URL=http://directus:8055
DIRECTUS_API_TOKEN=your_token

# PostgreSQL (workflow state)
POSTGRES_DB=directus
POSTGRES_USER=directus
POSTGRES_PASSWORD=your_password

# KeyDB/Redis (BullMQ)
KEYDB_PASSWORD=your_password

# MinIO (for Directus file storage)
MINIO_ROOT_USER=your_user
MINIO_ROOT_PASSWORD=your_password
MINIO_DEFAULT_BUCKET=documents

# Gemini API (for LLM worker)
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash

# Optional
SENTRY_DSN=your_sentry_dsn
SENTRY_ENABLED=false
LOG_LEVEL=info
NODE_ENV=production
```

## Monitoring

### View Logs

```bash
# All workers
docker compose -f docker-compose.prod.yml logs -f worker-pdf worker-llm worker-erp

# Specific worker
docker logs worker-pdf -f
docker logs worker-llm -f
docker logs worker-erp -f
```

### Health Checks

Workers have health checks that verify the process is running:

```bash
# Check health status
docker ps --filter "name=worker" --format "table {{.Names}}\t{{.Status}}"
```

### Restart Workers

```bash
# Restart all workers
docker compose -f docker-compose.prod.yml restart worker-pdf worker-llm worker-erp

# Restart specific worker
docker compose -f docker-compose.prod.yml restart worker-pdf
```

## Scaling

### Scale Workers

You can run multiple instances of workers:

```bash
# Run 2 PDF workers
docker compose -f docker-compose.prod.yml up -d --scale worker-pdf=2

# Run 5 LLM workers (for higher throughput)
docker compose -f docker-compose.prod.yml up -d --scale worker-llm=5
```

**Note**: Ensure container names don't conflict when scaling.

## Troubleshooting

### Worker Not Processing Jobs

1. Check KeyDB connection:
   ```bash
   docker logs worker-pdf | grep "BullMQ"
   ```

2. Check Directus connection:
   ```bash
   docker logs worker-pdf | grep "Directus"
   ```

3. Verify queue has jobs:
   ```bash
   # Connect to KeyDB
   docker exec -it keydb redis-cli -a $KEYDB_PASSWORD
   
   # Check queue length
   LLEN bull:pdf-workflow:waiting
   ```

### Worker Crashing

1. Check memory usage:
   ```bash
   docker stats worker-pdf
   ```

2. Check error logs:
   ```bash
   docker logs worker-pdf --tail 100
   ```

3. Restart worker:
   ```bash
   docker compose -f docker-compose.prod.yml restart worker-pdf
   ```

### LLM Rate Limiting

If LLM worker is hitting rate limits:

1. Reduce concurrency in `pageLlmQueue.ts`
2. Increase backoff delay
3. Scale down LLM workers

## Performance Tuning

### PDF Worker

- **Concurrency**: Adjust based on available memory
- **Memory**: Large PDFs need more memory
- **Storage**: Ensure MinIO has enough space

### LLM Worker

- **Concurrency**: Adjust based on Gemini API rate limits
- **Backoff**: Tune exponential backoff for rate limits
- **Scaling**: Add more workers for higher throughput

### ERP Worker

- **Concurrency**: Keep at 1 unless ERP can handle more
- **Retry**: Tune max attempts based on ERP reliability
- **Timeout**: Adjust based on ERP response times

## Dependencies

Workers depend on:

- **PostgreSQL**: For workflow state
- **KeyDB**: For BullMQ queues
- **Directus**: For file management
- **MinIO**: For file storage (via Directus)

Ensure these services are running before starting workers.

## Architecture

```
orchestration-api (REST API)
         │
         ├─ Enqueues jobs to BullMQ queues
         │
         ▼
┌────────────────────────────────┐
│   KeyDB (BullMQ Backend)       │
│                                 │
│  Queues:                        │
│  - pdf-workflow                 │
│  - page-llm                     │
│  - erp-sync                     │
└────────────────────────────────┘
         │
         ├──────────┬──────────┬──────────┐
         ▼          ▼          ▼          ▼
    worker-pdf  worker-llm  worker-erp  ...
         │          │          │
         ▼          ▼          ▼
    ┌────────────────────────────┐
    │      Directus + MinIO      │
    │   (File Management)        │
    └────────────────────────────┘
```

## Related Documentation

- **`../../orchestration-api/PDF_WORKFLOW_README.md`** - Complete workflow guide
- **`../../orchestration-api/IMPLEMENTATION_SUMMARY.md`** - Technical details
- **`../../orchestration-api/DIRECTUS_FILE_MANAGEMENT.md`** - File management architecture

