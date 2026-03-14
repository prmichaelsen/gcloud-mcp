import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const getTriggerTool = {
  name: 'gcloud_get_trigger',
  description: 'Get full Cloud Build trigger configuration including repo, branch filter, build config, and substitutions.',
  inputSchema: {
    type: 'object',
    properties: {
      triggerId: {
        type: 'string',
        description: 'Cloud Build trigger ID.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: ['triggerId'],
  },
};

export interface GetTriggerArgs {
  triggerId: string;
  projectId?: string;
}

export async function handleGetTrigger(args: GetTriggerArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    const [trigger] = await client.getBuildTrigger({
      projectId,
      triggerId: args.triggerId,
    });

    const result = {
      id: trigger.id,
      name: trigger.name || null,
      description: trigger.description || null,
      disabled: trigger.disabled || false,
      createTime: trigger.createTime?.seconds
        ? new Date(Number(trigger.createTime.seconds) * 1000).toISOString()
        : null,
      repoSource: trigger.triggerTemplate ? {
        repoName: trigger.triggerTemplate.repoName || null,
        branchName: trigger.triggerTemplate.branchName || null,
        tagName: trigger.triggerTemplate.tagName || null,
        dir: trigger.triggerTemplate.dir || null,
      } : null,
      github: trigger.github ? {
        owner: trigger.github.owner || null,
        name: trigger.github.name || null,
        push: trigger.github.push ? {
          branch: trigger.github.push.branch || null,
          tag: trigger.github.push.tag || null,
          invertRegex: trigger.github.push.invertRegex || false,
        } : null,
        pullRequest: trigger.github.pullRequest ? {
          branch: trigger.github.pullRequest.branch || null,
          commentControl: trigger.github.pullRequest.commentControl || null,
          invertRegex: trigger.github.pullRequest.invertRegex || false,
        } : null,
      } : null,
      filename: trigger.filename || null,
      build: trigger.build ? {
        steps: (trigger.build.steps || []).map((step: any) => ({
          name: step.name,
          args: step.args,
          env: step.env,
          dir: step.dir,
          id: step.id,
          waitFor: step.waitFor,
        })),
        substitutions: trigger.build.substitutions || {},
        images: trigger.build.images || [],
        timeout: trigger.build.timeout?.seconds ? `${trigger.build.timeout.seconds}s` : null,
      } : null,
      substitutions: trigger.substitutions || {},
      includedFiles: trigger.includedFiles || [],
      ignoredFiles: trigger.ignoredFiles || [],
      tags: trigger.tags || [],
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_get_trigger',
      operation: 'get Cloud Build trigger',
      triggerId: args.triggerId,
    });
  }
}
