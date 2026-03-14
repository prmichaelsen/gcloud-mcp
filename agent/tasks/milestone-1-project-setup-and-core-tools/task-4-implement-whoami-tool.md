# Task 4: Implement Whoami Tool

**Milestone**: [M1 - Project Setup & Core Tools](../../milestones/milestone-1-project-setup-and-core-tools.md)
**Design Reference**: [Requirements](../../design/requirements.md)
**Estimated Time**: 1.5 hours
**Dependencies**: Task 2 (Implement Standalone Server)
**Status**: Not Started

---

## Objective

Implement the `gcloud_whoami` diagnostic tool that returns the current GCP project, authenticated identity, and available permissions. This tool helps users verify their auth setup and troubleshoot permission issues.

---

## Context

When users encounter permission errors with Cloud Build or Cloud Run tools, they need a way to quickly verify their authentication state. The `gcloud_whoami` tool serves as a diagnostic that reports the configured project, the identity that ADC resolves to, and what key permissions are available. This is analogous to running `gcloud auth list` and `gcloud config get-value project` but accessible directly through the MCP interface.

---

## Steps

### 1. Create src/tools/gcloud-whoami.ts

The whoami tool queries the GCP auth state using the `google-auth-library` (bundled with GCP client libraries) to determine the current identity, then tests key permissions.

```typescript
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

export const gcloudWhoamiTool = {
  name: 'gcloud_whoami',
  description: 'Returns current GCP project, authenticated identity, and available permissions. Use this to verify auth setup and troubleshoot permission issues.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID to check permissions against. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: [],
  },
};

export interface GcloudWhoamiArgs {
  projectId?: string;
}

export async function handleGcloudWhoami(args: GcloudWhoamiArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    // Get the authenticated client and identity
    const client = await auth.getClient();
    const credentials = await auth.getCredentials();

    const identity = credentials.client_email
      || credentials.universe_domain
      || 'unknown (using user credentials or metadata server)';

    // Test key permissions by calling the IAM testIamPermissions API
    const permissionsToTest = [
      'cloudbuild.builds.list',
      'cloudbuild.builds.get',
      'logging.logEntries.list',
      'run.services.list',
      'run.services.get',
    ];

    let grantedPermissions: string[] = [];
    let permissionCheckError: string | null = null;

    try {
      const accessToken = await client.getAccessToken();
      const response = await fetch(
        `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:testIamPermissions`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ permissions: permissionsToTest }),
        }
      );

      if (response.ok) {
        const data = await response.json() as { permissions?: string[] };
        grantedPermissions = data.permissions || [];
      } else {
        permissionCheckError = `HTTP ${response.status}: ${response.statusText}`;
      }
    } catch (error) {
      permissionCheckError = error instanceof Error ? error.message : String(error);
    }

    const result = {
      project: projectId,
      identity,
      authType: credentials.client_email ? 'service_account' : 'user_or_metadata',
      permissions: {
        tested: permissionsToTest,
        granted: grantedPermissions,
        denied: permissionsToTest.filter((p) => !grantedPermissions.includes(p)),
        error: permissionCheckError,
      },
      configuredRegion: config.gcp.region,
    };

    // Add actionable guidance if permissions are missing
    if (result.permissions.denied.length > 0 && !permissionCheckError) {
      const guidance: string[] = [];
      if (result.permissions.denied.some((p) => p.startsWith('cloudbuild'))) {
        guidance.push('Grant roles/cloudbuild.builds.viewer for Cloud Build access');
      }
      if (result.permissions.denied.some((p) => p.startsWith('logging'))) {
        guidance.push('Grant roles/logging.viewer for log access');
      }
      if (result.permissions.denied.some((p) => p.startsWith('run'))) {
        guidance.push('Grant roles/run.viewer for Cloud Run access');
      }
      (result as any).guidance = guidance;
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_whoami',
      operation: 'check GCP authentication and permissions',
    });
  }
}
```

### 2. Register Tool in src/server.ts

Add the whoami tool import and registration to the server.

Add import at the top of `src/server.ts`:
```typescript
import { gcloudWhoamiTool, handleGcloudWhoami } from './tools/gcloud-whoami.js';
```

Add to the `ListToolsRequestSchema` handler tools array:
```typescript
gcloudWhoamiTool,
```

Add case to the `CallToolRequestSchema` switch statement:
```typescript
case 'gcloud_whoami':
  result = await handleGcloudWhoami(args as any);
  break;
```

### 3. Verify google-auth-library Availability

