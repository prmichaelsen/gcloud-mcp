import { Logging } from '@google-cloud/logging';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';
import { parseDuration } from '../utils/parse-duration.js';

const logging = new Logging();

export const getServiceLogsTool = {
  name: 'gcloud_get_service_logs',
  description: 'Retrieve recent log entries for a Cloud Run service from Cloud Logging. Supports severity, time range, revision, and limit filters.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the Cloud Run service.',
      },
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      severity: {
        type: 'string',
        enum: ['DEFAULT', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
        description: 'Minimum log severity to filter by.',
      },
      since: {
        type: 'string',
        description: 'Time range to look back (e.g. "1h", "30m", "2d"). Default "1h".',
      },
      revision: {
        type: 'string',
        description: 'Filter logs to a specific revision name.',
      },
      limit: {
        type: 'number',
        description: 'Max number of log entries to return. Default 50, max 500.',
        minimum: 1,
        maximum: 500,
      },
    },
    required: ['serviceName'],
  },
};

export interface GetServiceLogsArgs {
  serviceName: string;
  region?: string;
  projectId?: string;
  severity?: string;
  since?: string;
  revision?: string;
  limit?: number;
}

export async function handleGetServiceLogs(args: GetServiceLogsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;
    const limit = Math.min(args.limit || 50, 500);
    const since = args.since || '1h';

    const sinceMs = parseDuration(since);
    const sinceTimestamp = new Date(Date.now() - sinceMs).toISOString();

    const filterParts = [
      `resource.type="cloud_run_revision"`,
      `resource.labels.service_name="${args.serviceName}"`,
      `resource.labels.location="${region}"`,
      `timestamp >= "${sinceTimestamp}"`,
    ];

    if (args.severity) {
      filterParts.push(`severity >= ${args.severity}`);
    }
    if (args.revision) {
      filterParts.push(`resource.labels.revision_name="${args.revision}"`);
    }

    const filter = filterParts.join(' AND ');

    const [entries] = await logging.getEntries({
      filter,
      orderBy: 'timestamp desc',
      pageSize: limit,
      autoPaginate: false,
    });

    const logEntries = entries.reverse().map((entry: any) => ({
      timestamp: entry.metadata?.timestamp || null,
      severity: entry.metadata?.severity || 'DEFAULT',
      revision: entry.metadata?.resource?.labels?.revision_name || null,
      text: typeof entry.data === 'string'
        ? entry.data
        : entry.data?.textPayload || entry.data?.message || JSON.stringify(entry.data),
    }));

    return JSON.stringify({
      serviceName: args.serviceName,
      region,
      projectId,
      since,
      severityFilter: args.severity || null,
      revisionFilter: args.revision || null,
      lineCount: logEntries.length,
      logs: logEntries,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'get_service_logs',
      operation: 'fetch Cloud Run service logs',
      serviceName: args.serviceName,
    });
  }
}
