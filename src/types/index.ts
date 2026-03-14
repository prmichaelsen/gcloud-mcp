/**
 * Common parameters shared across all gcloud-mcp tools.
 */
export interface CommonToolParams {
  /** GCP project ID. Defaults to GOOGLE_CLOUD_PROJECT env var. */
  projectId?: string;
}
