# Schema Single Source of Truth - Implementation Guide

## 🎯 Recommended Solution: OpenAPI Type Generation

Since you already have OpenAPI/Swagger configured, use it as your single source of truth and generate TypeScript types for the frontend.

---

## 📋 Implementation Steps

### 1. Install Type Generation Tool

```bash
# In frontend directory
cd frontend
npm install --save-dev openapi-typescript
```

### 2. Add Type Generation Script

**`frontend/package.json`:**
```json
{
  "scripts": {
    "generate:types": "openapi-typescript ../backend/orchestration-api/openapi.json -o ./src/types/api.generated.ts",
    "dev": "npm run generate:types && astro dev",
    "build": "npm run generate:types && astro check && astro build"
  }
}
```

### 3. Create Generated Types Directory

```bash
mkdir -p frontend/src/types
touch frontend/src/types/.gitkeep
```

### 4. Update `.gitignore`

**`frontend/.gitignore`:**
```
# Generated types
src/types/api.generated.ts
```

### 5. Generate Types

```bash
cd frontend
npm run generate:types
```

This creates `frontend/src/types/api.generated.ts` with all your API types!

---

## 🔧 Usage in Frontend

### Before (Manual Types):
```typescript
// frontend/src/components/ValidationStatusPoller/types.ts
export interface ValidationData {
  validationResult: {
    present_fields: string[];
    missing_fields: string[];
    confidence: number;
    extracted_data?: ExtractedDataRecord[];
  };
}
```

### After (Generated Types):
```typescript
// frontend/src/components/ValidationStatusPoller/types.ts
import type { components } from '@/types/api.generated';

// Extract types from OpenAPI schema
export type ValidationResult = components['schemas']['ValidationResult'];
export type ExtractedDataRecord = components['schemas']['ExtractedData'];
export type WasteOriginator = components['schemas']['WasteOriginator'];
export type WasteRecipient = components['schemas']['WasteRecipient'];
export type WasteRecord = components['schemas']['WasteRecord'];

// Your custom types built on top
export interface ValidationData {
  validationResult: ValidationResult;
  directusSourceDocumentId?: string;
  status?: string;
}
```

---

## 🎨 Complete Example

### Backend Schema Definition (Single Source)

**`backend/orchestration-api/src/llmResponseSchema.ts`:**
```typescript
export interface WasteRecord {
  serial_number: number;
  date: string;
  waste_amount_generated: number | null;
  waste_amount_transferred?: number | null;
}

export interface ExtractedWasteData {
  waste_code: string;
  waste_name: string;
  waste_category: string | null;
  handling_code: string | null;
  originator: WasteOriginator;
  recipient: WasteRecipient;
  records: WasteRecord[];
}

export interface LLMResponseSchema {
  present_fields: string[];
  missing_fields: string[];
  confidence: number;
  extracted_data: ExtractedWasteData[];
}
```

### Swagger Definition

**`backend/orchestration-api/src/lib/swagger.ts`:**
```typescript
// Already updated to match your schema
WasteRecord: {
  type: "object",
  properties: {
    serial_number: { type: "number" },
    date: { type: "string" },
    waste_amount_generated: { type: "number", nullable: true },
    waste_amount_transferred: { type: "number", nullable: true }
  }
}
```

### Generated OpenAPI JSON

Run backend build to generate `openapi.json`:
```bash
cd backend/orchestration-api
npm run build  # Generates openapi.json
```

### Frontend Uses Generated Types

**`frontend/src/components/ValidationResults.tsx`:**
```typescript
import type { components } from '@/types/api.generated';

type ValidationResult = components['schemas']['ValidationResult'];

interface ValidationResultsProps {
  validationResult: ValidationResult;
}

export function ValidationResults({ validationResult }: ValidationResultsProps) {
  const { present_fields, missing_fields, confidence } = validationResult;
  // TypeScript knows all fields and their types automatically!
}
```

---

## 🔄 Automated Workflow

### Development Workflow

1. **Change backend types** → `llmResponseSchema.ts`
2. **Rebuild backend** → Regenerates `openapi.json`
3. **Generate frontend types** → Auto-generated on `npm run dev`
4. **TypeScript errors** → If API changed, TypeScript will catch mismatches!

### CI/CD Pipeline

**`.github/workflows/build.yml`:**
```yaml
jobs:
  build:
    steps:
      # Build backend (generates openapi.json)
      - name: Build Backend
        run: |
          cd backend/orchestration-api
          npm ci
          npm run build
      
      # Generate frontend types from OpenAPI
      - name: Generate Frontend Types
        run: |
          cd frontend
          npm ci
          npm run generate:types
      
      # Build frontend (types are now available)
      - name: Build Frontend
        run: |
          cd frontend
          npm run build
```

---

## 🎁 Benefits

