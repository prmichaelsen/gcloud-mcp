# Task 1: Bootstrap Project

**Milestone**: [M1 - Project Setup & Core Tools](../../milestones/milestone-1-project-setup-and-core-tools.md)
**Design Reference**: [Requirements](../../design/requirements.md)
**Estimated Time**: 2 hours
**Dependencies**: None
**Status**: Not Started

---

## Objective

Create the project structure with all necessary configuration files, dependencies, build system, and directory organization for a TypeScript-based MCP server targeting Google Cloud APIs.

---

## Context

This task establishes the foundation for the gcloud-mcp server. Without proper structure and configuration, subsequent tasks (standalone server, tools) cannot proceed. The structure follows mcp-server-starter patterns: bootstrap, build-config, and config-management.

---

## Steps

### 1. Initialize npm Project

```bash
npm init -y
npm pkg set name="@prmichaelsen/gcloud-mcp"
npm pkg set version="0.1.0"
npm pkg set description="Google Cloud MCP server for Cloud Build and Cloud Run"
npm pkg set type="module"
npm pkg set main="dist/server.js"
npm pkg set license="MIT"
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @modelcontextprotocol/sdk@^1.0.4 dotenv @google-cloud/cloudbuild @google-cloud/logging

# Dev dependencies
npm install -D typescript@^5.3.3 esbuild@^0.20.0 tsx@^4.7.1 @types/node@^20.11.19
```

### 3. Configure package.json Scripts and Exports

Update `package.json` with scripts, exports, and bin:

```json
{
  "scripts": {
    "build": "node esbuild.build.js",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run clean && npm run build"
  },
  "bin": {
    "gcloud-mcp": "./dist/server.js"
  },
  "exports": {
    ".": {
      "types": "./dist/server.d.ts",
      "import": "./dist/server.js"
    },
    "./factory": {
      "types": "./dist/server-factory.d.ts",
      "import": "./dist/server-factory.js"
    }
  }
}
```

### 4. Create Directory Structure

```bash
mkdir -p src/tools src/utils src/types
mkdir -p dist tests
```

### 5. Create tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 6. Create esbuild.build.js

Follow the build-config pattern. Bundle for Node.js 20+ with ESM output. Externalize `@modelcontextprotocol/sdk` and GCP client libraries:

```javascript
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';

await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: [
    '@modelcontextprotocol/sdk',
    '@google-cloud/cloudbuild',
    '@google-cloud/logging',
    'dotenv',
  ],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);"
  },
});

console.log('Built server.js');

// Generate TypeScript declarations
try {
  execSync('tsc --emitDeclarationOnly --outDir dist', { stdio: 'inherit' });
  console.log('Generated TypeScript declarations');
} catch (error) {
  console.error('Failed to generate TypeScript declarations');
  process.exit(1);
}

console.log('Build complete');
```

### 7. Create .env.example

```bash
# GCP Configuration (required)
GOOGLE_CLOUD_PROJECT=your-project-id

# GCP Configuration (optional)
GOOGLE_CLOUD_REGION=us-central1

# Server Configuration
LOG_LEVEL=info
NODE_ENV=development
```

### 8. Create .gitignore

```gitignore
node_modules/
dist/
*.js
*.d.ts
*.js.map
!esbuild.build.js
.env
.env.local
.DS_Store
*.log
npm-debug.log*
coverage/
```

### 9. Create Placeholder Source Files

Create empty placeholder files so the build system can be validated:

**src/types/index.ts**:
```typescript
// Type definitions for gcloud-mcp
export {};
```

**src/server.ts** (minimal placeholder):
```typescript
#!/usr/bin/env node
console.error('gcloud-mcp server placeholder');
```

---

## Verification

- [ ] `package.json` exists with correct name, version, type "module", scripts, exports, and bin
- [ ] `tsconfig.json` exists and is valid (target ES2022, strict, declaration enabled)
- [ ] `esbuild.build.js` exists with correct entry points and externals
- [ ] `.env.example` contains GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_REGION, LOG_LEVEL
- [ ] `.gitignore` excludes node_modules, dist, .env
- [ ] Directory structure exists: `src/tools/`, `src/utils/`, `src/types/`
- [ ] `npm install` completes without errors
- [ ] `npm run typecheck` passes (with placeholder files)
- [ ] All required dependencies installed: `@modelcontextprotocol/sdk`, `@google-cloud/cloudbuild`, `@google-cloud/logging`, `dotenv`

---

## Expected Output

**File Structure**:
```
gcloud-mcp/
├── package.json
├── package-lock.json
├── tsconfig.json
├── esbuild.build.js
├── .env.example
├── .gitignore
├── node_modules/
├── src/
│   ├── server.ts          (placeholder)
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   └── tools/
└── dist/                  (empty, generated by build)
```

**Key Files Created**:
- `package.json`: Project manifest with ESM config, scripts, GCP dependencies
- `tsconfig.json`: TypeScript configuration for ES2022 + strict mode
- `esbuild.build.js`: Build script for bundling server
- `.env.example`: Environment variable template
- `.gitignore`: Git ignore rules

---

## Common Issues and Solutions

### Issue 1: ESM Import Errors
**Symptom**: `Cannot find module` or `ERR_MODULE_NOT_FOUND` at runtime
**Solution**: Ensure `"type": "module"` is set in package.json. Use `.js` extensions in all TypeScript imports (e.g., `import { config } from './config.js'`).

### Issue 2: GCP Client Library Version Conflicts
**Symptom**: TypeScript errors or peer dependency warnings during install
**Solution**: Check that `@google-cloud/cloudbuild` and `@google-cloud/logging` versions are compatible with Node.js 20. Use `npm ls` to inspect the dependency tree.

---

## Resources

- [Bootstrap Pattern](../../patterns/mcp-server-starter.bootstrap.md): Project initialization reference
- [Build Config Pattern](../../patterns/mcp-server-starter.build-config.md): esbuild configuration reference
- [Config Management Pattern](../../patterns/mcp-server-starter.config-management.md): Environment variable handling
- [esbuild Documentation](https://esbuild.github.io/): Build tool documentation

---

## Notes

- This task creates the foundation for all subsequent Milestone 1 work
- GCP client libraries use ADC (Application Default Credentials) -- no key management needed in the server
- The `@google-cloud/run` dependency is deferred to Milestone 2 (Cloud Run tools)
- Keep `.env` files out of version control

---

**Next Task**: [Task 2: Implement Standalone Server](task-2-implement-standalone-server.md)
**Related Design Docs**: [Requirements](../../design/requirements.md)
