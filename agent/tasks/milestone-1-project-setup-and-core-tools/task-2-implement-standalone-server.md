# Task 2: Implement Standalone Server

**Milestone**: [M1 - Project Setup & Core Tools](../../milestones/milestone-1-project-setup-and-core-tools.md)
**Design Reference**: [Requirements](../../design/requirements.md)
**Estimated Time**: 3 hours
**Dependencies**: Task 1 (Bootstrap Project)
**Status**: Not Started

---

## Objective

Implement the standalone MCP server with stdio transport, configuration management, logger, and error handler. This provides the runtime shell that all tools plug into.

---

## Context

The standalone server is the primary entry point for local usage via Claude Code. It handles MCP protocol communication over stdio, validates configuration at startup, and routes tool calls to their handlers. The server follows the mcp-server-starter server-standalone and config-management patterns. Logger must use `console.error` (stderr) to avoid corrupting the JSON-RPC protocol on stdout.

---

## Steps

### 1. Create src/config.ts

Configuration module that loads and validates environment variables. `GOOGLE_CLOUD_PROJECT` is required. `GOOGLE_CLOUD_REGION` and `LOG_LEVEL` are optional with defaults.

```typescript
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gcp: {
    project: process.env.GOOGLE_CLOUD_PROJECT || '',
    region: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
  },
  server: {
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

export function validateConfig(): void {
  if (!config.gcp.project) {
    throw new Error(
      'Missing required environment variable: GOOGLE_CLOUD_PROJECT. ' +
      'Set it in your .env file or environment: export GOOGLE_CLOUD_PROJECT=your-project-id'
    );
  }
}
```

### 2. Create src/utils/logger.ts

Stderr-based JSON logger that respects LOG_LEVEL. All output goes to `console.error` to keep stdout clean for JSON-RPC.

```typescript
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LogLevel = typeof LOG_LEVELS[number];

function shouldLog(messageLevel: LogLevel): boolean {
  const configuredLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;
  const configuredIndex = LOG_LEVELS.indexOf(configuredLevel);
  const messageIndex = LOG_LEVELS.indexOf(messageLevel);
  return messageIndex >= configuredIndex;
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('debug')) {
      console.error(JSON.stringify({
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('info')) {
      console.error(JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (shouldLog('warn')) {
      console.error(JSON.stringify({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta,
      }));
    }
  },
  error: (message: string, error?: unknown) => {
    if (shouldLog('error')) {
      console.error(JSON.stringify({
        level: 'error',
        message,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      }));
    }
  },
};
```

### 3. Create src/utils/error-handler.ts

Centralized error handler that wraps errors in MCP-compliant `McpError` objects. Includes special handling for GCP permission errors to return actionable messages.

```typescript
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger.js';

export interface ErrorContext {
  toolName: string;
  operation: string;
  [key: string]: unknown;
}

export function handleToolError(error: unknown, context: ErrorContext): never {
  logger.error(`${context.toolName} failed: ${context.operation}`, error);

  if (error instanceof McpError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : String(error);

  // Check for GCP permission errors and provide actionable guidance
  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    throw new McpError(
      ErrorCode.InternalError,
      `Permission denied for ${context.operation}. ` +
      `Ensure your account has the required IAM roles. ` +
      `Run the gcloud_whoami tool to check your current identity and permissions. ` +
      `Original error: ${message}`
    );
  }

  if (message.includes('NOT_FOUND') || message.includes('404')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Resource not found during ${context.operation}. ` +
      `Verify the project ID and resource identifiers are correct. ` +
      `Original error: ${message}`
    );
  }

  throw new McpError(
    ErrorCode.InternalError,
    `${context.operation} failed: ${message}`
  );
}
```

### 4. Create src/server.ts

The main server entry point. Initializes configuration, creates the MCP server, registers tool handlers, and connects via stdio transport with graceful shutdown.

```typescript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';

// Tool imports will be added in Tasks 3 and 4

