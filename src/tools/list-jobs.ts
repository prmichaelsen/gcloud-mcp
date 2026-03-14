import { JobsClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new JobsClient();

export const listJobsTool = {
  name: 'gcloud_list_jobs',
  description: 'List Cloud Run Jobs in a region. Shows job name, last execution status, execution count, and creation time.',
  inputSchema: {
    type: 'object',
    properties: {
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: [],
  },
};

export interface ListJobsArgs {
  region?: string;
  projectId?: string;
}

export async function handleListJobs(args: ListJobsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;

    const parent = `projects/${projectId}/locations/${region}`;
    const [jobs] = await client.listJobs({ parent }, { autoPaginate: false });

    const results = (jobs || []).map((job: any) => ({
      name: job.name?.split('/').pop() || null,
      executionCount: job.executionCount || 0,
      latestExecution: job.latestCreatedExecution ? {
        name: job.latestCreatedExecution.name?.split('/').pop() || null,
        status: job.latestCreatedExecution.completionStatus || null,
        createTime: job.latestCreatedExecution.createTime?.seconds
          ? new Date(Number(job.latestCreatedExecution.createTime.seconds) * 1000).toISOString()
          : null,
        completionTime: job.latestCreatedExecution.completionTime?.seconds
          ? new Date(Number(job.latestCreatedExecution.completionTime.seconds) * 1000).toISOString()
          : null,
      } : null,
      createTime: job.createTime?.seconds
        ? new Date(Number(job.createTime.seconds) * 1000).toISOString()
        : null,
      updateTime: job.updateTime?.seconds
        ? new Date(Number(job.updateTime.seconds) * 1000).toISOString()
        : null,
      creator: job.creator || null,
    }));

    return JSON.stringify({ jobs: results, region, projectId, total: results.length }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_list_jobs',
      operation: 'list Cloud Run jobs',
    });
  }
}
