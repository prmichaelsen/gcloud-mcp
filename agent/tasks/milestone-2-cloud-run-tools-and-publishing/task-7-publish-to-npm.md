# Task 7: Publish to npm

**Milestone**: M2 - Cloud Run Tools and Publishing
**Design Reference**: None
**Estimated Time**: 2 hours
**Dependencies**: Task 5 (Implement Cloud Run Tools), Task 6 (Create Server Factory)
**Status**: Not Started

---

## Objective

Publish the `@prmichaelsen/gcloud-mcp` package to npm with a `bin` entry for `npx` execution, dual exports for standalone and factory usage, and a README with configuration examples for Claude Code and mcp-auth integration.

---

## Context

The package needs to be consumable in three ways: (1) directly via `npx @prmichaelsen/gcloud-mcp` for stdio-based Claude Desktop / Claude Code usage, (2) as a library import of the standalone server, and (3) as a factory import for multi-tenant mcp-auth deployments. The README must document all three usage modes, the available tools, required environment variables, and GCP permissions.

---

## Steps

### 1. Update `package.json` metadata

Ensure all required fields are present for npm publishing:

```json
{
  "name": "@prmichaelsen/gcloud-mcp",
  "version": "0.1.0",
  "description": "MCP server for Google Cloud Run operations",
  "type": "module",
  "main": "dist/server.js",
  "bin": {
    "gcloud-mcp": "dist/server.js"
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
  },
  "files": [
    "dist/**/*.js",
    "dist/**/*.d.ts",
    "dist/**/*.js.map",
    "README.md",
    "LICENSE"
  ],
  "keywords": [
    "mcp",
    "google-cloud",
    "cloud-run",
    "gcloud",
    "model-context-protocol"
  ],
  "author": "prmichaelsen",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/prmichaelsen/gcloud-mcp"
  }
}
```

### 2. Add shebang to `server.ts`

Ensure `src/server.ts` starts with a shebang so the `bin` entry works with `npx`:

```typescript
#!/usr/bin/env node
```

Verify the build preserves this shebang in `dist/server.js`. If using esbuild, add a banner option:

```javascript
// In esbuild.build.js
banner: {
  js: '#!/usr/bin/env node',
},
```

### 3. Write the README

Create a `README.md` at the project root with these sections:

**Installation and usage**:
```bash
npx @prmichaelsen/gcloud-mcp
```

**Claude Code configuration example**:
```json
{
  "mcpServers": {
    "gcloud": {
      "command": "npx",
      "args": ["@prmichaelsen/gcloud-mcp"],
      "env": {
        "GOOGLE_CLOUD_REGION": "us-central1",
        "GOOGLE_CLOUD_PROJECT": "my-project-id"
      }
    }
  }
}
```

**mcp-auth wrapping example**:
```typescript
import { wrapServer, JWTAuthProvider } from '@prmichaelsen/mcp-auth';
import { createServer } from '@prmichaelsen/gcloud-mcp/factory';

const wrapped = wrapServer({
  serverFactory: createServer,
  authProvider: new JWTAuthProvider({
    jwtSecret: process.env.JWT_SECRET!,
  }),
  resourceType: 'gcloud',
  transport: { type: 'sse', port: 3000 },
});

await wrapped.start();
```

**Tool documentation** for each tool:
- `list_services`: parameters, return shape, example
- `get_service_logs`: parameters, return shape, example

**Environment variables**:
- `GOOGLE_CLOUD_REGION`: Default region for Cloud Run operations
- `GOOGLE_CLOUD_PROJECT`: Default GCP project ID

**GCP permissions required**:
- `roles/run.viewer` for listing services
- `roles/logging.viewer` for reading logs

**Authentication**:
- Uses Application Default Credentials (ADC)
- Run `gcloud auth application-default login` for local development

### 4. Create LICENSE file

Add an MIT license file at project root.

### 5. Verify build output

```bash
npm run build
```

Confirm the `dist/` directory contains:
- `server.js` (with shebang)
- `server.d.ts`
- `server-factory.js`
- `server-factory.d.ts`
- Tool files under `dist/tools/`
- Utility files under `dist/utils/`

### 6. Test npx execution locally

```bash
# Test that the bin entry works
node dist/server.js --help 2>/dev/null || node dist/server.js
```

### 7. Dry-run publish

