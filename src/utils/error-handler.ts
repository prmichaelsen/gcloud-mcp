import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger } from './logger.js';

export interface ErrorContext {
  toolName: string;
  operation: string;
  [key: string]: unknown;
}

export function handleToolError(error: unknown, context: ErrorContext): never {
  logger.error(`${context.toolName} failed: ${context.operation}`, error);

  if (error instanceof McpError) {
    throw error;
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('PERMISSION_DENIED') || message.includes('403')) {
    throw new McpError(
      ErrorCode.InternalError,
      `Permission denied for ${context.operation}. ` +
      `Ensure your account has the required IAM roles. ` +
      `Run the gcloud_whoami tool to check your current identity and permissions. ` +
      `Original error: ${message}`
    );
  }

  if (message.includes('NOT_FOUND') || message.includes('404')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Resource not found during ${context.operation}. ` +
      `Verify the project ID and resource identifiers are correct. ` +
      `Original error: ${message}`
    );
  }

  throw new McpError(
    ErrorCode.InternalError,
    `${context.operation} failed: ${message}`
  );
}
