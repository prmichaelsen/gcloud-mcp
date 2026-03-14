import { ServicesClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ServicesClient();

export const listServicesTool = {
  name: 'gcloud_list_services',
  description: 'List Cloud Run services in a given region. Returns URL, latest revision, status, and last deployed timestamp for each service.',
  inputSchema: {
    type: 'object',
    properties: {
      region: {
        type: 'string',
        description: 'GCP region (e.g. "us-central1"). Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: [],
  },
};

export interface ListServicesArgs {
  region?: string;
  projectId?: string;
}

export async function handleListServices(args: ListServicesArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;

    const parent = `projects/${projectId}/locations/${region}`;

    const [services] = await client.listServices({ parent });

    const results = (services || []).map((service: any) => {
      const name = service.name?.split('/').pop() || service.name;
      const conditions = service.conditions || [];
      const readyCondition = conditions.find((c: any) => c.type === 'Ready');

      return {
        name,
        url: service.uri || null,
        latestRevision: service.latestReadyRevision?.split('/').pop() || null,
        status: readyCondition?.state || 'UNKNOWN',
        lastDeployed: service.updateTime
          ? new Date(service.updateTime.seconds ? Number(service.updateTime.seconds) * 1000 : service.updateTime).toISOString()
          : null,
      };
    });

    return JSON.stringify({ services: results, region, projectId, total: results.length }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'list_services',
      operation: 'list Cloud Run services',
    });
  }
}
