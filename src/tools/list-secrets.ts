import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new SecretManagerServiceClient();

export const listSecretsTool = {
  name: 'gcloud_list_secrets',
  description: 'List Secret Manager secret names (NOT values) in a project. Shows secret name, creation time, and replication policy.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      filter: {
        type: 'string',
        description: 'Optional filter string (e.g. "name:remember-" to match secrets containing "remember-").',
      },
    },
    required: [],
  },
};

export interface ListSecretsArgs {
  projectId?: string;
  filter?: string;
}

export async function handleListSecrets(args: ListSecretsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const parent = `projects/${projectId}`;

    const [secrets] = await client.listSecrets({
      parent,
      filter: args.filter || undefined,
    }, { autoPaginate: false });

    const results = (secrets || []).map((secret: any) => ({
      name: secret.name?.split('/').pop() || null,
      createTime: secret.createTime?.seconds
        ? new Date(Number(secret.createTime.seconds) * 1000).toISOString()
        : null,
      replication: secret.replication?.automatic ? 'automatic' : 'user-managed',
      versionCount: secret.versionAliases ? Object.keys(secret.versionAliases).length : null,
      labels: secret.labels || {},
    }));

    return JSON.stringify({
      secrets: results,
      projectId,
      total: results.length,
      note: 'Secret values are NOT included for security. Use GCP Console or gcloud CLI to access values.',
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_list_secrets',
      operation: 'list Secret Manager secrets',
    });
  }
}
