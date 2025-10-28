# Orchestration API - Development & Production Setup

## Overview

The Orchestration API now supports two distinct modes:

1. **Development Mode** - Hot-reloading for rapid development
2. **Production Mode** - Optimized, compiled, production-ready build

## Quick Start

### Development Mode (Recommended for local development)

```bash
# Option 1: Using Make (Easiest)
make start-dev

# Option 2: Using Docker Compose directly
cd backend
docker-compose -f docker-compose.yml -f docker/orchestration/orchestration.dev.yml up -d orchestration-api

# View logs in real-time
make logs-orchestration
```

**What happens:**
- ✅ Server automatically restarts when you edit code
- ✅ TypeScript compiled on-the-fly
- ✅ Source code mounted as Docker volume
- ✅ No need to rebuild container for code changes
- ✅ Perfect for rapid development

### Production Mode (For deployment or testing production build)

```bash
# Option 1: Using Make (Easiest)
make start-prod

# Option 2: Using Docker Compose directly
cd backend
docker-compose -f docker-compose.yml -f docker/orchestration/orchestration.prod.yml up -d orchestration-api
```

**What happens:**
- ✅ Optimized multi-stage Docker build
- ✅ Pre-compiled TypeScript to JavaScript
- ✅ Smaller image size
- ✅ Production dependencies only
- ✅ Better performance and security

## When to Use Each Mode

| Scenario | Mode | Command |
|----------|------|---------|
| Local development | **Development** | `make start-dev` |
| Changing API code frequently | **Development** | `make start-dev` |
| Testing before deployment | **Production** | `make start-prod` |
| Deployment to staging/production | **Production** | `make start-prod` |

## Making Code Changes

### In Development Mode

1. Edit any file in `backend/orchestration-api/src/`
2. Save the file
3. Wait 1-2 seconds
4. Server automatically restarts with changes ✨

**Example:**
```bash
# Start in dev mode
make start-dev

# Edit a file
vim backend/orchestration-api/src/routes/documents.ts

# Save and watch logs
make logs-orchestration
# You'll see: "[tsx] restarted due to changes..."
```

### In Production Mode

If you need to update code while in production mode:

```bash
# Stop the service
docker-compose down orchestration-api

# Rebuild the image
make rebuild-orchestration

# Start again
make start-prod
```

## Environment Variables

You can set the default build target in your `.env` file:

```env
# For development (optional - can use docker-compose overrides instead)
DOCKER_BUILD_TARGET=development

# For production (this is the default)
DOCKER_BUILD_TARGET=production
```

**Note:** Using docker-compose override files (`.dev.yml` / `.prod.yml`) is preferred over environment variables, as it explicitly controls volume mounts.

## Docker Architecture

### Multi-Stage Dockerfile

The `Dockerfile` now contains multiple build stages:

```
┌─────────────────┐
│   base stage    │ ← Common dependencies
└────────┬────────┘
         │
    ┌────┴───────────────┬─────────────┐
    │                    │             │
┌───▼──────────┐  ┌──────▼─────┐  ┌──▼────────┐
│ development  │  │  builder   │  │production │
│   stage      │  │   stage    │  │  stage    │
└──────────────┘  └──────┬─────┘  └───────────┘
                         │
                    ┌────▼─────┐
                    │   Builds │
                    │  TS→JS   │
                    └──────────┘
```

### Development Stage
- Includes all dev dependencies (`tsx`, TypeScript, etc.)
- Uses `tsx watch` for hot-reloading
- Source code mounted as volume
- Fast iteration

### Production Stage
- Production dependencies only
- Pre-compiled JavaScript
- No source volumes
- Optimized for performance

## Common Commands

```bash
# Start development mode
make start-dev

# Start production mode  
make start-prod

# Rebuild after package.json changes
make rebuild-orchestration

# View logs
make logs-orchestration

# Check if it's running
make health

# Stop orchestration API
docker-compose down orchestration-api

# Stop all services
make stop
```

## Troubleshooting

### Changes not reflecting in development mode?

1. **Check you're in dev mode:**
   ```bash
   docker-compose ps
   # Should show orchestration-api running
   
   make logs-orchestration
   # Should show "tsx watch" in startup logs
   ```

2. **Verify volume mounts:**
   ```bash
   docker inspect office-automation_-orchestration-api | grep Mounts -A 20
   # Should show /app/src mounted
   ```

3. **Restart in dev mode:**
   ```bash
   docker-compose down orchestration-api
   make start-dev
   ```

### Package.json changes not working?

After changing dependencies, you MUST rebuild:

```bash
make rebuild-orchestration
make start-dev  # or start-prod
```

### Port conflicts?

```bash
# Check what's using port 3001
lsof -i :3001

# Change port in .env
echo "ORCHESTRATION_PORT=3002" >> backend/.env
```

### Container won't start?

```bash
# Check logs
make logs-orchestration

# Check all services
make status

# Nuclear option - clean restart
docker-compose down orchestration-api
make rebuild-orchestration
make start-dev
```

## Files Modified

This setup includes the following files:

### New Files
- `backend/orchestration-api/Dockerfile.dev` - Standalone dev Dockerfile (alternative)
- `backend/docker/orchestration/orchestration.dev.yml` - Development compose override
- `backend/docker/orchestration/orchestration.prod.yml` - Production compose override
- `backend/orchestration-api/DEVELOPMENT.md` - Detailed development guide

### Modified Files
- `backend/orchestration-api/Dockerfile` - Now multi-stage with dev & prod targets
- `backend/docker/orchestration/orchestration.yml` - Simplified, uses overrides
- `backend/README.md` - Added development mode documentation
- `Makefile` - Added `start-dev`, `start-prod`, `rebuild-orchestration` commands

## Best Practices

1. **Always use development mode locally** - Faster iteration, immediate feedback
2. **Test production builds** - Before deploying, test with `make start-prod`
3. **Watch logs during development** - `make logs-orchestration` shows restarts
4. **Rebuild after dependency changes** - Any `package.json` edit needs rebuild
5. **Use Make commands** - They're simpler and handle compose overrides correctly

## Additional Resources

- Full documentation: `backend/orchestration-api/DEVELOPMENT.md`
- Backend README: `backend/README.md`
- Package scripts: `backend/orchestration-api/package.json`

## Summary

🔧 **Development:** Fast, hot-reload, for coding
```bash
make start-dev
```

🚀 **Production:** Optimized, compiled, for deployment
```bash
make start-prod
```

That's it! Happy coding! 🎉





