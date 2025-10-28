#!/bin/bash

# Import Directus Policies Script
# This script imports roles, policies, access, and permissions into Directus

set -e  # Exit on any error

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
POSTGRES_CONTAINER="postgres"
POLICIES_FILE="$PROJECT_ROOT/docker/directus/policies/directus_policies_snapshot.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if policies file exists
if [ ! -f "$POLICIES_FILE" ]; then
    log_error "Policies file not found: $POLICIES_FILE"
    log_error "Expected location: docker/directus/policies/directus_policies_snapshot.json"
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if postgres container exists and is running
RUNNING_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E "^${POSTGRES_CONTAINER}$")

if [ -z "$RUNNING_CONTAINER" ]; then
    log_error "PostgreSQL container not found (looking for: ${POSTGRES_CONTAINER})"
    log_info "Please start the services with: docker compose up -d"
    exit 1
fi

log_info "Starting Directus policies import process..."
log_info "Project root: ${PROJECT_ROOT}"
log_info "Policies file: ${POLICIES_FILE}"
log_info "PostgreSQL container: ${POSTGRES_CONTAINER}"

# Copy policies file to postgres container
log_info "Copying policies file to container..."
if docker cp "$POLICIES_FILE" "${POSTGRES_CONTAINER}:/tmp/policies_import.json"; then
    log_success "Policies file copied to container"
else
    log_error "Failed to copy policies file to container"
    exit 1
fi

# Create Python import script
log_info "Creating import script..."
docker exec "$POSTGRES_CONTAINER" sh -c 'cat > /tmp/import_policies.py << '\''EOF'\''
import json
import psycopg2
import sys
from datetime import datetime

# Database connection parameters
DB_PARAMS = {
    "host": "localhost",
    "database": "app",
    "user": "app",
    "password": ""  # Will be set from environment
}

