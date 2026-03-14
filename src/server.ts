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

// Tool imports will be added in Tasks 3 and 4

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
        // Tools registered here in Tasks 3 and 4
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        // Tool cases added in Tasks 3 and 4
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
