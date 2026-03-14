import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const listBuildsTool = {
  name: 'gcloud_list_builds',
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

    const filters: string[] = [];
    if (args.status) filters.push(`status="${args.status}"`);
    if (args.triggerId) filters.push(`trigger_id="${args.triggerId}"`);
    if (args.branchName) filters.push(`source.repo_source.branch_name="${args.branchName}"`);

    const [builds] = await client.listBuilds({
      projectId,
      pageSize: limit,
      filter: filters.length > 0 ? filters.join(' AND ') : undefined,
    }, { autoPaginate: false });

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
