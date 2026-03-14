import { ServicesClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ServicesClient();

export const getServiceTool = {
  name: 'gcloud_get_service',
  description: 'Get full Cloud Run service details including URL, env vars, resource limits, scaling config, traffic splits, and latest revision.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the Cloud Run service.',
      },
      region: {
        type: 'string',
        description: 'GCP region (e.g. "us-central1"). Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
    },
    required: ['serviceName'],
  },
};

export interface GetServiceArgs {
  serviceName: string;
  region?: string;
  projectId?: string;
}

export async function handleGetService(args: GetServiceArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;

    const name = `projects/${projectId}/locations/${region}/services/${args.serviceName}`;
    const [service] = await client.getService({ name });

    const template = service.template;
    const container = template?.containers?.[0];

    const result = {
      name: service.name?.split('/').pop(),
      url: service.uri || null,
      latestRevision: service.latestReadyRevision?.split('/').pop() || null,
      status: service.conditions?.find((c: any) => c.type === 'Ready')?.state || 'UNKNOWN',
      lastDeployed: service.updateTime
        ? new Date(service.updateTime.seconds ? Number(service.updateTime.seconds) * 1000 : service.updateTime as any).toISOString()
        : null,
      created: service.createTime
        ? new Date(service.createTime.seconds ? Number(service.createTime.seconds) * 1000 : service.createTime as any).toISOString()
        : null,
      creator: service.creator || null,
      ingress: service.ingress || null,
      launchStage: service.launchStage || null,
      template: {
        revision: template?.revision?.split('/').pop() || null,
        scaling: {
          minInstanceCount: template?.scaling?.minInstanceCount || 0,
          maxInstanceCount: template?.scaling?.maxInstanceCount || null,
        },
        timeout: template?.timeout?.seconds ? `${template.timeout.seconds}s` : null,
        serviceAccount: template?.serviceAccount || null,
        containers: container ? [{
          image: container.image || null,
          resources: {
            cpu: container.resources?.limits?.cpu || null,
            memory: container.resources?.limits?.memory || null,
          },
          env: (container.env || []).map((e: any) => ({
            name: e.name,
            value: e.value || undefined,
            secretRef: e.valueSource?.secretKeyRef ? {
              secret: e.valueSource.secretKeyRef.secret,
              version: e.valueSource.secretKeyRef.version,
            } : undefined,
          })),
          ports: (container.ports || []).map((p: any) => ({
            name: p.name,
            containerPort: p.containerPort,
          })),
        }] : [],
      },
      traffic: (service.traffic || []).map((t: any) => ({
        revision: t.revision?.split('/').pop() || null,
        type: t.type || null,
        percent: t.percent || 0,
      })),
      conditions: (service.conditions || []).map((c: any) => ({
        type: c.type,
        state: c.state,
        message: c.message || null,
      })),
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_get_service',
      operation: 'get Cloud Run service details',
      serviceName: args.serviceName,
    });
  }
}
