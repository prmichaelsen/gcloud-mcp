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

    const client = await auth.getClient();
    const credentials = await auth.getCredentials();

    const identity = credentials.client_email
      || 'unknown (using user credentials or metadata server)';

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

    const denied = permissionsToTest.filter((p) => !grantedPermissions.includes(p));

    const guidance: string[] = [];
    if (denied.length > 0 && !permissionCheckError) {
      if (denied.some((p) => p.startsWith('cloudbuild'))) {
        guidance.push('Grant roles/cloudbuild.builds.viewer for Cloud Build access');
      }
      if (denied.some((p) => p.startsWith('logging'))) {
        guidance.push('Grant roles/logging.viewer for log access');
      }
      if (denied.some((p) => p.startsWith('run'))) {
        guidance.push('Grant roles/run.viewer for Cloud Run access');
      }
    }

    const result: Record<string, unknown> = {
      project: projectId,
      identity,
      authType: credentials.client_email ? 'service_account' : 'user_or_metadata',
      permissions: {
        tested: permissionsToTest,
        granted: grantedPermissions,
        denied,
        error: permissionCheckError,
      },
      configuredRegion: config.gcp.region,
    };

    if (guidance.length > 0) {
      result.guidance = guidance;
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_whoami',
      operation: 'check GCP authentication and permissions',
    });
  }
}
