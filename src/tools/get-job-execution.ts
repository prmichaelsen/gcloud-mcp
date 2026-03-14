import { ExecutionsClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ExecutionsClient();

export const getJobExecutionTool = {
  name: 'gcloud_get_job_execution',
  description: 'Get Cloud Run Job execution details including task counts, status, timing, and log URI.',
  inputSchema: {
    type: 'object',
    properties: {
      jobName: {
        type: 'string',
        description: 'Name of the Cloud Run Job.',
      },
      executionName: {
        type: 'string',
        description: 'Name of the execution (e.g. "my-job-abc12"). If omitted, lists recent executions.',
      },
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      limit: {
        type: 'number',
        description: 'Max executions to list (when executionName omitted). Default 5, max 20.',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['jobName'],
  },
};

export interface GetJobExecutionArgs {
  jobName: string;
  executionName?: string;
  region?: string;
  projectId?: string;
  limit?: number;
}

export async function handleGetJobExecution(args: GetJobExecutionArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;

    if (args.executionName) {
      const name = `projects/${projectId}/locations/${region}/jobs/${args.jobName}/executions/${args.executionName}`;
      const [execution] = await client.getExecution({ name });

      return JSON.stringify(formatExecution(execution), null, 2);
    }

    // List recent executions
    const parent = `projects/${projectId}/locations/${region}/jobs/${args.jobName}`;
    const limit = Math.min(args.limit || 5, 20);
    const [executions] = await client.listExecutions({ parent }, { autoPaginate: false });

    const results = (executions || []).slice(0, limit).map(formatExecution);

    return JSON.stringify({
      jobName: args.jobName,
      region,
      projectId,
      executions: results,
      total: results.length,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_get_job_execution',
      operation: 'get Cloud Run job execution',
      jobName: args.jobName,
    });
  }
}

function formatExecution(exec: any) {
  return {
    name: exec.name?.split('/').pop() || null,
    job: exec.job?.split('/').pop() || null,
    createTime: exec.createTime?.seconds
      ? new Date(Number(exec.createTime.seconds) * 1000).toISOString()
      : null,
    startTime: exec.startTime?.seconds
      ? new Date(Number(exec.startTime.seconds) * 1000).toISOString()
      : null,
    completionTime: exec.completionTime?.seconds
      ? new Date(Number(exec.completionTime.seconds) * 1000).toISOString()
      : null,
    taskCount: exec.taskCount || 0,
    runningCount: exec.runningCount || 0,
    succeededCount: exec.succeededCount || 0,
    failedCount: exec.failedCount || 0,
    cancelledCount: exec.cancelledCount || 0,
    retriedCount: exec.retriedCount || 0,
    logUri: exec.logUri || null,
    conditions: (exec.conditions || []).map((c: any) => ({
      type: c.type,
      state: c.state,
      message: c.message || null,
    })),
  };
}
