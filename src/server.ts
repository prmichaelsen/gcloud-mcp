#!/usr/bin/env node

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
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'list_builds':
          result = await handleListBuilds(args as any);
          break;
        case 'get_build':
          result = await handleGetBuild(args as any);
          break;
        case 'get_build_logs':
          result = await handleGetBuildLogs(args as any);
          break;
        case 'gcloud_whoami':
          result = await handleGcloudWhoami(args as any);
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
