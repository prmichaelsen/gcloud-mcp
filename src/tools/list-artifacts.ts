import { ArtifactRegistryClient } from '@google-cloud/artifact-registry';
import { config } from '../config.js';
import { handleToolError } from '../utils/error-handler.js';

const client = new ArtifactRegistryClient();

export const listArtifactsTool = {
  name: 'gcloud_list_artifacts',
  description: 'List Docker images in an Artifact Registry or GCR repository. Shows image tags, upload time, and size.',
  inputSchema: {
    type: 'object',
    properties: {
      repository: {
        type: 'string',
        description: 'Repository name (e.g. "my-repo"). If omitted, lists all repositories in the location.',
      },
      region: {
        type: 'string',
        description: 'GCP region (e.g. "us-central1", "us"). Defaults to GOOGLE_CLOUD_REGION env var.',
      },
      projectId: {
        type: 'string',
        description: 'GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var.',
      },
      limit: {
        type: 'number',
        description: 'Max images to return. Default 10, max 50.',
        minimum: 1,
        maximum: 50,
      },
    },
    required: [],
  },
};

export interface ListArtifactsArgs {
  repository?: string;
  region?: string;
  projectId?: string;
  limit?: number;
}

export async function handleListArtifacts(args: ListArtifactsArgs): Promise<string> {
  try {
    const projectId = args.projectId || config.gcp.project;
    const region = args.region || config.gcp.region;
    const limit = Math.min(args.limit || 10, 50);

    if (!args.repository) {
      // List repositories
      const parent = `projects/${projectId}/locations/${region}`;
      const [repos] = await client.listRepositories({ parent }, { autoPaginate: false });

      const results = (repos || []).map((repo: any) => ({
        name: repo.name?.split('/').pop() || null,
        format: repo.format || null,
        description: repo.description || null,
        createTime: repo.createTime?.seconds
          ? new Date(Number(repo.createTime.seconds) * 1000).toISOString()
          : null,
        updateTime: repo.updateTime?.seconds
          ? new Date(Number(repo.updateTime.seconds) * 1000).toISOString()
          : null,
      }));

      return JSON.stringify({ repositories: results, region, projectId, total: results.length }, null, 2);
    }

    // List Docker images in repository
    const parent = `projects/${projectId}/locations/${region}/repositories/${args.repository}`;
    const [images] = await client.listDockerImages({ parent }, { autoPaginate: false });

    const results = (images || []).slice(0, limit).map((image: any) => ({
      name: image.name?.split('/').pop() || null,
      uri: image.uri || null,
      tags: image.tags || [],
      uploadTime: image.uploadTime?.seconds
        ? new Date(Number(image.uploadTime.seconds) * 1000).toISOString()
        : null,
      buildTime: image.buildTime?.seconds
        ? new Date(Number(image.buildTime.seconds) * 1000).toISOString()
        : null,
      imageSizeBytes: image.imageSizeBytes ? `${(Number(image.imageSizeBytes) / 1024 / 1024).toFixed(1)}MB` : null,
      mediaType: image.mediaType || null,
    }));

    return JSON.stringify({
      repository: args.repository,
      region,
      projectId,
      images: results,
      total: results.length,
    }, null, 2);
  } catch (error) {
    handleToolError(error, {
      toolName: 'gcloud_list_artifacts',
      operation: 'list Artifact Registry images',
    });
  }
}
