import { RevisionsClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new RevisionsClient();

export const listRevisionsTool = {
  name: 'gcloud_list_revisions',
  description: 'List Cloud Run revisions for a service. Shows deployment history with image tags, creation times, and scaling config.',
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
      limit: {
        type: 'number',
        description: 'Maximum number of revisions to return. Default 10, max 50.',
        minimum: 1,
        maximum: 50,
      },
    },
    required: ['serviceName'],
  },
};

export interface ListRevisionsArgs {
  serviceName: string;
  region?: string;
  projectId?: string;
  limit?: number;
}

export async function handleListRevisions(args: ListRevisionsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;
    const limit = Math.min(args.limit || 10, 50);

    const parent = `projects/${projectId}/locations/${region}/services/${args.serviceName}`;

    const [revisions] = await client.listRevisions({ parent }, { autoPaginate: false });

    const results = (revisions || []).slice(0, limit).map((rev: any) => {
      const container = rev.containers?.[0];
      return {
        name: rev.name?.split('/').pop() || null,
        createTime: rev.createTime
          ? new Date(rev.createTime.seconds ? Number(rev.createTime.seconds) * 1000 : rev.createTime).toISOString()
          : null,
        image: container?.image || null,
        scaling: {
          minInstanceCount: rev.scaling?.minInstanceCount || 0,
          maxInstanceCount: rev.scaling?.maxInstanceCount || null,
        },
        resources: {
          cpu: container?.resources?.limits?.cpu || null,
          memory: container?.resources?.limits?.memory || null,
        },
        conditions: (rev.conditions || []).map((c: any) => ({
          type: c.type,
          state: c.state,
        })),
      };
    });

    return JSON.stringify({
      serviceName: args.serviceName,
      region,
      projectId,
      revisions: results,
      total: results.length,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_list_revisions',
      operation: 'list Cloud Run revisions',
      serviceName: args.serviceName,
    });
  }
}
