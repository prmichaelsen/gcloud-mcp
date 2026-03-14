# MCP Server Architecture

**Concept**: Dual-export TypeScript MCP server architecture supporting both standalone execution and multi-tenant production deployment

**Created**: 2026-02-22
**Status**: Design Specification

---

## Overview

The mcp-server-starter architecture implements a flexible, production-ready MCP server design that supports two distinct deployment modes through a dual export pattern. This architecture enables developers to build MCP servers that work seamlessly in both development (Claude Desktop) and production (mcp-auth multi-tenant) environments without code duplication.

The architecture is built on three core principles:
1. **Separation of Concerns**: Clear boundaries between server initialization, tool logic, and configuration
2. **Code Reusability**: Shared tool implementations across both deployment modes
3. **Type Safety**: Full TypeScript support with strict typing throughout

---

## Problem Statement

MCP servers need to support multiple deployment scenarios:

1. **Development/Testing**: Direct execution with stdio transport for Claude Desktop
2. **Production**: Multi-tenant deployment with user isolation via mcp-auth
3. **Library Usage**: Importable as a module for custom integrations

Traditional single-entry-point architectures force developers to choose one deployment mode or maintain separate codebases. This leads to:
- Code duplication between standalone and multi-tenant versions
- Inconsistent behavior across deployment modes
- Difficult testing and maintenance
- Poor developer experience

**Key Challenge**: How to support both standalone execution and factory-based instantiation while sharing tool implementations and maintaining type safety?

---

## Solution

The dual export pattern solves this by providing two entry points from a single codebase:

### 1. Standalone Server (`src/server.ts`)
- Direct execution via stdio transport
- Single-user mode with default userId
- Used with Claude Desktop or standalone testing
- Executable via `node dist/server.js`

### 2. Server Factory (`src/server-factory.ts`)
- Factory function that creates server instances
- Multi-tenant with per-user isolation
- Used with mcp-auth for production
- Importable via `import { createServer } from 'package/factory'`

### 3. Shared Components
- Tool definitions and handlers
- Configuration management
- Utility functions
- Type definitions

Both entry points use the same tool implementations, ensuring consistent behavior across deployment modes.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server Package                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entry Points:                                                  │
│  ┌──────────────────────┐      ┌──────────────────────┐       │
│  │   src/server.ts      │      │ src/server-factory.ts│       │
│  │   (Standalone)       │      │   (Multi-tenant)     │       │
│  │                      │      │                      │       │
│  │  • stdio transport   │      │  • Factory function  │       │
│  │  • Default userId    │      │  • User isolation    │       │
│  │  • Direct execution  │      │  • Global init       │       │
│  └──────────┬───────────┘      └──────────┬───────────┘       │
│             │                             │                    │
│             └──────────┬──────────────────┘                    │
│                        │                                       │
│                        ▼                                       │
│              ┌─────────────────────┐                          │
│              │    Tools Layer      │                          │
│              │                     │                          │
│              │  • Tool definitions │                          │
│              │  • Handler functions│                          │
│              │  • Business logic   │                          │
│              │  • Type interfaces  │                          │
│              └──────────┬──────────┘                          │
│                         │                                      │
│                         ▼                                      │
│              ┌─────────────────────┐                          │
│              │   Config Layer      │                          │
│              │                     │                          │
│              │  • Env validation   │                          │
│              │  • Type-safe config │                          │
│              │  • Defaults         │                          │
│              └──────────┬──────────┘                          │
│                         │                                      │
│                         ▼                                      │
│              ┌─────────────────────┐                          │
│              │   Utils Layer       │                          │
│              │                     │                          │
│              │  • Error handling   │                          │
│              │  • Logging          │                          │
│              │  • Helpers          │                          │
│              └─────────────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

External Integrations:
┌──────────────────┐         ┌──────────────────┐
│  Claude Desktop  │────────▶│   server.js      │
│  (Development)   │         │   (Standalone)   │
└──────────────────┘         └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│    mcp-auth      │────────▶│ server-factory.js│
│  (Production)    │         │  (Multi-tenant)  │
└──────────────────┘         └──────────────────┘
```

---

## Components

### 1. Standalone Server (`src/server.ts`)

**Responsibility**: Provide direct execution entry point for development and testing.

**Key Features**:
- Creates MCP Server instance with stdio transport
- Registers all tools
- Handles tool execution with default userId
- Manages server lifecycle (startup, shutdown)
- Executable via shebang (`#!/usr/bin/env node`)

**Usage**:
```bash
node dist/server.js
# or
npm run dev
```

**Code Structure**:
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function main() {
  const server = new Server({ name: 'my-server', version: '1.0.0' }, { capabilities: { tools: {} } });
  
  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => { /* route to handlers */ });
  
  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
