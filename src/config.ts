import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gcp: {
    project: process.env.GOOGLE_CLOUD_PROJECT || '',
    region: process.env.GOOGLE_CLOUD_REGION || 'us-central1',
  },
  server: {
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

export function validateConfig(): void {
  if (!config.gcp.project) {
    throw new Error(
      'Missing required environment variable: GOOGLE_CLOUD_PROJECT. ' +
      'Set it in your .env file or environment: export GOOGLE_CLOUD_PROJECT=your-project-id'
    );
  }
}
