# Task 3: Implement Cloud Build Tools

**Milestone**: [M1 - Project Setup & Core Tools](../../milestones/milestone-1-project-setup-and-core-tools.md)
**Design Reference**: [Requirements](../../design/requirements.md)
**Estimated Time**: 4 hours
**Dependencies**: Task 2 (Implement Standalone Server)
**Status**: Not Started

---

## Objective

Implement three Cloud Build tools: `list_builds`, `get_build`, and `get_build_logs`. These tools allow users to list builds with filters, inspect full build details with per-step timing, and fetch build logs from Cloud Logging.

---

## Context

Cloud Build is the CI/CD pipeline for GCP. Developers frequently need to check build statuses, read logs for failed builds, and inspect step-level timing to identify bottlenecks. These three tools provide read-only access to build data via the `@google-cloud/cloudbuild` and `@google-cloud/logging` client libraries. All tools accept an optional `projectId` parameter that defaults to the `GOOGLE_CLOUD_PROJECT` environment variable.

---

## Steps

### 1. Create src/tools/list-builds.ts

List Cloud Build builds with optional filters for status, trigger ID, and branch name. Default limit 10, max 100. Returns status, duration, source repo/branch, trigger name, and start/finish times.

```typescript
import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const listBuildsTool = {
  name: 'list_builds',
  description: 'List Cloud Build builds with optional filters for status, trigger, and branch. Returns status, duration, source, trigger name, and timing.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      status: {
        type: 'string',
        enum: ['STATUS_UNKNOWN', 'QUEUED', 'WORKING', 'SUCCESS', 'FAILURE', 'INTERNAL_ERROR', 'TIMEOUT', 'CANCELLED'],
        description: 'Filter by build status.',
      },
      triggerId: {
        type: 'string',
        description: 'Filter by Cloud Build trigger ID.',
      },
      branchName: {
        type: 'string',
        description: 'Filter by source branch name.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of builds to return. Default 10, max 100.',
        minimum: 1,
        maximum: 100,
      },
    },
    required: [],
  },
};

export interface ListBuildsArgs {
  projectId?: string;
  status?: string;
  triggerId?: string;
  branchName?: string;
  limit?: number;
}

export async function handleListBuilds(args: ListBuildsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const limit = Math.min(args.limit || 10, 100);

    // Build filter string for the Cloud Build API
    const filters: string[] = [];
    if (args.status) filters.push(`status="${args.status}"`);
    if (args.triggerId) filters.push(`trigger_id="${args.triggerId}"`);
    if (args.branchName) filters.push(`source.repo_source.branch_name="${args.branchName}"`);

    const [builds] = await client.listBuilds({
      projectId,
      pageSize: limit,
      filter: filters.length > 0 ? filters.join(' AND ') : undefined,
    });

    const results = (builds || []).map((build) => ({
      id: build.id,
      status: build.status,
      source: build.source?.repoSource ? {
        repoName: build.source.repoSource.repoName,
        branchName: build.source.repoSource.branchName,
      } : null,
      trigger: build.buildTriggerId || null,
      createTime: build.createTime?.seconds ? new Date(Number(build.createTime.seconds) * 1000).toISOString() : null,
      startTime: build.startTime?.seconds ? new Date(Number(build.startTime.seconds) * 1000).toISOString() : null,
      finishTime: build.finishTime?.seconds ? new Date(Number(build.finishTime.seconds) * 1000).toISOString() : null,
      duration: build.startTime?.seconds && build.finishTime?.seconds
        ? `${Number(build.finishTime.seconds) - Number(build.startTime.seconds)}s`
        : null,
    }));

    return JSON.stringify({ builds: results, total: results.length }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'list_builds',
      operation: 'list Cloud Build builds',
    });
  }
}
```

### 2. Create src/tools/get-build.ts

Get full build details including steps, substitutions, images, source, and per-step timing breakdown.