```

### 2. Server Factory (`src/server-factory.ts`)

**Responsibility**: Provide factory function for multi-tenant production deployment.

**Key Features**:
- Exports `createServer(userId)` function
- Creates isolated server instance per user
- Supports global initialization (databases, caches)
- Passes userId to all tool handlers
- Compatible with mcp-auth

**Usage**:
```typescript
import { createServer } from '@username/my-mcp-server/factory';

const server = await createServer('user-123');
```

**Code Structure**:
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Global initialization (once per process)
let globalState: GlobalState | null = null;

async function initGlobal() {
  if (!globalState) {
    globalState = {
      database: await connectDatabase(),
      cache: new Cache(),
    };
  }
  return globalState;
}

export async function createServer(userId: string): Promise<Server> {
  await initGlobal();
  
  const server = new Server({ name: 'my-server', version: '1.0.0' }, { capabilities: { tools: {} } });
  
  // Register tools with userId scoping
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [...] }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Pass userId to handlers for isolation
    return await handleTool(request.params.name, request.params.arguments, userId);
  });
  
  return server;
}
```

### 3. Tools Layer (`src/tools/`)

**Responsibility**: Implement MCP tool definitions and business logic.

**Key Features**:
- Tool schema definitions (name, description, inputSchema)
- Handler functions with userId parameter
- Type-safe argument and result interfaces
- Shared across both entry points

**Structure**:
```typescript
// src/tools/example-tool.ts
export const exampleTool: Tool = {
  name: 'example_tool',
  description: 'Does something useful',
  inputSchema: { /* JSON Schema */ },
};

export interface ExampleArgs {
  param1: string;
  param2?: number;
}

export interface ExampleResult {
  data: any[];
  count: number;
}

export async function handleExample(
  args: ExampleArgs,
  userId: string
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  // User-scoped business logic
  const userData = await getUserData(userId);
  const result: ExampleResult = { /* ... */ };
  
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  };
}
```

### 4. Config Layer (`src/config.ts`)

**Responsibility**: Manage environment variables and configuration.

**Key Features**:
- Type-safe configuration interface
- Environment variable validation
- Sensible defaults
- Single source of truth

**Structure**:
```typescript
import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  logLevel: string;
  databaseUrl?: string;
  apiKey?: string;
}

function validateConfig(): Config {
  return {
    logLevel: process.env.LOG_LEVEL || 'info',
    databaseUrl: process.env.DATABASE_URL,
    apiKey: process.env.API_KEY,
  };
}

export const config = validateConfig();
```

### 5. Utils Layer (`src/utils/`)

**Responsibility**: Provide shared utility functions.

**Key Features**:
- Error handling helpers
- Logging utilities
- Common functions
- Type definitions

---

## Dual Export Pattern

### package.json Configuration

```json
{
  "type": "module",
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
  },
  "bin": {
    "my-mcp-server": "./dist/server.js"
  }
}
```

### Import Patterns

**Standalone** (default export):
```typescript
// Executed directly, not imported
node dist/server.js
```

**Factory** (named export):
```typescript
import { createServer } from '@username/my-mcp-server/factory';
const server = await createServer('user-123');
```

### Build Configuration

Both entry points are built separately:

```javascript
// esbuild.build.js
await esbuild.build({
  entryPoints: ['src/server.ts', 'src/server-factory.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
});
```

---

## Component Relationships

### Data Flow: Standalone Mode

```
User Input (Claude Desktop)
    ↓
stdio transport
    ↓
server.ts (MCP Server)
    ↓
Tool Router (CallToolRequestSchema handler)
    ↓
Tool Handler (with default userId)
    ↓
Business Logic
    ↓
Result (JSON)
    ↓
stdio transport
    ↓
User Output (Claude Desktop)
```

### Data Flow: Multi-tenant Mode

```
User Request (via mcp-auth)
    ↓
mcp-auth (extracts userId)
    ↓
createServer(userId)
    ↓
server-factory.ts (creates isolated Server)
    ↓
Tool Router (CallToolRequestSchema handler)
    ↓
Tool Handler (with user-specific userId)
    ↓
Business Logic (user-scoped)
    ↓
Result (JSON)
    ↓
mcp-auth
    ↓
User Response
```

### Shared Code Flow

```
┌─────────────┐     ┌──────────────────┐
│  server.ts  │────▶│  Tool Handlers   │
└─────────────┘     │  (shared code)   │
                    │                  │
┌─────────────┐     │  • Definitions   │
│server-factory│────▶│  • Logic         │
└─────────────┘     │  • Types         │
                    └──────────────────┘
                            │
                            ▼
                    ┌──────────────────┐
                    │  Config & Utils  │
                    │  (shared code)   │
                    └──────────────────┘
```

---

## Implementation Details

### 1. ESM (ES Modules)

**Decision**: Use ESM instead of CommonJS

**Rationale**:
- MCP SDK is built for ESM
- Modern JavaScript standard
- Better tree-shaking and optimization
- Native browser compatibility (future-proof)

