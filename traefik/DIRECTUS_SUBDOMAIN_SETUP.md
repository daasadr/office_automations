# Directus Subdomain Configuration

## Summary

Directus has been reconfigured to use subdomain-based routing instead of path-based routing (`/admin`).

## Changes Made

### 1. Directus Configuration (`backend/docker/directus/directus.yml`)

- **Routing**: Changed from `/admin` path to `directus.${DOMAIN}` subdomain
- **PUBLIC_URL**: Set to `https://directus.${DOMAIN:-dev-dejtoai.local}`
- **Middleware**: Removed strip-prefix middleware (not needed with subdomain)
- **Priority**: Removed priority labels (not needed with different domains)

### 2. Frontend Configuration (`frontend/docker/frontend.yml`)

- **PUBLIC_DIRECTUS_URL**: Changed from `https://${DOMAIN}/admin` to `https://directus.${DOMAIN}`
- **Priority**: Removed priority labels

### 3. Health Check

- Fixed to use `wget` with IPv4 address (`127.0.0.1`)

## Domain Mapping

| Environment | Main Domain | Directus Subdomain |
|-------------|-------------|-------------------|
| Development | `dev-dejtoai.local` | `directus.dev-dejtoai.local` |
| Production  | `dejtoai.cz` | `directus.dejtoai.cz` |

## Setup Instructions

### Local Development Setup

**1. Add subdomain to `/etc/hosts`:**

```bash
echo "127.0.0.1 directus.dev-dejtoai.local" | sudo tee -a /etc/hosts
```

Or manually edit `/etc/hosts` and add:
```
127.0.0.1 directus.dev-dejtoai.local
```

**2. Verify DNS resolution:**

```bash
ping -c 1 directus.dev-dejtoai.local
```

**3. Access Directus:**

- Development: `http://directus.dev-dejtoai.local`
- Or with HTTPS: `https://directus.dev-dejtoai.local` (self-signed cert warning expected locally)

### Production Setup

For production, ensure your DNS provider has an A record for:
```
directus.dejtoai.cz → Your server IP
```

Traefik will automatically provision Let's Encrypt SSL certificates.

## Testing

**Test Directus subdomain:**
```bash
curl -I http://directus.dev-dejtoai.local
```

**Test main frontend still works:**
```bash
curl -I http://dev-dejtoai.local
```

**Check Traefik routes:**
```bash
docker compose logs traefik | grep "directus"
```

## Current Status

✅ Directus configured for subdomain routing  
✅ Frontend updated to use new Directus URL  
✅ Traefik routes registered correctly  
✅ Health checks working  
⏳ Waiting for `/etc/hosts` entry to be added  

## Rollback (if needed)

To rollback to path-based routing, restore the previous configurations from git history for:
- `backend/docker/directus/directus.yml`
- `frontend/docker/frontend.yml`

## Advantages of Subdomain Approach

1. **Cleaner URLs**: No path manipulation needed
2. **Better CORS**: Separate origins for better security
3. **Simpler routing**: No priority management required
4. **Standard practice**: Most CMS/admin panels use subdomains
5. **No path conflicts**: Directus and frontend routes never overlap

## Files Modified

- `backend/docker/directus/directus.yml` - Subdomain routing + PUBLIC_URL
- `frontend/docker/frontend.yml` - Updated PUBLIC_DIRECTUS_URL

