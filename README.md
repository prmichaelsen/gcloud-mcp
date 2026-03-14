# @prmichaelsen/gcloud-mcp

MCP server for Google Cloud Build and Cloud Run. List builds, get build details and logs, list Cloud Run services, and retrieve service logs.

## Installation

```bash
npm install @prmichaelsen/gcloud-mcp
```

### Prerequisites

- Node.js 20+
- GCP Application Default Credentials: `gcloud auth application-default login`
- Required IAM roles: `roles/cloudbuild.builds.viewer`, `roles/logging.viewer`, `roles/run.viewer`

## Usage

### Claude Code

```bash
claude mcp add -e GOOGLE_CLOUD_PROJECT=your-project-id -- gcloud-mcp node /path/to/dist/server.js
```

Or via npx (after npm publish):

```bash
claude mcp add -e GOOGLE_CLOUD_PROJECT=your-project-id -- gcloud-mcp npx -y @prmichaelsen/gcloud-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gcloud-mcp": {
      "command": "npx",
      "args": ["-y", "@prmichaelsen/gcloud-mcp"],
      "env": {
        "GOOGLE_CLOUD_PROJECT": "your-project-id"
      }
    }
  }
}
```

### Multi-Tenant (mcp-auth)

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

## Tools

### `gcloud_whoami`
Returns current GCP project, authenticated identity, and available permissions.

### `gcloud_list_builds`
List Cloud Build builds with optional filters for status, trigger, and branch.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | string | No | GCP project ID (defaults to env) |
| `status` | string | No | Filter: SUCCESS, FAILURE, WORKING, etc. |
| `triggerId` | string | No | Filter by trigger ID |
| `branchName` | string | No | Filter by branch |
| `limit` | number | No | Max results (default 10, max 100) |

### `gcloud_get_build`
Get full build details including steps, substitutions, and per-step timing.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buildId` | string | Yes | Cloud Build build ID |
| `projectId` | string | No | GCP project ID |

### `gcloud_get_build_logs`
Fetch build logs from Cloud Logging with step filtering and line limits.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `buildId` | string | Yes | Cloud Build build ID |
| `projectId` | string | No | GCP project ID |
| `stepName` | string | No | Filter by step name |
| `limit` | number | No | Max lines (default 100) |
| `tail` | boolean | No | Return last N lines |

### `gcloud_list_services`
List Cloud Run services in a region.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | string | No | GCP region (defaults to env) |
| `projectId` | string | No | GCP project ID |

### `gcloud_get_service_logs`
Fetch Cloud Run service logs with severity, time, and revision filters.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceName` | string | Yes | Cloud Run service name |
| `region` | string | No | GCP region |
| `projectId` | string | No | GCP project ID |
| `severity` | string | No | Min severity: DEBUG, INFO, WARNING, ERROR, CRITICAL |
| `since` | string | No | Time range: "1h", "30m", "2d" (default "1h") |
| `revision` | string | No | Filter by revision |
| `limit` | number | No | Max entries (default 50, max 500) |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Yes | Default GCP project ID |
| `GOOGLE_CLOUD_REGION` | No | Default Cloud Run region (default: us-central1) |
| `LOG_LEVEL` | No | Server log level: debug, info, warn, error |

## Development

```bash
npm install
npm run build
npm run dev      # watch mode
npm run typecheck
```

## License

MIT
