import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';

// Import all tools
import { listBuildsTool, handleListBuilds } from './tools/list-builds.js';
import { getBuildTool, handleGetBuild } from './tools/get-build.js';
import { getBuildLogsTool, handleGetBuildLogs } from './tools/get-build-logs.js';
import { gcloudWhoamiTool, handleGcloudWhoami } from './tools/gcloud-whoami.js';
import { listServicesTool, handleListServices } from './tools/list-services.js';
import { getServiceLogsTool, handleGetServiceLogs } from './tools/get-service-logs.js';
import { getServiceTool, handleGetService } from './tools/get-service.js';
import { listRevisionsTool, handleListRevisions } from './tools/list-revisions.js';

export interface ServerOptions {
  name?: string;
  version?: string;
}

// Global initialization flag
let gcpClientsInitialized = false;
let initializationPromise: Promise<void> | null = null;

async function ensureGcpClientsInitialized(): Promise<void> {
  if (gcpClientsInitialized) return;
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    try {
      logger.info('Initializing GCP clients...');
      gcpClientsInitialized = true;
      logger.info('GCP clients initialized successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('GCP client initialization failed', { error: msg });
      throw new Error(`GCP client initialization failed: ${msg}`);
    } finally {
      initializationPromise = null;
    }
  })();

  return initializationPromise;
}

/**
 * Create a server instance for a specific user/tenant.
 *
 * Compatible with @prmichaelsen/mcp-auth wrapServer().
 *
 * @param accessToken - User's access token (from mcp-auth, not used for GCP)
 * @param userId - User identifier for scoping operations
 * @param options - Optional server configuration
 * @returns Configured MCP Server instance (not connected to transport)
 */
export async function createServer(
  accessToken: string,
  userId: string,
  options: ServerOptions = {}
): Promise<Server> {
  if (!userId) {
    throw new Error('userId is required');
  }

  logger.debug('Creating server instance', { userId });

  await ensureGcpClientsInitialized();

  const server = new Server(
    {
      name: options.name || 'gcloud-mcp',
      version: options.version || '0.1.0',
    },
    {
      capabilities: { tools: {} },
    }
  );

  registerHandlers(server, userId);
  return server;
}

function registerHandlers(server: Server, userId: string): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      listBuildsTool,
      getBuildTool,
      getBuildLogsTool,
      gcloudWhoamiTool,
      listServicesTool,
      getServiceLogsTool,
      getServiceTool,
      listRevisionsTool,
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'gcloud_list_builds':
          result = await handleListBuilds(args as any);
          break;
        case 'gcloud_get_build':
          result = await handleGetBuild(args as any);
          break;
        case 'gcloud_get_build_logs':
          result = await handleGetBuildLogs(args as any);
          break;
        case 'gcloud_whoami':
          result = await handleGcloudWhoami(args as any);
          break;
        case 'gcloud_list_services':
          result = await handleListServices(args as any);
          break;
        case 'gcloud_get_service_logs':
          result = await handleGetServiceLogs(args as any);
          break;
        case 'gcloud_get_service':
          result = await handleGetService(args as any);
          break;
        case 'gcloud_list_revisions':
          result = await handleListRevisions(args as any);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      if (error instanceof McpError) throw error;
      logger.error(`Tool execution failed for ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}
