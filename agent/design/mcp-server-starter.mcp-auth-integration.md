# mcp-auth Integration Design

**Concept**: Multi-tenant MCP server deployment with user authentication and isolation via mcp-auth wrapper

**Created**: 2026-02-22
**Status**: Design Specification

---

## Overview

mcp-auth is a production-ready authentication and multi-tenancy wrapper for MCP servers. It enables MCP servers to support multiple users simultaneously with proper authentication, authorization, and data isolation. The wrapper handles JWT validation, user identification, and request routing while the MCP server focuses on business logic.

**Key Capabilities**:
- JWT-based authentication
- Per-user server instance isolation
- SSE (Server-Sent Events) and HTTP transport support
- Automatic request routing to user-specific server instances
- Token refresh and session management
- Compatible with any MCP server using the factory pattern

**Repository**: https://github.com/prmichaelsen/mcp-auth

---

## Problem Statement

MCP servers face several challenges in production multi-tenant environments:

### 1. Authentication
- **Challenge**: MCP SDK doesn't include authentication
- **Impact**: No way to verify user identity
- **Risk**: Unauthorized access to tools and data

### 2. Multi-Tenancy
- **Challenge**: Single server instance serves all users
- **Impact**: Shared state between users
- **Risk**: Data leakage across user boundaries

### 3. User Isolation
- **Challenge**: Tools need to scope operations per user
- **Impact**: Complex manual isolation logic
- **Risk**: Accidental cross-user data access

### 4. Transport Limitations
- **Challenge**: stdio transport is single-user only
- **Impact**: Can't serve multiple concurrent users
- **Risk**: Not suitable for production web services

### 5. Session Management
- **Challenge**: No built-in session handling
- **Impact**: Manual token management required
- **Risk**: Security vulnerabilities

**Core Problem**: How do we deploy MCP servers in production environments where multiple users need authenticated, isolated access to the same server?

---

## Solution

mcp-auth solves these problems by wrapping MCP servers with an authentication and multi-tenancy layer:

### 1. Authentication Layer
- Validates JWT tokens on every request
- Extracts user identity from token claims
- Rejects unauthorized requests
- Supports custom authentication providers

### 2. Multi-Tenancy via Factory Pattern
- Creates isolated server instance per user
- Passes userId to server factory
- Maintains separate state per user
- Automatic instance lifecycle management

### 3. Transport Abstraction
- SSE transport for real-time communication
- HTTP transport for request/response
- Handles connection management
- Supports multiple concurrent users

### 4. Request Routing
- Routes requests to correct user instance
- Maintains user session state
- Handles token refresh
- Manages server instance pool

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Environment                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │   Client     │                                           │
│  │  (Browser/   │                                           │
│  │   App)       │                                           │
│  └──────┬───────┘                                           │
│         │                                                    │
│         │ HTTP/SSE Request + JWT                            │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────┐              │
│  │         mcp-auth Wrapper                 │              │
│  │                                          │              │
│  │  ┌────────────────────────────────────┐ │              │
│  │  │   Authentication Layer             │ │              │
│  │  │  • Validate JWT                    │ │              │
│  │  │  • Extract userId                  │ │              │
│  │  │  • Check permissions               │ │              │
│  │  └────────────┬───────────────────────┘ │              │
│  │               │                          │              │
│  │               ▼                          │              │
│  │  ┌────────────────────────────────────┐ │              │
│  │  │   Instance Manager                 │ │              │
│  │  │  • Get/create user instance        │ │              │
│  │  │  • Manage instance pool            │ │              │
│  │  │  • Handle lifecycle                │ │              │
│  │  └────────────┬───────────────────────┘ │              │
│  │               │                          │              │
│  │               ▼                          │              │
│  │  ┌────────────────────────────────────┐ │              │
│  │  │   Transport Layer (SSE/HTTP)       │ │              │
│  │  │  • Handle connections              │ │              │
│  │  │  • Route requests                  │ │              │
│  │  │  • Manage sessions                 │ │              │
│  │  └────────────┬───────────────────────┘ │              │
│  └───────────────┼──────────────────────────┘              │
│                  │                                          │
│                  ▼                                          │
│  ┌──────────────────────────────────────────┐              │
│  │      MCP Server Factory                  │              │
│  │                                          │              │
│  │  createServer(accessToken, userId, opts) │              │
│  │                                          │              │
│  │  ┌────────────────────────────────────┐ │              │
│  │  │  User Instance (user-123)          │ │              │
│  │  │  • Isolated MCP Server             │ │              │
│  │  │  • User-scoped tools               │ │              │
│  │  │  • Private state                   │ │              │
│  │  └────────────────────────────────────┘ │              │
│  │                                          │              │
│  │  ┌────────────────────────────────────┐ │              │
│  │  │  User Instance (user-456)          │ │              │
│  │  │  • Isolated MCP Server             │ │              │
│  │  │  • User-scoped tools               │ │              │
│  │  │  • Private state                   │ │              │
│  │  └────────────────────────────────────┘ │              │
│  │                                          │              │
│  └──────────────────────────────────────────┘              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

