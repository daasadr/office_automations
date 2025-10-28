#!/usr/bin/env tsx
/**
 * Script to generate static OpenAPI spec file
 * Usage: npm run generate-openapi
 */

import fs from "fs";
import path from "path";
import { swaggerSpec } from "../src/lib/swagger";

const outputPath = path.join(__dirname, "..", "openapi.json");

try {
  // Generate formatted JSON
  const json = JSON.stringify(swaggerSpec, null, 2);

  // Write to file
  fs.writeFileSync(outputPath, json, "utf8");

  console.log(`✅ OpenAPI spec generated successfully at: ${outputPath}`);
  console.log(`📄 Total endpoints: ${Object.keys(swaggerSpec.paths || {}).length}`);
} catch (error) {
  console.error("❌ Failed to generate OpenAPI spec:", error);
  process.exit(1);
}
