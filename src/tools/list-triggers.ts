import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const listTriggersTool = {
  name: 'gcloud_list_triggers',
  description: 'List Cloud Build triggers in a project. Shows trigger name, repo, branch filter, and status.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: [],
  },
};

export interface ListTriggersArgs {
  projectId?: string;
}

export async function handleListTriggers(args: ListTriggersArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    const [triggers] = await client.listBuildTriggers({
      projectId,
    });

    const results = (triggers || []).map((trigger: any) => ({
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
      } : null,
      github: trigger.github ? {
        owner: trigger.github.owner || null,
        name: trigger.github.name || null,
        push: trigger.github.push ? {
          branch: trigger.github.push.branch || null,
          tag: trigger.github.push.tag || null,
        } : null,
        pullRequest: trigger.github.pullRequest ? {
          branch: trigger.github.pullRequest.branch || null,
        } : null,
      } : null,
      filename: trigger.filename || null,
      includedFiles: trigger.includedFiles || [],
      ignoredFiles: trigger.ignoredFiles || [],
    }));

    return JSON.stringify({ triggers: results, projectId, total: results.length }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_list_triggers',
      operation: 'list Cloud Build triggers',
    });
  }
}