### Request Flow Diagram

```
┌─────────┐      ┌──────────┐      ┌─────────────┐      ┌──────────┐
│ Client  │      │ mcp-auth │      │   Factory   │      │   MCP    │
│         │      │  Wrapper │      │             │      │  Server  │
└────┬────┘      └─────┬────┘      └──────┬──────┘      └────┬─────┘
     │                 │                   │                  │
     │ 1. Request      │                   │                  │
     │    + JWT Token  │                   │                  │
     ├────────────────▶│                   │                  │
     │                 │                   │                  │
     │            2. Validate JWT          │                  │
     │               (check signature,     │                  │
     │                expiry, claims)      │                  │
     │                 │                   │                  │
     │            3. Extract userId        │                  │
     │               from token claims     │                  │
     │                 │                   │                  │
     │                 │ 4. Get/Create     │                  │
     │                 │    User Instance  │                  │
     │                 ├──────────────────▶│                  │
     │                 │                   │                  │
     │                 │              5. createServer(        │
     │                 │                 accessToken,         │
     │                 │                 userId,              │
     │                 │                 options)             │
     │                 │                   ├─────────────────▶│
     │                 │                   │                  │
     │                 │                   │    6. Initialize │
     │                 │                   │       Server     │
     │                 │                   │       Instance   │
     │                 │                   │                  │
     │                 │              7. Return Server        │
     │                 │                   │◀─────────────────┤
     │                 │                   │                  │
     │                 │ 8. Cache Instance │                  │
     │                 │◀──────────────────┤                  │
     │                 │                   │                  │
     │            9. Route Request         │                  │
     │               to User Instance      │                  │
     │                 ├───────────────────┼─────────────────▶│
     │                 │                   │                  │
     │                 │                   │   10. Execute    │
     │                 │                   │       Tool       │
     │                 │                   │       (with      │
     │                 │                   │        userId)   │
     │                 │                   │                  │
     │                 │              11. Return Result       │
     │                 │◀──────────────────┼──────────────────┤
     │                 │                   │                  │
     │ 12. Response    │                   │                  │
     │◀────────────────┤                   │                  │
     │                 │                   │                  │
```

### Step-by-Step Flow

1. **Client sends request** with JWT token in Authorization header
2. **mcp-auth validates JWT** - checks signature, expiry, and claims
3. **Extract userId** from token claims (typically `sub` claim)
4. **Get or create user instance** - check if server instance exists for this user
5. **Call factory function** - `createServer(accessToken, userId, options)`
6. **Initialize server** - factory creates isolated MCP Server instance
7. **Return server instance** - factory returns configured server
8. **Cache instance** - mcp-auth caches server for future requests
9. **Route request** - forward MCP request to user's server instance
10. **Execute tool** - server calls tool handler with userId
11. **Return result** - tool handler returns result
12. **Send response** - mcp-auth sends response back to client

---

## Factory Function Contract

### Signature

```typescript
export async function createServer(
  accessToken: string,
  userId: string,
  options?: ServerOptions
): Promise<Server>
```

### Parameters

**`accessToken: string`** (optional, can be empty string)
- JWT token from the authenticated request
- Used for calling external APIs on behalf of the user
- Can be passed to tool handlers for API authentication
- Example: Calling user's Google Drive API

**`userId: string`** (required)
- Unique identifier for the user
- Extracted from JWT token claims (typically `sub`)
- Used to scope all operations to this user
- Must be passed to all tool handlers

**`options?: ServerOptions`** (optional)
- Additional configuration options
- Can include custom settings per user
- Example: User preferences, feature flags

### Return Value

**`Promise<Server>`**
- Fully configured MCP Server instance
- Isolated to this specific user
- Tools registered and ready to handle requests

### Implementation Example

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Global state (shared across all users, initialized once)
let globalState: GlobalState | null = null;

interface GlobalState {
  database: Database;
  cache: Cache;
}

async function initGlobal(): Promise<GlobalState> {
  if (!globalState) {
    globalState = {
      database: await connectDatabase(),
      cache: new Cache(),
    };
  }
  return globalState;
}

