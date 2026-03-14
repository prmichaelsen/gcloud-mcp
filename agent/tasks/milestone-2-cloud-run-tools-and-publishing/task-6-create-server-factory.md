# Task 6: Create Server Factory

**Milestone**: M2 - Cloud Run Tools and Publishing
**Design Reference**: [Server Factory Pattern](../../patterns/mcp-server-starter.server-factory.md)
**Estimated Time**: 2 hours
**Dependencies**: Task 5 (Implement Cloud Run Tools)
**Status**: Not Started

---

## Objective

Create `src/server-factory.ts` that exports a `createServer(accessToken, userId, options)` factory function compatible with `@prmichaelsen/mcp-auth` `wrapServer()`. This enables multi-tenant deployment where each user gets an isolated MCP server instance.

---

## Context

The server factory pattern separates server creation from transport binding, enabling the same tools to work in both standalone (stdio/Claude Desktop) and multi-tenant (HTTP/SSE via mcp-auth) modes. The factory initializes GCP clients once globally, creates per-user server instances with no shared state, and scopes all tool operations to the provided `userId`. This task also sets up dual exports in `package.json` so consumers can import either the standalone server or the factory.

---

## Steps

### 1. Create `src/server-factory.ts`

Follow the server-factory pattern from `mcp-server-starter.server-factory.md`.

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';

// Import tools
import { listServicesTool, handleListServices } from './tools/list-services.js';
import { getServiceLogsTool, handleGetServiceLogs } from './tools/get-service-logs.js';

export interface ServerOptions {
  name?: string;
  version?: string;
}

// Global GCP client initialization (once per process)
let gcpClientsInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function ensureGcpClientsInitialized(): Promise<void> {
  if (gcpClientsInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      logger.info('Initializing GCP clients...');
      // GCP client libraries initialize lazily on first call,
      // but we validate ADC availability here.
      gcpClientsInitialized = true;
      logger.info('GCP clients initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('GCP client initialization failed', { error: msg });
      throw new Error(`GCP client initialization failed: ${msg}`);
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Create a server instance for a specific user/tenant.
 *
 * Compatible with @prmichaelsen/mcp-auth wrapServer().
 *
 * @param accessToken - User's access token (from mcp-auth)
 * @param userId - User identifier for scoping operations
 * @param options - Optional server configuration
 * @returns Configured MCP Server instance (not connected to transport)
 */
export async function createServer(
  accessToken: string,
  userId: string,
  options: ServerOptions = {}
): Promise<Server> {
  if (!userId) {
    throw new Error('userId is required');
  }

  await ensureGcpClientsInitialized();

  const server = new Server(
    {
      name: options.name || 'gcloud-mcp',
      version: options.version || '0.1.0',
    },
    {
      capabilities: { tools: {} },
    }
  );

  registerHandlers(server, userId, accessToken);
  return server;
}

function registerHandlers(
  server: Server,
  userId: string,
  accessToken: string
): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [listServicesTool, getServiceLogsTool],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'list_services':
          result = await handleListServices(args as any, userId);
          break;
        case 'get_service_logs':
          result = await handleGetServiceLogs(args as any, userId);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      if (error instanceof McpError) throw error;
      logger.error(`Tool execution failed for ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
```

### 2. Update `package.json` with dual exports

Add the `exports` field so the package can be imported as either standalone or factory.

```json
{
  "main": "dist/server.js",
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

### 3. Verify standalone `src/server.ts` still works

Ensure the existing `server.ts` (stdio transport, single-user mode) continues to function independently. It should use a hardcoded `default_user` userId and not depend on `server-factory.ts`.

### 4. Write unit tests

Create `src/server-factory.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createServer } from './server-factory.js';

describe('Server Factory', () => {
  it('should create server instance with valid parameters', async () => {
    const server = await createServer('test-token', 'user123');
    expect(server).toBeDefined();
  });

  it('should require userId', async () => {
    await expect(createServer('token', '')).rejects.toThrow('userId is required');
  });

  it('should create separate instances for different users', async () => {
    const server1 = await createServer('token1', 'user1');
    const server2 = await createServer('token2', 'user2');
    expect(server1).not.toBe(server2);
  });

  it('should accept custom options', async () => {
    const server = await createServer('token', 'user123', {
      name: 'custom-name',
      version: '2.0.0',
    });
    expect(server).toBeDefined();
  });
});
```

### 5. Verify mcp-auth compatibility

The factory signature must match what `wrapServer()` expects:

```typescript
// This must work:
import { wrapServer } from '@prmichaelsen/mcp-auth';
import { createServer } from '@prmichaelsen/gcloud-mcp/factory';

const wrapped = wrapServer({
  serverFactory: createServer,
  authProvider: new JWTAuthProvider({ jwtSecret: process.env.JWT_SECRET! }),
  resourceType: 'gcloud',
  transport: { type: 'sse', port: 3000 },
});
```

---

## Verification

- [ ] `src/server-factory.ts` exists and exports `createServer` function
- [ ] `createServer` signature is `(accessToken: string, userId: string, options?: ServerOptions) => Promise<Server>`
- [ ] GCP clients are initialized once globally (not per user)
- [ ] No shared state between server instances
- [ ] All tool handlers receive `userId` parameter
- [ ] `package.json` has dual exports (`.` and `./factory`)
- [ ] Standalone `server.ts` still works via stdio
- [ ] Factory is compatible with `@prmichaelsen/mcp-auth` `wrapServer()`
- [ ] Unit tests pass
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` succeeds

---

## Expected Output

**File Structure**:
```
src/
├── server.ts              (standalone, unchanged)
├── server-factory.ts      (new)
└── server-factory.spec.ts (new)
```

**Key Files Created**:
- `src/server-factory.ts`: Factory function with global GCP init, per-user server creation, tool registration
- `src/server-factory.spec.ts`: Unit tests for factory function

**Key Files Modified**:
- `package.json`: Added `exports` field with dual export paths

---

## Common Issues and Solutions

### Issue 1: Import resolution for `./factory` subpath
**Symptom**: `Cannot find module '@prmichaelsen/gcloud-mcp/factory'`
**Solution**: Ensure `package.json` `exports` field uses correct paths and that `dist/server-factory.js` and `dist/server-factory.d.ts` are generated by the build.

### Issue 2: Circular dependency between server.ts and server-factory.ts
**Symptom**: Runtime errors or undefined imports
**Solution**: Both files should import tools independently. Do not import server-factory from server.ts or vice versa. They are parallel entry points.

### Issue 3: GCP initialization race condition
**Symptom**: Multiple simultaneous `createServer` calls cause duplicate initialization
**Solution**: The `initializationPromise` pattern handles this -- concurrent calls await the same promise.

---

## Resources

- [Server Factory Pattern](../../patterns/mcp-server-starter.server-factory.md): Reference pattern
- [Node.js package exports](https://nodejs.org/api/packages.html#exports): Subpath exports documentation
- [@prmichaelsen/mcp-auth](https://www.npmjs.com/package/@prmichaelsen/mcp-auth): Auth wrapper library

---

## Notes

- GCP auth uses ADC (Application Default Credentials), which is separate from the mcp-auth JWT
- The `accessToken` parameter from mcp-auth is not used for GCP API calls -- GCP uses its own credentials
- The factory does not manage transport -- the caller (or mcp-auth) handles that
- Keep server.ts and server-factory.ts as independent entry points with no cross-imports

---

**Next Task**: [task-7-publish-to-npm.md](task-7-publish-to-npm.md)
**Related Design Docs**: [Server Factory Pattern](../../patterns/mcp-server-starter.server-factory.md)
**Estimated Completion Date**: TBD