```typescript
import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const getBuildTool = {
  name: 'get_build',
  description: 'Get full Cloud Build details including steps, substitutions, images, and per-step timing breakdown.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      buildId: {
        type: 'string',
        description: 'The Cloud Build build ID.',
      },
    },
    required: ['buildId'],
  },
};

export interface GetBuildArgs {
  projectId?: string;
  buildId: string;
}

export async function handleGetBuild(args: GetBuildArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    const [build] = await client.getBuild({
      projectId,
      id: args.buildId,
    });

    const steps = (build.steps || []).map((step) => ({
      name: step.name,
      id: step.id,
      status: step.status,
      args: step.args,
      startTime: step.timing?.startTime?.seconds
        ? new Date(Number(step.timing.startTime.seconds) * 1000).toISOString()
        : null,
      endTime: step.timing?.endTime?.seconds
        ? new Date(Number(step.timing.endTime.seconds) * 1000).toISOString()
        : null,
      duration: step.timing?.startTime?.seconds && step.timing?.endTime?.seconds
        ? `${Number(step.timing.endTime.seconds) - Number(step.timing.startTime.seconds)}s`
        : null,
    }));

    const result = {
      id: build.id,
      status: build.status,
      statusDetail: build.statusDetail,
      source: build.source,
      steps,
      substitutions: build.substitutions || {},
      images: build.images || [],
      buildTriggerId: build.buildTriggerId,
      logUrl: build.logUrl,
      createTime: build.createTime?.seconds
        ? new Date(Number(build.createTime.seconds) * 1000).toISOString()
        : null,
      startTime: build.startTime?.seconds
        ? new Date(Number(build.startTime.seconds) * 1000).toISOString()
        : null,
      finishTime: build.finishTime?.seconds
        ? new Date(Number(build.finishTime.seconds) * 1000).toISOString()
        : null,
      duration: build.startTime?.seconds && build.finishTime?.seconds
        ? `${Number(build.finishTime.seconds) - Number(build.startTime.seconds)}s`
        : null,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'get_build',
      operation: 'get Cloud Build details',
      buildId: args.buildId,
    });
  }
}
```

### 3. Create src/tools/get-build-logs.ts

Fetch build logs from the Cloud Logging API. Supports optional step name filter, default 100 lines, tail/limit options.

```typescript
import { Logging } from '@google-cloud/logging';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const logging = new Logging();

export const getBuildLogsTool = {
  name: 'get_build_logs',
  description: 'Fetch Cloud Build logs from Cloud Logging. Supports step filtering and line limits.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      buildId: {
        type: 'string',
        description: 'The Cloud Build build ID.',
      },
      stepName: {
        type: 'string',
        description: 'Optional: filter logs to a specific build step name.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log lines to return. Default 100.',
        minimum: 1,
        maximum: 1000,
      },
      tail: {
        type: 'boolean',
        description: 'If true, return the last N lines instead of the first N. Default false.',
      },
    },
    required: ['buildId'],
  },
};

export interface GetBuildLogsArgs {
  projectId?: string;
  buildId: string;
  stepName?: string;
  limit?: number;
  tail?: boolean;
}

export async function handleGetBuildLogs(args: GetBuildLogsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const limit = args.limit || 100;

    // Build the Cloud Logging filter
    let filter = `resource.type="build" AND resource.labels.build_id="${args.buildId}"`;
    if (args.stepName) {
      filter += ` AND labels.build_step="${args.stepName}"`;
    }

    const log = logging.log(`projects/${projectId}/logs/cloudbuild`);

    const [entries] = await logging.getEntries({
      filter: `logName="projects/${projectId}/logs/cloudbuild" AND ${filter}`,
      orderBy: args.tail ? 'timestamp desc' : 'timestamp asc',
      pageSize: limit,
    });

    let logLines = entries.map((entry) => ({
      timestamp: entry.metadata?.timestamp || null,
      severity: entry.metadata?.severity || 'DEFAULT',
      text: typeof entry.data === 'string'
        ? entry.data
        : entry.data?.textPayload || JSON.stringify(entry.data),
    }));

    // If tail mode was used, reverse to get chronological order
    if (args.tail) {
      logLines = logLines.reverse();
    }

    return JSON.stringify({
      buildId: args.buildId,
      stepFilter: args.stepName || null,
      lineCount: logLines.length,
      logs: logLines,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'get_build_logs',
      operation: 'fetch Cloud Build logs',
      buildId: args.buildId,
    });
  }
}
```

### 4. Register Tools in src/server.ts

Update the server to import and register all three Cloud Build tools.

Add imports at the top of `src/server.ts`:
```typescript
import { listBuildsTool, handleListBuilds } from './tools/list-builds.js';
import { getBuildTool, handleGetBuild } from './tools/get-build.js';
import { getBuildLogsTool, handleGetBuildLogs } from './tools/get-build-logs.js';
```

Add tools to the `ListToolsRequestSchema` handler:
```typescript
tools: [
  listBuildsTool,
  getBuildTool,
  getBuildLogsTool,
],
```

Add cases to the `CallToolRequestSchema` switch statement:
```typescript
case 'list_builds':
  result = await handleListBuilds(args as any);
  break;
case 'get_build':
  result = await handleGetBuild(args as any);
  break;
case 'get_build_logs':
  result = await handleGetBuildLogs(args as any);
  break;
```