export async function createServer(
  accessToken: string,
  userId: string,
  options?: ServerOptions
): Promise<Server> {
  // Initialize global resources (once per process)
  const global = await initGlobal();
  
  // Create isolated server instance for this user
  const server = new Server(
    {
      name: 'my-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  
  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      searchDocumentsTool,
      createDocumentTool,
      // ... more tools
    ],
  }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    // Route to appropriate handler with userId
    switch (name) {
      case 'search_documents':
        return await handleSearchDocuments(args, userId, accessToken);
      
      case 'create_document':
        return await handleCreateDocument(args, userId, accessToken);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  });
  
  return server;
}
```

---

## User Isolation Strategy

### Isolation Layers

#### 1. Server Instance Isolation
- Each user gets their own MCP Server instance
- No shared state between instances
- Instance lifecycle managed by mcp-auth
- Instances can be garbage collected when inactive

#### 2. Handler-Level Isolation
- Every tool handler receives `userId` parameter
- Handlers use userId to scope database queries
- No global state accessible to handlers
- All operations are user-specific

#### 3. Data-Level Isolation
- Database queries filtered by userId
- File operations scoped to user directories
- API calls use user-specific credentials
- Cache keys include userId

### Implementation Pattern

```typescript
// Tool handler with proper isolation
export async function handleSearchDocuments(
  args: SearchArgs,
  userId: string,
  accessToken: string
): Promise<ToolResult> {
  // 1. Validate userId (never trust without validation)
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId');
  }
  
  // 2. Query database with userId filter
  const documents = await db.documents.findMany({
    where: {
      userId: userId,  // CRITICAL: Always filter by userId
      title: { contains: args.query },
    },
  });
  
  // 3. Use user-specific cache
  const cacheKey = `search:${userId}:${args.query}`;
  const cached = await cache.get(cacheKey);
  
  // 4. Call external APIs with user's token
  if (accessToken) {
    const externalData = await fetch('https://api.example.com/data', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
  
  // 5. Return user-scoped results
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(documents, null, 2),
    }],
  };
}
```

### Isolation Checklist

- [ ] Every tool handler accepts `userId` parameter
- [ ] All database queries filter by `userId`
- [ ] File operations use user-specific paths
- [ ] Cache keys include `userId`
- [ ] No global mutable state
- [ ] External API calls use user's `accessToken`
- [ ] Error messages don't leak other users' data
- [ ] Logging includes `userId` for audit trails

---

## Complete Integration Example

### 1. Install Dependencies

```bash
npm install @prmichaelsen/mcp-auth
```

### 2. Create Server Factory

```typescript
// src/server-factory.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { /* ... */ } from '@modelcontextprotocol/sdk/types.js';

export async function createServer(
  accessToken: string,
  userId: string,
  options?: any
): Promise<Server> {
  const server = new Server(
    { name: 'my-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  
  // Register tools with userId scoping
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [/* ... */],
  }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    // Pass userId to all handlers
    return await routeToHandler(request, userId, accessToken);
  });
  
  return server;
}
```

### 3. Create mcp-auth Wrapper

```typescript
// src/index.ts
import { wrapServer, JWTAuthProvider } from '@prmichaelsen/mcp-auth';
import { createServer } from './server-factory.js';

async function main() {
  const wrapped = wrapServer({
    // Server factory function
    serverFactory: createServer,
    
    // Authentication provider
    authProvider: new JWTAuthProvider({
      jwtSecret: process.env.JWT_SECRET!,
      // Optional: custom token validation
      validateToken: async (token) => {
        // Custom validation logic
        return true;
      },
    }),
    
    // Resource type for authorization
    resourceType: 'my-mcp-server',
    
    // Transport configuration
    transport: {
      type: 'sse',  // or 'http'
      port: 3000,
      host: '0.0.0.0',
    },
    
    // Optional: instance management
    instanceOptions: {
      maxInstances: 100,
      idleTimeout: 300000,  // 5 minutes
    },
  });
  
  // Start server
  await wrapped.start();
  console.log('mcp-auth server running on port 3000');
}

