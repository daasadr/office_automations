# Directus Management Scripts

This directory contains scripts for managing Directus schema and policies (roles, permissions, access control).

## Overview

These scripts help you:
- **Export** complete Directus configuration (schema + policies)
- **Import** schema and policies into Directus
- **Backup** and restore Directus configuration

## Scripts

### 1. Export Complete Snapshot

**Script:** `export-directus-snapshot.sh`

Exports both schema and policies from the running Directus instance.

```bash
./backend/scripts/export-directus-snapshot.sh
```

**What it exports:**
- **Schema**: Collections, fields, relations → `docker/directus/schema/directus11_schema_snapshot_simplified.json`
- **Policies**: Roles, policies, access, permissions → `docker/directus/policies/directus_policies_snapshot.json`

**Requirements:**
- Directus container must be running
- PostgreSQL container must be running

---

### 2. Import Schema (Interactive)

**Script:** `import-directus-schema.sh`

Interactive import with prompts and confirmations. Good for manual imports.

```bash
./backend/scripts/import-directus-schema.sh
```

**Features:**
- Shows schema diff before applying
- Asks for confirmation
- Creates backup of current schema
- Optionally imports policies
- Provides restore instructions if something goes wrong

**Use when:**
- Manually importing schema changes
- You want to review changes before applying
- Setting up development environment

---

### 3. Quick Import (Non-interactive)

**Script:** `quick-import-schema.sh`

Automated import without prompts. Perfect for CI/CD and automation.

```bash
./backend/scripts/quick-import-schema.sh
```

**Features:**
- No user interaction required
- Automatically imports both schema and policies
- Suitable for CI/CD pipelines
- Fast execution

**Use when:**
- In CI/CD pipelines
- Automated deployments
- Docker container initialization
- Fresh installations

---

### 4. Import Policies Only

**Script:** `import-directus-policies.sh`

Imports only roles, policies, access control, and permissions.

```bash
./backend/scripts/import-directus-policies.sh
```

**What it imports:**
- Roles
- Policies
- Access entries (role-to-policy mappings)
- Permissions (collection-level access rules)

**Note:** This script imports directly into the PostgreSQL database. Make sure to log out and log back in to Directus after importing to see changes.

---

## File Structure

```
backend/
├── docker/
│   └── directus/
│       ├── schema/
│       │   └── directus11_schema_snapshot_simplified.json
│       └── policies/
│           └── directus_policies_snapshot.json
└── scripts/
    ├── export-directus-snapshot.sh        # Export everything
    ├── import-directus-schema.sh          # Import (interactive)
    ├── quick-import-schema.sh             # Import (automated)
    ├── import-directus-policies.sh        # Import policies only
    └── README.md                          # This file
```

---

## Common Workflows

### 1. Export Current Configuration

```bash
# Export everything from running Directus
./backend/scripts/export-directus-snapshot.sh
```

This creates/updates:
- `docker/directus/schema/directus11_schema_snapshot_simplified.json`
- `docker/directus/policies/directus_policies_snapshot.json`

Commit these files to version control.

---

### 2. Fresh Installation

When setting up a new environment:

```bash
# Start services
docker compose up -d

# Wait for services to be ready
sleep 10

# Import schema and policies
./backend/scripts/quick-import-schema.sh
```

---

### 3. Update Schema in Development

When pulling schema changes from git:

```bash
# Interactive import with confirmation
./backend/scripts/import-directus-schema.sh

# Answer 'y' to prompts to apply changes
```

---

### 4. Update Only Permissions

If you only changed permissions/policies:

```bash
./backend/scripts/import-directus-policies.sh
```

Then log out and back in to Directus to see changes.

---

## Troubleshooting

### Schema Import Failed

If schema import fails:

```bash
# Restore from backup (use backup path from error message)
docker exec directus npx directus schema apply --yes /directus/snapshots/backup-YYYY-MM-DD_HH-MM-SS.json
```

### Policies Import Failed

If policies import fails, you can manually check the database:

```bash
# Connect to database
docker exec -it postgres psql -U app -d app

# Check tables
\dt directus_*

# View policies
SELECT * FROM directus_policies;
```

### Containers Not Running

Make sure containers are running:

```bash
# Check status
docker ps

# Start if needed
docker compose up -d

# Check logs
docker compose logs directus
docker compose logs postgres
```

### Permission Denied

If you get permission denied errors:

```bash
# Make scripts executable
chmod +x backend/scripts/*.sh
```

---

## Technical Details

### Schema Import

- Uses Directus CLI: `npx directus schema snapshot` and `schema apply`
- Format: JSON
- Location: `docker/directus/schema/`
- Includes: Collections, fields, relations, display settings

### Policies Import

- Uses direct PostgreSQL access
- Format: JSON
- Location: `docker/directus/policies/`
- Includes:
  - **Roles**: User roles (e.g., Administrator)
  - **Policies**: Permission policies
  - **Access**: Role-to-policy mappings
  - **Permissions**: Collection-level CRUD permissions

### Why Direct Database Import for Policies?

Directus doesn't provide CLI commands for importing policies, so we:
1. Export policies as SQL queries
2. Combine into JSON format
3. Import using Python script that connects to PostgreSQL
4. Use `ON CONFLICT` to update existing entries

---

## Best Practices

1. **Always export before making changes**
   ```bash
   ./backend/scripts/export-directus-snapshot.sh
   ```

2. **Commit snapshots to version control**
   - Track schema changes over time
   - Easy rollback if needed
   - Team synchronization

3. **Test imports in development first**
   - Never import directly to production without testing
   - Review diffs carefully

4. **Use quick-import for CI/CD**
   - Automated, no prompts
   - Consistent deployments

5. **Clear browser cache after import**
   - Directus caches schema in browser
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

---

## Version Compatibility

These scripts are designed for:
- **Directus**: 11.9.1+
- **PostgreSQL**: 13+
- **Database**: PostgreSQL (required for policies import)

For other databases, policies import may need modification.

---

## Support

If you encounter issues:

1. Check container logs: `docker compose logs directus postgres`
2. Verify containers are running: `docker ps`
3. Check file permissions: `ls -la backend/scripts/`
4. Review script output for specific error messages

For Directus-specific issues, see: https://docs.directus.io/