### ✅ Pros
- **Single source of truth** - Backend types define everything
- **Type safety** - Frontend knows exact API structure
- **Auto-completion** - Full IDE support
- **Catches breaking changes** - TypeScript errors if API changes
- **No duplication** - Types generated automatically
- **Already integrated** - Uses your existing OpenAPI setup

### ⚠️ Cons
- **Build step required** - Must regenerate types after backend changes
- **Git considerations** - Generated files in gitignore (or commit them?)

---

## 📦 Alternative Solutions

### Option 2: Shared Types Package (More Complex)

Create a separate NPM package for shared types:

```
office_automations/
├── packages/
│   └── shared-types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── schemas.ts
├── backend/
│   └── orchestration-api/
│       └── package.json  (depends on @office/shared-types)
└── frontend/
    └── package.json  (depends on @office/shared-types)
```

**Pros:** True single source, no generation needed  
**Cons:** More complex setup, need monorepo tooling (Nx, Turborepo, pnpm workspaces)

### Option 3: Zod Schema (Runtime + Types)

Use Zod for runtime validation + type inference:

**`packages/shared-types/src/schemas.ts`:**
```typescript
import { z } from 'zod';

export const WasteRecordSchema = z.object({
  serial_number: z.number(),
  date: z.string(),
  waste_amount_generated: z.number().nullable(),
  waste_amount_transferred: z.number().nullable().optional(),
});

export const LLMResponseSchema = z.object({
  present_fields: z.array(z.string()),
  missing_fields: z.array(z.string()),
  confidence: z.number(),
  extracted_data: z.array(ExtractedWasteDataSchema),
});

// Get TypeScript types from Zod schemas
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type WasteRecord = z.infer<typeof WasteRecordSchema>;
```

**Pros:** Runtime validation, type inference, single source  
**Cons:** Requires refactoring existing code, adds dependency

### Option 4: tRPC (Full Type Safety)

Replace REST API with tRPC for end-to-end type safety:

**Pros:** Automatic type inference, no code generation  
**Cons:** Major refactor, changes API architecture

---

## 🎯 Recommended Implementation Plan

### Phase 1: Quick Win (Immediate)
1. ✅ Install `openapi-typescript` in frontend
2. ✅ Add generation script to `package.json`
3. ✅ Generate types from existing `openapi.json`
4. ✅ Replace manual types with generated ones
5. ✅ Test that everything works

### Phase 2: Automation (Next Sprint)
1. Add pre-build hooks to auto-generate types
2. Add CI/CD pipeline step
3. Document process for team
4. Add type checking to PR checks

### Phase 3: Future Enhancement (Optional)
- Consider Zod for runtime validation
- Consider monorepo if project grows
- Consider tRPC if REST API becomes complex

---

## 📝 Quick Start Commands

```bash
# 1. Install tool
cd frontend
npm install --save-dev openapi-typescript

# 2. Generate types (one-time setup)
npx openapi-typescript ../backend/orchestration-api/openapi.json -o ./src/types/api.generated.ts

# 3. Use in your code
# Import from '@/types/api.generated'

# 4. Add to package.json scripts
# "generate:types": "openapi-typescript ../backend/orchestration-api/openapi.json -o ./src/types/api.generated.ts"

# 5. Regenerate when backend changes
npm run generate:types
```

---

## 🎓 Best Practices

### 1. **Commit Generated Files?**
- **Option A:** Commit to git (easier for team, CI/CD)
- **Option B:** Generate on build (cleaner, requires everyone to run command)

**Recommendation:** Commit generated files for this project size.

### 2. **Type Exports**
Create a barrel export for clean imports:

**`frontend/src/types/index.ts`:**
```typescript
export type { components, paths } from './api.generated';

// Re-export commonly used types
export type ValidationResult = components['schemas']['ValidationResult'];
export type ExtractedData = components['schemas']['ExtractedData'];
export type WasteRecord = components['schemas']['WasteRecord'];
```

### 3. **Documentation**
Add comments to backend schema - they appear in generated types!

```typescript
/**
 * Waste record with serial number, date, and quantities
 * @example { serial_number: 1, date: "16.01.2025", waste_amount_generated: 2.05 }
 */
export interface WasteRecord {
  serial_number: number;
  // ... rest
}
```

---

## 🚀 Summary

**For your project, I recommend:**
1. **Use OpenAPI type generation** (you already have the infrastructure)
2. **Start with manual generation** (add to scripts)
3. **Automate later** (add to CI/CD when comfortable)
4. **Consider Zod in future** (if you need runtime validation)

This gives you:
- ✅ Single source of truth (backend types)
- ✅ Type safety across frontend/backend
- ✅ No code duplication
- ✅ Minimal setup time
- ✅ Leverages existing infrastructure

---

## 📚 Resources

- [openapi-typescript](https://github.com/drwpow/openapi-typescript)
- [OpenAPI TypeScript Guide](https://openapi-ts.pages.dev/)
- [Zod Documentation](https://zod.dev/)
- [tRPC Documentation](https://trpc.io/)

