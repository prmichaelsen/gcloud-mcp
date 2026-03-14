import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new CloudBuildClient();

export const getBuildTool = {
  name: 'get_build',
  description: 'Get full Cloud Build details including steps, substitutions, images, and per-step timing breakdown.',
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
    },
    required: ['buildId'],
  },
};

export interface GetBuildArgs {
  projectId?: string;
  buildId: string;
}

export async function handleGetBuild(args: GetBuildArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;

    const [build] = await client.getBuild({
      projectId,
      id: args.buildId,
    });

    const steps = (build.steps || []).map((step) => ({
      name: step.name,
      id: step.id,
      status: step.status,
      args: step.args,
      startTime: step.timing?.startTime?.seconds
        ? new Date(Number(step.timing.startTime.seconds) * 1000).toISOString()
        : null,
      endTime: step.timing?.endTime?.seconds
        ? new Date(Number(step.timing.endTime.seconds) * 1000).toISOString()
        : null,
      duration: step.timing?.startTime?.seconds && step.timing?.endTime?.seconds
        ? `${Number(step.timing.endTime.seconds) - Number(step.timing.startTime.seconds)}s`
        : null,
    }));

    const result = {
      id: build.id,
      status: build.status,
      statusDetail: build.statusDetail,
      source: build.source,
      steps,
      substitutions: build.substitutions || {},
      images: build.images || [],
      buildTriggerId: build.buildTriggerId,
      logUrl: build.logUrl,
      createTime: build.createTime?.seconds
        ? new Date(Number(build.createTime.seconds) * 1000).toISOString()
        : null,
      startTime: build.startTime?.seconds
        ? new Date(Number(build.startTime.seconds) * 1000).toISOString()
        : null,
      finishTime: build.finishTime?.seconds
        ? new Date(Number(build.finishTime.seconds) * 1000).toISOString()
        : null,
      duration: build.startTime?.seconds && build.finishTime?.seconds
        ? `${Number(build.finishTime.seconds) - Number(build.startTime.seconds)}s`
        : null,
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'get_build',
      operation: 'get Cloud Build details',
      buildId: args.buildId,
    });
  }
}
