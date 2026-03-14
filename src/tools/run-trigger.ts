import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const runTriggerTool = {
  name: 'gcloud_run_trigger',
  description: 'Manually trigger a Cloud Build. Returns the build ID of the triggered build. WARNING: This creates a new build — use with care.',
  inputSchema: {
    type: 'object',
    properties: {
      triggerId: {
        type: 'string',
        description: 'Cloud Build trigger ID to run.',
      },
      branchName: {
        type: 'string',
        description: 'Branch to build from. Defaults to the trigger\'s configured branch.',
      },
      tagName: {
        type: 'string',
        description: 'Tag to build from (alternative to branchName).',
      },
      substitutions: {
        type: 'object',
        description: 'Key-value substitution variables (e.g. {"_MY_VAR": "value"}).',
        additionalProperties: { type: 'string' },
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: ['triggerId'],
  },
};

export interface RunTriggerArgs {
  triggerId: string;
  branchName?: string;
  tagName?: string;
  substitutions?: Record<string, string>;
  projectId?: string;
}

export async function handleRunTrigger(args: RunTriggerArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    const source: any = {};
    if (args.branchName) {
      source.branchName = args.branchName;
    }
    if (args.tagName) {
      source.tagName = args.tagName;
    }

    const [operation] = await client.runBuildTrigger({
      projectId,
      triggerId: args.triggerId,
      source: Object.keys(source).length > 0 ? source : undefined,
    });

    // The operation metadata contains the build info
    const metadata = operation.metadata as any;
    const buildId = metadata?.build?.id || null;

    const result = {
      triggered: true,
      triggerId: args.triggerId,
      buildId,
      projectId,
      branchName: args.branchName || null,
      tagName: args.tagName || null,
      logUrl: metadata?.build?.logUrl || null,
      status: metadata?.build?.status || 'QUEUED',
      message: buildId
        ? `Build ${buildId} triggered successfully. Use gcloud_get_build to check status.`
        : 'Build triggered. Check Cloud Console for status.',
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_run_trigger',
      operation: 'run Cloud Build trigger',
      triggerId: args.triggerId,
    });
  }
}