main().catch(console.error);
```

### 4. Configure Environment

```bash
# .env
JWT_SECRET=your-secret-key-here
PORT=3000
DATABASE_URL=postgresql://...
```

### 5. Client Usage

```typescript
// Client-side code
const response = await fetch('http://localhost:3000/sse', {
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'search_documents',
      arguments: { query: 'hello' },
    },
    id: 1,
  }),
});
```

---

## Benefits

### 1. Security
- JWT-based authentication out of the box
- Automatic token validation
- User identity verification
- Protection against unauthorized access

### 2. Multi-Tenancy
- True user isolation
- No shared state between users
- Scalable to thousands of users
- Automatic instance management

### 3. Production Ready
- Battle-tested in production
- SSE and HTTP transport support
- Connection management
- Error handling and logging

### 4. Developer Experience
- Simple integration (just implement factory)
- No manual authentication code
- Automatic request routing
- Clear separation of concerns

### 5. Flexibility
- Custom authentication providers
- Configurable instance lifecycle
- Multiple transport options
- Extensible architecture

---

## Trade-offs

### 1. Complexity
- **Trade-off**: Additional layer adds complexity
- **Mitigation**: Well-documented, simple API
- **When it matters**: Simple single-user servers

### 2. Performance
- **Trade-off**: Per-user instances use more memory
- **Mitigation**: Configurable instance pooling and timeouts
- **When it matters**: Very high user counts (1000+)

### 3. Transport Limitations
- **Trade-off**: No stdio support (SSE/HTTP only)
- **Mitigation**: Use standalone server for Claude Desktop
- **When it matters**: Development with Claude Desktop

### 4. Learning Curve
- **Trade-off**: Must understand JWT and multi-tenancy
- **Mitigation**: Comprehensive documentation and examples
- **When it matters**: Teams new to authentication

### 5. Dependency
- **Trade-off**: Adds external dependency
- **Mitigation**: Well-maintained, production-proven library
- **When it matters**: Minimal dependency projects

---

## When to Use mcp-auth

### ✅ Use mcp-auth When:
- **Production deployment** with multiple users
- **User authentication** is required
- **Data isolation** between users is critical
- **SSE or HTTP transport** is needed
- **Scalability** to many concurrent users
- **Web-based** MCP clients
- **API-style** access to MCP servers

### ❌ Don't Use mcp-auth When:
- **Claude Desktop** integration (use standalone server)
- **Single-user** deployments
- **stdio transport** is required
- **No authentication** needed
- **Prototyping** or learning MCP
- **Local development** only

---

## Decision Matrix

| Scenario | Use Standalone | Use mcp-auth |
|----------|---------------|--------------|
| Claude Desktop | ✅ Yes | ❌ No |
| Production web app | ❌ No | ✅ Yes |
| Multiple users | ❌ No | ✅ Yes |
| Authentication required | ❌ No | ✅ Yes |
| stdio transport | ✅ Yes | ❌ No |
| SSE/HTTP transport | ❌ No | ✅ Yes |
| Local development | ✅ Yes | ❌ No |
| Single user | ✅ Yes | ❌ No |
| Data isolation needed | ❌ No | ✅ Yes |
| Simple deployment | ✅ Yes | ❌ No |

---

## Migration Path

### From Standalone to mcp-auth

1. **Add userId parameter** to all tool handlers
2. **Create server-factory.ts** with createServer function
3. **Update package.json** with factory export
4. **Install mcp-auth** dependency
5. **Create wrapper** in src/index.ts
6. **Configure JWT** authentication
7. **Test with multiple users** to verify isolation
8. **Deploy to production**

### Example Migration

**Before** (standalone):
```typescript
// src/server.ts
export async function handleSearch(args: SearchArgs) {
  const results = await db.search(args.query);
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}
```

**After** (mcp-auth compatible):
```typescript
// src/tools/search.ts
export async function handleSearch(
  args: SearchArgs,
  userId: string,
  accessToken: string
) {
  // Add userId filter for isolation
  const results = await db.search({
    query: args.query,
    userId: userId,  // NEW: User isolation
  });
  return { content: [{ type: 'text', text: JSON.stringify(results) }] };
}

// src/server-factory.ts
export async function createServer(
  accessToken: string,
  userId: string
): Promise<Server> {
  const server = new Server(/* ... */);
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === 'search') {
      return await handleSearch(
        request.params.arguments,
        userId,        // NEW: Pass userId
        accessToken    // NEW: Pass token
      );
    }
  });
  return server;
}
```

---

## Related Documentation

- [Architecture Design](mcp-server-starter.architecture.md) - Overall architecture
- [Server Factory Pattern](../patterns/mcp-server-starter.server-factory.md) - Factory implementation
- [Server Standalone Pattern](../patterns/mcp-server-starter.server-standalone.md) - Standalone comparison
- [mcp-auth Repository](https://github.com/prmichaelsen/mcp-auth) - Official documentation

---

**Status**: Design Specification
**Recommendation**: Use mcp-auth for all production multi-tenant MCP server deployments