def import_policies():
    try:
        # Read policies file
        with open("/tmp/policies_import.json", "r") as f:
            data = json.load(f)
        
        # Connect to database
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        
        print(f"✅ Connected to database")
        print(f"📦 Loaded policies snapshot from: {data.get('\''exported_at'\'', '\''unknown'\'')}")
        
        # Start transaction
        conn.autocommit = False
        
        # Import roles (skip if already exists)
        roles = data.get("roles", [])
        roles_imported = 0
        roles_skipped = 0
        
        for role in roles:
            try:
                cur.execute(
                    """
                    INSERT INTO directus_roles (id, name, icon, description, parent)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        icon = EXCLUDED.icon,
                        description = EXCLUDED.description,
                        parent = EXCLUDED.parent
                    """,
                    (role["id"], role["name"], role.get("icon"), role.get("description"), role.get("parent"))
                )
                if cur.rowcount > 0:
                    roles_imported += 1
                else:
                    roles_skipped += 1
            except Exception as e:
                print(f"⚠️  Warning importing role {role.get('\''name'\'', '\''unknown'\'')}: {e}")
        
        print(f"✓ Roles: {roles_imported} imported/updated, {roles_skipped} unchanged")
        
        # Import policies
        policies = data.get("policies", [])
        policies_imported = 0
        
        for policy in policies:
            try:
                cur.execute(
                    """
                    INSERT INTO directus_policies (id, name, icon, description, ip_access, enforce_tfa, admin_access, app_access)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        icon = EXCLUDED.icon,
                        description = EXCLUDED.description,
                        ip_access = EXCLUDED.ip_access,
                        enforce_tfa = EXCLUDED.enforce_tfa,
                        admin_access = EXCLUDED.admin_access,
                        app_access = EXCLUDED.app_access
                    """,
                    (
                        policy["id"], policy["name"], policy.get("icon"), policy.get("description"),
                        policy.get("ip_access"), policy.get("enforce_tfa", False),
                        policy.get("admin_access", False), policy.get("app_access", True)
                    )
                )
                policies_imported += 1
            except Exception as e:
                print(f"⚠️  Warning importing policy {policy.get('\''name'\'', '\''unknown'\'')}: {e}")
        
        print(f"✓ Policies: {policies_imported} imported/updated")
        
        # Import access (role-to-policy mappings)
        access_entries = data.get("access", [])
        access_imported = 0
        
        for access in access_entries:
            try:
                cur.execute(
                    """
                    INSERT INTO directus_access (id, role, "user", policy, sort)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        role = EXCLUDED.role,
                        "user" = EXCLUDED."user",
                        policy = EXCLUDED.policy,
                        sort = EXCLUDED.sort
                    """,
                    (access["id"], access.get("role"), access.get("user"), access["policy"], access.get("sort"))
                )
                access_imported += 1
            except Exception as e:
                print(f"⚠️  Warning importing access entry: {e}")
        
        print(f"✓ Access: {access_imported} entries imported/updated")
        
        # Import permissions
        permissions = data.get("permissions", [])
        permissions_imported = 0
        
        # First, delete existing permissions for the policies we'\''re importing
        policy_ids = [p["id"] for p in policies]
        if policy_ids:
            cur.execute(
                "DELETE FROM directus_permissions WHERE policy = ANY(%s)",
                (policy_ids,)
            )
            print(f"✓ Cleared existing permissions for imported policies")
        
        for perm in permissions:
            try:
                cur.execute(
                    """
                    INSERT INTO directus_permissions (id, collection, action, permissions, validation, presets, fields, policy)
                    VALUES (%s, %s, %s, %s::json, %s::json, %s::json, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        collection = EXCLUDED.collection,
                        action = EXCLUDED.action,
                        permissions = EXCLUDED.permissions,
                        validation = EXCLUDED.validation,
                        presets = EXCLUDED.presets,
                        fields = EXCLUDED.fields,
                        policy = EXCLUDED.policy
                    """,
                    (
                        perm["id"], perm["collection"], perm["action"],
                        json.dumps(perm.get("permissions")) if perm.get("permissions") else None,
                        json.dumps(perm.get("validation")) if perm.get("validation") else None,
                        json.dumps(perm.get("presets")) if perm.get("presets") else None,
                        perm.get("fields"), perm["policy"]
                    )
                )
                permissions_imported += 1
            except Exception as e:
                print(f"⚠️  Warning importing permission: {e}")
        
        print(f"✓ Permissions: {permissions_imported} imported/updated")
        
        # Commit transaction
        conn.commit()
        
        print("")
        print("✅ Policies import completed successfully!")
        print(f"   • Roles: {roles_imported}")
        print(f"   • Policies: {policies_imported}")
        print(f"   • Access entries: {access_imported}")
        print(f"   • Permissions: {permissions_imported}")
        
        cur.close()
        conn.close()
        
        return 0
        
    except Exception as e:
        print(f"❌ Error during import: {e}", file=sys.stderr)
        if '\''conn'\'' in locals():
            conn.rollback()
            conn.close()
        return 1

if __name__ == "__main__":
    sys.exit(import_policies())
EOF
'

# Run the import script
log_info "Importing policies into database..."
if docker exec "$POSTGRES_CONTAINER" sh -c 'export POSTGRES_PASSWORD=$(cat /run/secrets/postgres-password 2>/dev/null || echo "$POSTGRES_PASSWORD"); python3 /tmp/import_policies.py'; then
    log_success "Policies imported successfully!"
else
    log_error "Failed to import policies"
    exit 1
fi

# Cleanup
log_info "Cleaning up temporary files..."
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/policies_import.json /tmp/import_policies.py 2>/dev/null || true

# Final success message
echo ""
log_success "✅ Directus policies import completed!"
log_info "🔐 Roles, policies, access, and permissions have been imported"
log_info ""
log_info "🔄 Note: You may need to log out and log back in to Directus"
log_info "   to see the updated permissions take effect"
echo ""

