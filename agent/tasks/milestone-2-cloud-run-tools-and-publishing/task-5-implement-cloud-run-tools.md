# Task 5: Implement Cloud Run Tools

**Milestone**: M2 - Cloud Run Tools and Publishing
**Design Reference**: None
**Estimated Time**: 4 hours
**Dependencies**: Milestone 1 tasks completed (project bootstrap, build config, server scaffold)
**Status**: Not Started

---

## Objective

Implement two MCP tools -- `list_services` and `get_service_logs` -- that allow users to interact with Google Cloud Run services and retrieve Cloud Logging entries for those services.

---

## Context

These are the core tools of the gcloud-mcp server. `list_services` uses the `@google-cloud/run` client library to enumerate Cloud Run services in a given region, returning key operational data (URL, latest revision, status, last deployed timestamp). `get_service_logs` uses the `@google-cloud/logging` client library to fetch recent log entries for a specific service, with filtering by severity, time range, and revision. Both tools accept an optional `projectId` parameter and use Application Default Credentials (ADC) for GCP authentication.

---

## Steps

### 1. Install GCP client libraries

```bash
npm install @google-cloud/run @google-cloud/logging
npm install -D @types/google-cloud__logging
```

### 2. Create `src/tools/list-services.ts`

Define the tool schema, argument interface, and handler.

```typescript
export const listServicesTool = {
  name: 'list_services',
  description: 'List Cloud Run services in a given region. Returns URL, latest revision, status, and last deployed timestamp for each service.',
  inputSchema: {
    type: 'object',
    properties: {
      region: {
        type: 'string',
        description: 'GCP region (e.g. "us-central1"). Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to ADC project.',
      },
    },
    required: ['region'],
  },
};

export interface ListServicesArgs {
  region: string;
  projectId?: string;
}

export interface ServiceInfo {
  name: string;
  url: string;
  latestRevision: string;
  status: string;
  lastDeployed: string;
}

export interface ListServicesResult {
  services: ServiceInfo[];
  region: string;
  projectId: string;
}
```

Handler implementation notes:
- Use `ServicesClient` from `@google-cloud/run`.
- The `region` parameter is required in the schema but should fall back to `process.env.GOOGLE_CLOUD_REGION` if not provided by the caller.
- Extract service name, URI, latest ready revision, status conditions, and update time from the API response.
- Return result as `JSON.stringify(result, null, 2)`.
- Scope operations with `userId` parameter (for logging/audit, not GCP auth).

### 3. Create `src/tools/get-service-logs.ts`

Define the tool schema, argument interface, and handler.

```typescript
export const getServiceLogsTool = {
  name: 'get_service_logs',
  description: 'Retrieve recent log entries for a Cloud Run service from Cloud Logging.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the Cloud Run service.',
      },
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to ADC project.',
      },
      severity: {
        type: 'string',
        enum: ['DEFAULT', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        description: 'Minimum log severity to filter by.',
      },
      since: {
        type: 'string',
        description: 'Time range to look back (e.g. "1h", "30m", "2d"). Default "1h".',
      },
      revision: {
        type: 'string',
        description: 'Filter logs to a specific revision name.',
      },
      limit: {
        type: 'number',
        description: 'Max number of log entries to return. Default 50, max 500.',
        minimum: 1,
        maximum: 500,
      },
    },
    required: ['serviceName'],
  },
};

export interface GetServiceLogsArgs {
  serviceName: string;
  region?: string;
  projectId?: string;
  severity?: 'DEFAULT' | 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  since?: string;
  revision?: string;
  limit?: number;
}
```

Handler implementation notes:
- Use `Logging` client from `@google-cloud/logging`.
- Parse the `since` parameter (e.g. "1h", "30m", "2d") into a timestamp for the filter.
- Build a Cloud Logging filter string: `resource.type="cloud_run_revision" AND resource.labels.service_name="{serviceName}"`.
- Append severity filter if provided: `AND severity >= {severity}`.
- Append revision filter if provided: `AND resource.labels.revision_name="{revision}"`.
- Append region filter: `AND resource.labels.location="{region}"`.
- Clamp `limit` to max 500, default 50.
- Return entries with: timestamp, severity, textPayload or jsonPayload, revision name.

### 4. Create a time-parsing utility