---

## Verification

- [ ] `src/tools/list-builds.ts` exists with tool definition and handler
- [ ] `list_builds` accepts optional `projectId`, `status`, `triggerId`, `branchName`, `limit` parameters
- [ ] `list_builds` defaults to limit 10, enforces max 100
- [ ] `list_builds` returns status, duration, source, trigger, and timing for each build
- [ ] `src/tools/get-build.ts` exists with tool definition and handler
- [ ] `get_build` requires `buildId`, accepts optional `projectId`
- [ ] `get_build` returns full build with steps, substitutions, per-step timing
- [ ] `src/tools/get-build-logs.ts` exists with tool definition and handler
- [ ] `get_build_logs` requires `buildId`, accepts optional `stepName`, `limit`, `tail`
- [ ] `get_build_logs` defaults to 100 lines
- [ ] All three tools are registered in `server.ts` (ListTools and CallTool handlers)
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] Permission errors return actionable messages via the error handler

---

## Expected Output

**File Structure**:
```
src/tools/
├── list-builds.ts      # list_builds tool
├── get-build.ts        # get_build tool
└── get-build-logs.ts   # get_build_logs tool
```

**Key Files Created**:
- `src/tools/list-builds.ts`: Lists builds with status/trigger/branch filters, returns summaries
- `src/tools/get-build.ts`: Full build details with steps, substitutions, per-step timing
- `src/tools/get-build-logs.ts`: Build logs from Cloud Logging with step filter and tail support

**Updated Files**:
- `src/server.ts`: Updated to import and register all three Cloud Build tools

---

## Key Design Decisions

### API Client Instantiation

| Decision | Choice | Rationale |
|---|---|---|
| Client lifecycle | Single global instance per client library | GCP clients handle connection pooling internally; creating per-request is wasteful |
| Project ID | Per-request from args or config | Enables multi-project support without client re-initialization |

### Log Retrieval

| Decision | Choice | Rationale |
|---|---|---|
| Log source | Cloud Logging API (not Cloud Build API) | Cloud Logging provides structured queries, filtering by step, and pagination. Consistent with how Cloud Run logs will also be fetched in Milestone 2 |
| Streaming | Not included in v1 | Simplifies implementation; completed logs only |

---

## Common Issues and Solutions

### Issue 1: No Builds Returned
**Symptom**: `list_builds` returns empty array despite builds existing
**Solution**: Verify the `projectId` is correct. Check that the authenticated account has `roles/cloudbuild.builds.viewer` or `roles/cloudbuild.builds.editor`. Run `gcloud_whoami` to verify identity.

### Issue 2: Permission Denied on Logs
**Symptom**: `get_build_logs` fails with PERMISSION_DENIED
**Solution**: The Cloud Logging API requires `roles/logging.viewer` in addition to Cloud Build roles. Grant `roles/logging.viewer` to the authenticated account.

### Issue 3: Build ID Not Found
**Symptom**: `get_build` returns NOT_FOUND error
**Solution**: Build IDs are UUIDs. Verify the ID is correct and belongs to the specified project. Builds may also be in a different region.

### Issue 4: Timestamp Handling
**Symptom**: Timestamps appear as null or incorrect
**Solution**: GCP protobuf timestamps use `{ seconds, nanos }` format. The code converts via `new Date(Number(seconds) * 1000)`. Ensure `seconds` is accessed correctly from the response object.

---

## Resources

- [Cloud Build API Reference](https://cloud.google.com/build/docs/api/reference/rest): REST API documentation
- [@google-cloud/cloudbuild npm](https://www.npmjs.com/package/@google-cloud/cloudbuild): Node.js client library
- [Cloud Logging API Reference](https://cloud.google.com/logging/docs/reference/v2/rest): Logging REST API
- [@google-cloud/logging npm](https://www.npmjs.com/package/@google-cloud/logging): Node.js logging client
- [Tool Creation Pattern](../../patterns/mcp-server-starter.tool-creation.md): Tool structure reference

---

## Notes

- GCP client libraries use ADC automatically -- no explicit credential passing needed
- The `filter` parameter for `listBuilds` uses Cloud Build's filter syntax, not Cloud Logging syntax
- Build logs via Cloud Logging may have a slight delay (seconds) after build completion before all entries are available
- The `log` variable in `get-build-logs.ts` references the specific Cloud Build log name for the project
- All handlers return JSON strings, not objects, per the tool-creation pattern

---

**Next Task**: [Task 4: Implement Whoami Tool](task-4-implement-whoami-tool.md)
**Related Design Docs**: [Requirements](../../design/requirements.md)
