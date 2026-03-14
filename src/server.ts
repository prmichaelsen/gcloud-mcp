import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { config, validateConfig } from './config.js';
import { logger } from './utils/logger.js';
import { listBuildsTool, handleListBuilds } from './tools/list-builds.js';
import { getBuildTool, handleGetBuild } from './tools/get-build.js';
import { getBuildLogsTool, handleGetBuildLogs } from './tools/get-build-logs.js';
import { gcloudWhoamiTool, handleGcloudWhoami } from './tools/gcloud-whoami.js';
import { listServicesTool, handleListServices } from './tools/list-services.js';
import { getServiceLogsTool, handleGetServiceLogs } from './tools/get-service-logs.js';
import { getServiceTool, handleGetService } from './tools/get-service.js';
import { listRevisionsTool, handleListRevisions } from './tools/list-revisions.js';
import { listTriggersTool, handleListTriggers } from './tools/list-triggers.js';
import { getTriggerTool, handleGetTrigger } from './tools/get-trigger.js';
import { listJobsTool, handleListJobs } from './tools/list-jobs.js';
import { getJobExecutionTool, handleGetJobExecution } from './tools/get-job-execution.js';
import { listArtifactsTool, handleListArtifacts } from './tools/list-artifacts.js';

async function initServer(): Promise<Server> {
  logger.info('Initializing gcloud-mcp server...');
  validateConfig();

  const server = new Server(
    { name: 'gcloud-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  registerHandlers(server);
  logger.info('Server initialized', { project: config.gcp.project });
  return server;
}

function registerHandlers(server: Server): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        listBuildsTool,
        getBuildTool,
        getBuildLogsTool,
        gcloudWhoamiTool,
        listServicesTool,
        getServiceLogsTool,
        getServiceTool,
        listRevisionsTool,
        listTriggersTool,
        getTriggerTool,
        listJobsTool,
        getJobExecutionTool,
        listArtifactsTool,
      ],
    };
  });

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
        case 'gcloud_list_triggers':
          result = await handleListTriggers(args as any);
          break;
        case 'gcloud_get_trigger':
          result = await handleGetTrigger(args as any);
          break;
        case 'gcloud_list_jobs':
          result = await handleListJobs(args as any);
          break;
        case 'gcloud_get_job_execution':
          result = await handleGetJobExecution(args as any);
          break;
        case 'gcloud_list_artifacts':
          result = await handleListArtifacts(args as any);
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      logger.error(`Tool execution failed for ${name}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });
}

function setupShutdownHandlers(server: Server): void {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    try {
      await server.close();
      logger.info('Server closed');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown error:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

async function main(): Promise<void> {
  try {
    const server = await initServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info('Server running on stdio transport');
    setupShutdownHandlers(server);
  } catch (error) {
    logger.error('Server startup failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