```typescript
// src/utils/parse-duration.ts
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}. Use e.g. "30m", "1h", "2d".`);
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}
```

### 5. Register tools in server.ts and server-factory.ts

Import the tool definitions and handlers, add them to `ListToolsRequestSchema` handler, and add cases to the `CallToolRequestSchema` switch statement.

```typescript
import { listServicesTool, handleListServices } from './tools/list-services.js';
import { getServiceLogsTool, handleGetServiceLogs } from './tools/get-service-logs.js';

// In ListToolsRequestSchema handler:
tools: [
  listServicesTool,
  getServiceLogsTool,
],

// In CallToolRequestSchema handler:
case 'list_services':
  result = await handleListServices(args as any, userId);
  break;
case 'get_service_logs':
  result = await handleGetServiceLogs(args as any, userId);
  break;
```

### 6. Add error handling

Use the error handler utility pattern. Wrap GCP API calls in try/catch. Surface meaningful error messages for common failures (auth errors, project not found, permission denied).

### 7. Write unit tests

Create `src/tools/list-services.spec.ts` and `src/tools/get-service-logs.spec.ts`. Mock the GCP client libraries. Test:
- Successful responses with expected output shape.
- Default parameter handling (region fallback, limit defaults).
- Error cases (invalid region, API failures).
- Duration parsing edge cases.

---

## Verification

- [ ] `list_services` tool defined with correct schema (region required, projectId optional)
- [ ] `list_services` returns URL, latest revision, status, last deployed timestamp per service
- [ ] `list_services` falls back to `GOOGLE_CLOUD_REGION` env var when region not provided
- [ ] `get_service_logs` tool defined with correct schema (serviceName required, all others optional)
- [ ] `get_service_logs` supports severity, since, revision, and limit filters
- [ ] `get_service_logs` defaults to 50 entries, caps at 500
- [ ] `get_service_logs` defaults `since` to "1h"
- [ ] Both tools accept optional `projectId` parameter
- [ ] Both tools use ADC for GCP authentication
- [ ] Both tool handlers accept `userId` parameter
- [ ] All handlers return JSON strings
- [ ] Duration parsing utility handles "m", "h", "d" units
- [ ] Unit tests pass for both tools
- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` succeeds

---

## Expected Output

**File Structure**:
```
src/
├── tools/
│   ├── list-services.ts
│   ├── list-services.spec.ts
│   ├── get-service-logs.ts
│   └── get-service-logs.spec.ts
└── utils/
    └── parse-duration.ts
```

**Key Files Created**:
- `src/tools/list-services.ts`: list_services tool definition, interfaces, and handler
- `src/tools/get-service-logs.ts`: get_service_logs tool definition, interfaces, and handler
- `src/utils/parse-duration.ts`: Duration string parser utility
- `src/tools/list-services.spec.ts`: Unit tests for list_services
- `src/tools/get-service-logs.spec.ts`: Unit tests for get_service_logs

---

## Common Issues and Solutions

### Issue 1: ADC not configured
**Symptom**: `Error: Could not load the default credentials`
**Solution**: Run `gcloud auth application-default login` or set `GOOGLE_APPLICATION_CREDENTIALS` env var.

### Issue 2: Cloud Run Admin API not enabled
**Symptom**: `Error: Cloud Run Admin API has not been used in project X`
**Solution**: Enable the API via `gcloud services enable run.googleapis.com`.

### Issue 3: Cloud Logging API not enabled
**Symptom**: `Error: Cloud Logging API has not been used in project X`
**Solution**: Enable the API via `gcloud services enable logging.googleapis.com`.

### Issue 4: Permission denied on log reads
**Symptom**: `Error: 403 Permission denied`
**Solution**: Ensure the ADC service account has `roles/logging.viewer` and `roles/run.viewer`.

---

## Resources

- [@google-cloud/run npm](https://www.npmjs.com/package/@google-cloud/run): Cloud Run client library
- [@google-cloud/logging npm](https://www.npmjs.com/package/@google-cloud/logging): Cloud Logging client library
- [Cloud Run API reference](https://cloud.google.com/run/docs/reference/rest): REST API docs
- [Cloud Logging filter syntax](https://cloud.google.com/logging/docs/view/logging-query-language): Query language reference

---

## Notes

- GCP authentication is via ADC, which is separate from any mcp-auth JWT authentication
- The `userId` parameter is used for operation scoping/audit, not for GCP auth
- Region defaults and project defaults simplify the common case while allowing overrides
- The `since` parameter uses a simple human-readable format rather than ISO timestamps

---

**Next Task**: [task-6-create-server-factory.md](task-6-create-server-factory.md)
**Related Design Docs**: None
**Estimated Completion Date**: TBD