```bash
npm pack --dry-run
```

Review the output to confirm only intended files are included. Check that `dist/`, `README.md`, and `LICENSE` are present. Ensure no source files, tests, or `node_modules` are included.

### 8. Publish to npm

```bash
npm publish --access public
```

### 9. Verify published package

```bash
# Test installation from npm
npx @prmichaelsen/gcloud-mcp --help

# Test factory import
node -e "import('@prmichaelsen/gcloud-mcp/factory').then(m => console.log(typeof m.createServer))"
```

---

## Verification

- [ ] `package.json` has correct `name`, `version`, `description`, `keywords`, `author`, `license`
- [ ] `package.json` has `bin` entry pointing to `dist/server.js`
- [ ] `package.json` has `exports` with `.` and `./factory` subpaths
- [ ] `package.json` has `files` field limiting published content
- [ ] `dist/server.js` starts with `#!/usr/bin/env node`
- [ ] `README.md` includes Claude Code config example
- [ ] `README.md` includes mcp-auth wrapping example
- [ ] `README.md` documents both tools with parameters and examples
- [ ] `README.md` documents required environment variables
- [ ] `README.md` documents required GCP permissions
- [ ] `LICENSE` file exists
- [ ] `npm pack --dry-run` shows only expected files
- [ ] `npm publish --access public` succeeds
- [ ] `npx @prmichaelsen/gcloud-mcp` executes successfully
- [ ] `import { createServer } from '@prmichaelsen/gcloud-mcp/factory'` resolves correctly

---

## Expected Output

**File Structure**:
```
project-root/
├── README.md
├── LICENSE
├── package.json          (updated)
├── src/
│   └── server.ts         (shebang added)
└── dist/
    ├── server.js          (with shebang)
    ├── server.d.ts
    ├── server-factory.js
    ├── server-factory.d.ts
    ├── tools/
    │   ├── list-services.js
    │   ├── list-services.d.ts
    │   ├── get-service-logs.js
    │   └── get-service-logs.d.ts
    └── utils/
        ├── parse-duration.js
        └── parse-duration.d.ts
```

**Key Files Created**:
- `README.md`: Usage documentation with config examples and tool reference
- `LICENSE`: MIT license

**Key Files Modified**:
- `package.json`: Added bin, exports, files, keywords, repository fields
- `src/server.ts`: Added shebang line

**Published Artifact**:
- `@prmichaelsen/gcloud-mcp@0.1.0` on npm registry

---

## Common Issues and Solutions

### Issue 1: Shebang stripped by bundler
**Symptom**: `npx @prmichaelsen/gcloud-mcp` fails with "not found" or permission error
**Solution**: Configure esbuild with `banner: { js: '#!/usr/bin/env node' }`. Also ensure the built file has execute permissions: `chmod +x dist/server.js`.

### Issue 2: Subpath export not resolving
**Symptom**: `Cannot find module '@prmichaelsen/gcloud-mcp/factory'`
**Solution**: Ensure `exports` in `package.json` matches actual file paths in `dist/`. The `types` field must point to `.d.ts` files.

### Issue 3: npm publish scope error
**Symptom**: `npm ERR! 402 Payment Required` for scoped package
**Solution**: Use `npm publish --access public` for public scoped packages.

### Issue 4: Missing files in published package
**Symptom**: Imports fail after install from npm
**Solution**: Check the `files` field in `package.json`. Run `npm pack --dry-run` to verify included files before publishing.

---

## Resources

- [npm publish docs](https://docs.npmjs.com/cli/v10/commands/npm-publish): Publishing reference
- [Node.js package exports](https://nodejs.org/api/packages.html#exports): Subpath exports
- [npm bin](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#bin): Executable entry points
- [esbuild banner](https://esbuild.github.io/api/#banner): Adding shebang in builds

---

## Notes

- Always use `--access public` when publishing scoped packages for the first time
- The `files` field is a whitelist -- only listed paths are included in the tarball
- Run `npm pack --dry-run` before every publish to catch inclusion issues
- Version bumps after initial publish should follow semver
- The README is the primary documentation surface for npm package consumers

---

**Next Task**: None (final task in Milestone 2)
**Related Design Docs**: [Server Factory Pattern](../../patterns/mcp-server-starter.server-factory.md)
**Estimated Completion Date**: TBD