The `google-auth-library` package is a transitive dependency of `@google-cloud/cloudbuild` and `@google-cloud/logging`. Verify it is available:

```bash
node -e "import('google-auth-library').then(m => console.log('OK:', Object.keys(m)))"
```

If not available, install it directly:
```bash
npm install google-auth-library
```

---

## Verification

- [ ] `src/tools/gcloud-whoami.ts` exists with tool definition and handler
- [ ] `gcloud_whoami` accepts optional `projectId` parameter
- [ ] Tool returns current project ID from config or args
- [ ] Tool returns authenticated identity (service account email or user indicator)
- [ ] Tool tests key permissions (cloudbuild, logging, run) via IAM testIamPermissions API
- [ ] Tool reports granted vs denied permissions
- [ ] Tool provides actionable guidance when permissions are missing (e.g., "Grant roles/cloudbuild.builds.viewer")
- [ ] Tool is registered in `server.ts` (ListTools and CallTool handlers)
- [ ] `npm run build` completes without errors
- [ ] `npm run typecheck` passes
- [ ] When run against a real GCP project, tool returns meaningful identity and permission data

---

## Expected Output

**File Structure**:
```
src/tools/
├── list-builds.ts       # (from Task 3)
├── get-build.ts         # (from Task 3)
├── get-build-logs.ts    # (from Task 3)
└── gcloud-whoami.ts     # gcloud_whoami diagnostic tool
```

**Key Files Created**:
- `src/tools/gcloud-whoami.ts`: Diagnostic tool reporting project, identity, and permissions

**Updated Files**:
- `src/server.ts`: Updated to import and register the whoami tool (now has all 4 tools)

**Example Tool Output**:
```json
{
  "project": "my-gcp-project",
  "identity": "my-sa@my-gcp-project.iam.gserviceaccount.com",
  "authType": "service_account",
  "permissions": {
    "tested": [
      "cloudbuild.builds.list",
      "cloudbuild.builds.get",
      "logging.logEntries.list",
      "run.services.list",
      "run.services.get"
    ],
    "granted": [
      "cloudbuild.builds.list",
      "cloudbuild.builds.get",
      "logging.logEntries.list"
    ],
    "denied": [
      "run.services.list",
      "run.services.get"
    ],
    "error": null
  },
  "configuredRegion": "us-central1",
  "guidance": [
    "Grant roles/run.viewer for Cloud Run access"
  ]
}
```

---

## Common Issues and Solutions

### Issue 1: No Credentials Found
**Symptom**: Error "Could not load the default credentials"
**Solution**: Run `gcloud auth application-default login` to set up ADC for local development. In production (Cloud Run, GCE), ADC is provided automatically via the metadata server.

### Issue 2: testIamPermissions Returns 403
**Symptom**: Permission check itself fails with 403
**Solution**: The `testIamPermissions` API requires `resourcemanager.projects.get` permission. If the permission check fails, the tool still reports the identity and project -- it just cannot enumerate permissions. The error is captured in `permissions.error`.

### Issue 3: Identity Shows "unknown"
**Symptom**: Identity field shows "unknown (using user credentials or metadata server)"
**Solution**: When using user credentials (via `gcloud auth application-default login`), the `client_email` field is not set. This is expected behavior. The identity is still valid for API calls.

### Issue 4: google-auth-library Not Found
**Symptom**: Module not found error for `google-auth-library`
**Solution**: Install it directly: `npm install google-auth-library`. It should already be available as a transitive dependency of GCP client libraries, but explicit installation ensures reliability.

---

## Resources

- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials): ADC documentation
- [google-auth-library](https://github.com/googleapis/google-auth-library-nodejs): Node.js auth library
- [IAM testIamPermissions](https://cloud.google.com/resource-manager/reference/rest/v1/projects/testIamPermissions): Permission testing API
- [Tool Creation Pattern](../../patterns/mcp-server-starter.tool-creation.md): Tool structure reference

---

## Notes

- This is the final task in Milestone 1. After completion, the server should have 4 working tools: `list_builds`, `get_build`, `get_build_logs`, `gcloud_whoami`
- The whoami tool intentionally tests Cloud Run permissions even though those tools are in Milestone 2 -- this provides forward-looking diagnostics
- The `google-auth-library` package is a transitive dependency; if import issues arise, install it directly
- Permission testing uses the Resource Manager `testIamPermissions` API, which itself requires minimal permissions
- The tool gracefully handles permission check failures by reporting the error without crashing

---

**Next Task**: Milestone 2 tasks (Cloud Run tools and publishing)
**Related Design Docs**: [Requirements](../../design/requirements.md)