async function initServer(): Promise<Server> {
  logger.info('Initializing gcloud-mcp server...');
  validateConfig();

  const server = new Server(
    { name: 'gcloud-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  registerHandlers(server);
  logger.info('Server initialized', { project: config.gcp.project });
  return server;
}

function registerHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // Tools registered here in Tasks 3 and 4
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        // Tool cases added in Tasks 3 and 4
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      logger.error(`Tool execution failed for ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

function setupShutdownHandlers(server: Server): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    try {
      await server.close();
      logger.info('Server closed');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown error:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  try {
    const server = await initServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Server running on stdio transport');
    setupShutdownHandlers(server);
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
```

### 5. Create src/types/index.ts

Shared type definitions for tool parameters common across all tools.

```typescript
/**
 * Common parameters shared across all gcloud-mcp tools.
 */
export interface CommonToolParams {
  /** GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var. */
  projectId?: string;
}
```

---

## Verification

- [ ] `src/config.ts` exists, exports `config` and `validateConfig()`
- [ ] `validateConfig()` throws with actionable message when `GOOGLE_CLOUD_PROJECT` is missing
- [ ] `src/utils/logger.ts` exists, uses `console.error` for all output
- [ ] Logger respects `LOG_LEVEL` (debug messages hidden when level is info)
- [ ] `src/utils/error-handler.ts` exists, wraps errors in `McpError`
- [ ] Error handler provides actionable messages for PERMISSION_DENIED and NOT_FOUND errors
- [ ] `src/server.ts` exists with shebang, initializes MCP server, connects stdio transport
- [ ] Server handles SIGINT/SIGTERM for graceful shutdown
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] `npm run dev` starts the server (logs appear on stderr)

---

## Expected Output

**File Structure**:
```
src/
├── server.ts           # Standalone server entry point
├── config.ts           # Configuration management
├── types/
│   └── index.ts        # Shared type definitions
└── utils/
    ├── logger.ts       # Stderr JSON logger
    └── error-handler.ts # MCP error wrapper
```

**Key Files Created**:
- `src/server.ts`: MCP server with stdio transport, tool routing, graceful shutdown
- `src/config.ts`: Environment config with validation (GOOGLE_CLOUD_PROJECT required)
- `src/utils/logger.ts`: Structured JSON logger writing to stderr
- `src/utils/error-handler.ts`: Centralized error handler with GCP-specific actionable messages
- `src/types/index.ts`: Common tool parameter types

---

## Common Issues and Solutions

### Issue 1: Server Output Corrupts JSON-RPC
**Symptom**: Claude Desktop or MCP client cannot parse server responses
**Solution**: Ensure all logging uses `console.error` (stderr), never `console.log` (stdout). The stdio transport uses stdout exclusively for JSON-RPC messages.

### Issue 2: Config Validation Fails at Startup
**Symptom**: Server exits immediately with "Missing required environment variable" error
**Solution**: Set `GOOGLE_CLOUD_PROJECT` in your environment or `.env` file before starting the server.

### Issue 3: Import Path Errors
**Symptom**: `ERR_MODULE_NOT_FOUND` at runtime
**Solution**: All imports in TypeScript must use `.js` extensions (e.g., `import { config } from './config.js'`). This is required for ESM resolution.

---

## Resources

- [Server Standalone Pattern](../../patterns/mcp-server-starter.server-standalone.md): Server architecture reference
- [Config Management Pattern](../../patterns/mcp-server-starter.config-management.md): Configuration handling
- [Tool Creation Pattern](../../patterns/mcp-server-starter.tool-creation.md): Tool handler structure
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk): Protocol reference

---

## Notes

- The server.ts file has placeholder comments where tool imports and switch cases will be added in Tasks 3 and 4
- The error handler includes special handling for GCP permission errors -- these return actionable messages telling the user to check IAM roles
- Logger writes to stderr because stdio transport reserves stdout for JSON-RPC
- The `userId` parameter from the mcp-server-starter pattern is not used here since GCP auth uses ADC, not per-user tokens

---

**Next Task**: [Task 3: Implement Cloud Build Tools](task-3-implement-cloud-build-tools.md)
**Related Design Docs**: [Requirements](../../design/requirements.md)