**Requirements**:
- `"type": "module"` in package.json
- `.js` extensions in all imports
- `import`/`export` syntax (not `require`)

### 2. TypeScript

**Decision**: Use TypeScript with strict mode

**Rationale**:
- Compile-time type checking
- Better IDE support and autocomplete
- Self-documenting code via types
- Prevents common runtime errors

**Configuration**:
- `strict: true` for maximum safety
- `declaration: true` for .d.ts files
- `ES2022` target for modern features

### 3. esbuild

**Decision**: Use esbuild instead of webpack/rollup

**Rationale**:
- 10-100x faster than alternatives
- Simple configuration
- Built-in TypeScript support
- Excellent ESM support

**Trade-off**: Less plugin ecosystem than webpack

### 4. Dual Build

**Decision**: Build both entry points separately

**Rationale**:
- Optimizes each entry point independently
- Allows different bundling strategies
- Maintains clear separation of concerns

**Trade-off**: Slightly larger total bundle size

### 5. stdio Transport (Standalone)

**Decision**: Use stdio for standalone server

**Rationale**:
- Required by Claude Desktop
- Simple, no network configuration
- Secure (no exposed ports)
- Standard MCP transport

### 6. User Isolation (Factory)

**Decision**: Pass userId to all tool handlers

**Rationale**:
- Enables multi-tenancy
- Prevents data leakage between users
- Required for production deployment
- Compatible with mcp-auth

**Implementation**: Every tool handler accepts `userId: string` parameter

---

## Benefits

### 1. Flexibility
- Single codebase supports multiple deployment modes
- Easy to switch between development and production
- Can be used as library or standalone

### 2. Code Reusability
- Tool implementations shared across modes
- No code duplication
- Consistent behavior everywhere

### 3. Type Safety
- Full TypeScript support
- Compile-time error detection
- Self-documenting APIs

### 4. Developer Experience
- Fast builds with esbuild
- Hot reload in development
- Clear separation of concerns

### 5. Production Ready
- Multi-tenant support via factory
- User isolation built-in
- Compatible with mcp-auth

### 6. Maintainability
- Clear architecture
- Well-defined component boundaries
- Easy to test and debug

---

## Trade-offs

### 1. Complexity
- **Trade-off**: Two entry points add complexity
- **Mitigation**: Clear documentation and examples
- **When it matters**: Small projects may not need dual export

### 2. Bundle Size
- **Trade-off**: Dual build creates two bundles
- **Mitigation**: Shared code is bundled efficiently
- **When it matters**: Size-constrained environments

### 3. Learning Curve
- **Trade-off**: Developers must understand both patterns
- **Mitigation**: Comprehensive patterns and examples
- **When it matters**: New team members onboarding

### 4. Build Time
- **Trade-off**: Building two entry points takes longer
- **Mitigation**: esbuild is extremely fast
- **When it matters**: CI/CD pipelines with tight time limits

### 5. Testing Complexity
- **Trade-off**: Must test both entry points
- **Mitigation**: Shared tool tests cover both modes
- **When it matters**: Comprehensive test coverage required

---

## When to Use This Architecture

### ✅ Use This Architecture When:
- Building production MCP servers
- Need multi-tenant support
- Want to support both Claude Desktop and mcp-auth
- Require user isolation
- Building reusable MCP server libraries
- Need type safety and modern tooling

### ❌ Consider Simpler Architecture When:
- Building quick prototypes
- Single-user only (no multi-tenancy needed)
- No production deployment planned
- Very simple servers (1-2 tools)
- Learning MCP basics

---

## Migration Path

### From Single Entry Point

1. **Extract tool handlers** into separate files
2. **Add userId parameter** to all handlers
3. **Create server-factory.ts** with createServer function
4. **Update package.json** with dual exports
5. **Update build config** to build both entry points
6. **Test both modes** to ensure consistency

### From Separate Codebases

1. **Identify shared code** (tools, config, utils)
2. **Extract to shared modules**
3. **Create server.ts** for standalone mode
4. **Create server-factory.ts** for multi-tenant mode
5. **Update imports** to use shared modules
6. **Remove duplicate code**
7. **Test both modes** thoroughly

---

## Related Documentation

- [Bootstrap Pattern](../patterns/mcp-server-starter.bootstrap.md) - Project setup
- [Server Standalone Pattern](../patterns/mcp-server-starter.server-standalone.md) - Standalone implementation
- [Server Factory Pattern](../patterns/mcp-server-starter.server-factory.md) - Factory implementation
- [Tool Creation Pattern](../patterns/mcp-server-starter.tool-creation.md) - Tool development
- [mcp-auth Integration Design](mcp-server-starter.mcp-auth-integration.md) - Multi-tenancy details

---

**Status**: Design Specification
**Recommendation**: Use this architecture for all production MCP servers requiring multi-tenant support
