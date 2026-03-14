import { Logging } from '@google-cloud/logging';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const logging = new Logging();

export const getBuildLogsTool = {
  name: 'gcloud_get_build_logs',
  description: 'Fetch Cloud Build logs from Cloud Logging. Supports step filtering and line limits.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      buildId: {
        type: 'string',
        description: 'The Cloud Build build ID.',
      },
      stepName: {
        type: 'string',
        description: 'Optional: filter logs to a specific build step name.',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of log lines to return. Default 100.',
        minimum: 1,
        maximum: 1000,
      },
      tail: {
        type: 'boolean',
        description: 'If true, return the last N lines instead of the first N. Default false.',
      },
    },
    required: ['buildId'],
  },
};

export interface GetBuildLogsArgs {
  projectId?: string;
  buildId: string;
  stepName?: string;
  limit?: number;
  tail?: boolean;
}

export async function handleGetBuildLogs(args: GetBuildLogsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const limit = args.limit || 100;

    let filter = `resource.type="build" AND resource.labels.build_id="${args.buildId}"`;
    if (args.stepName) {
      filter += ` AND labels.build_step="${args.stepName}"`;
    }

    const [entries] = await logging.getEntries({
      filter: `logName="projects/${projectId}/logs/cloudbuild" AND ${filter}`,
      orderBy: args.tail ? 'timestamp desc' : 'timestamp asc',
      pageSize: limit,
    });

    let logLines = entries.map((entry: any) => ({
      timestamp: entry.metadata?.timestamp || null,
      severity: entry.metadata?.severity || 'DEFAULT',
      text: typeof entry.data === 'string'
        ? entry.data
        : entry.data?.textPayload || JSON.stringify(entry.data),
    }));

    if (args.tail) {
      logLines = logLines.reverse();
    }

    return JSON.stringify({
      buildId: args.buildId,
      stepFilter: args.stepName || null,
      lineCount: logLines.length,
      logs: logLines,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'get_build_logs',
      operation: 'fetch Cloud Build logs',
      buildId: args.buildId,
    });
  }
}
