import { ServicesClient } from '@google-cloud/run';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ServicesClient();

export const deployServiceTool = {
  name: 'gcloud_deploy_service',
  description: 'Deploy a new revision to a Cloud Run service by updating the container image. WARNING: This modifies a live service — use with care.',
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'Name of the Cloud Run service to deploy to.',
      },
      image: {
        type: 'string',
        description: 'Container image to deploy (e.g. "gcr.io/project/image:tag").',
      },
      region: {
        type: 'string',
        description: 'GCP region. Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      env: {
        type: 'object',
        description: 'Environment variables to set (key-value pairs). Merges with existing.',
        additionalProperties: { type: 'string' },
      },
      memory: {
        type: 'string',
        description: 'Memory limit (e.g. "512Mi", "1Gi").',
      },
      cpu: {
        type: 'string',
        description: 'CPU limit (e.g. "1", "2").',
      },
      minInstances: {
        type: 'number',
        description: 'Minimum number of instances.',
      },
      maxInstances: {
        type: 'number',
        description: 'Maximum number of instances.',
      },
    },
    required: ['serviceName', 'image'],
  },
};

export interface DeployServiceArgs {
  serviceName: string;
  image: string;
  region?: string;
  projectId?: string;
  env?: Record<string, string>;
  memory?: string;
  cpu?: string;
  minInstances?: number;
  maxInstances?: number;
}

export async function handleDeployService(args: DeployServiceArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;
    const name = `projects/${projectId}/locations/${region}/services/${args.serviceName}`;

    // Get current service to preserve existing config
    const [current] = await client.getService({ name });
    const template = current.template || {};
    const container = template.containers?.[0] || {};

    // Update image
    container.image = args.image;

    // Update resources if specified
    if (args.memory || args.cpu) {
      container.resources = container.resources || {};
      container.resources.limits = container.resources.limits || {};
      if (args.memory) container.resources.limits.memory = args.memory;
      if (args.cpu) container.resources.limits.cpu = args.cpu;
    }

    // Merge env vars if specified
    if (args.env) {
      const existingEnv = (container.env || []) as any[];
      for (const [key, value] of Object.entries(args.env)) {
        const existing = existingEnv.find((e: any) => e.name === key);
        if (existing) {
          existing.value = value;
          delete existing.valueSource;
        } else {
          existingEnv.push({ name: key, value });
        }
      }
      container.env = existingEnv;
    }

    // Update scaling if specified
    if (args.minInstances !== undefined || args.maxInstances !== undefined) {
      template.scaling = template.scaling || {};
      if (args.minInstances !== undefined) template.scaling.minInstanceCount = args.minInstances;
      if (args.maxInstances !== undefined) template.scaling.maxInstanceCount = args.maxInstances;
    }

    template.containers = [container];
    current.template = template;

    const [operation] = await client.updateService({
      service: current,
    });

    const [updated] = await operation.promise();

    const result = {
      deployed: true,
      serviceName: args.serviceName,
      image: args.image,
      region,
      projectId,
      newRevision: (updated as any).latestReadyRevision?.split('/').pop() || null,
      url: (updated as any).uri || null,
      message: `Successfully deployed ${args.image} to ${args.serviceName}. Use gcloud_get_service to verify.`,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_deploy_service',
      operation: 'deploy Cloud Run service',
      serviceName: args.serviceName,
    });
  }
}
