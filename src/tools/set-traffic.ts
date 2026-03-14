import { ServicesClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ServicesClient();

export const setTrafficTool = {
  name: 'gcloud_set_traffic',
  description: 'Set traffic splitting between Cloud Run revisions. Useful for canary deployments and rollbacks. WARNING: This modifies live traffic — use with care.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the Cloud Run service.',
      },
      traffic: {
        type: 'array',
        description: 'Traffic allocation. Each entry has revision (name or "LATEST") and percent (0-100). Must sum to 100.',
        items: {
          type: 'object',
          properties: {
            revision: {
              type: 'string',
              description: 'Revision name or "LATEST" for latest ready revision.',
            },
            percent: {
              type: 'number',
              description: 'Traffic percentage (0-100).',
            },
          },
          required: ['revision', 'percent'],
        },
      },
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: ['serviceName', 'traffic'],
  },
};

export interface TrafficEntry {
  revision: string;
  percent: number;
}

export interface SetTrafficArgs {
  serviceName: string;
  traffic: TrafficEntry[];
  region?: string;
  projectId?: string;
}

export async function handleSetTraffic(args: SetTrafficArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;
    const name = `projects/${projectId}/locations/${region}/services/${args.serviceName}`;

    // Validate traffic sums to 100
    const totalPercent = args.traffic.reduce((sum, t) => sum + t.percent, 0);
    if (totalPercent !== 100) {
      throw new Error(`Traffic percentages must sum to 100, got ${totalPercent}`);
    }

    // Get current service
    const [current] = await client.getService({ name });

    // Build traffic config
    current.traffic = args.traffic.map((t) => {
      if (t.revision === 'LATEST') {
        return {
          type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST' as const,
          percent: t.percent,
        };
      }
      return {
        type: 'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION' as const,
        revision: `projects/${projectId}/locations/${region}/services/${args.serviceName}/revisions/${t.revision}`,
        percent: t.percent,
      };
    });

    const [operation] = await client.updateService({
      service: current,
    });

    const [updated] = await operation.promise();

    const resultTraffic = ((updated as any).traffic || []).map((t: any) => ({
      revision: t.revision?.split('/').pop() || 'LATEST',
      type: t.type,
      percent: t.percent,
    }));

    const result = {
      updated: true,
      serviceName: args.serviceName,
      region,
      projectId,
      traffic: resultTraffic,
      message: `Traffic updated for ${args.serviceName}. Use gcloud_get_service to verify.`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_set_traffic',
      operation: 'set Cloud Run traffic',
      serviceName: args.serviceName,
    });
  }
}
