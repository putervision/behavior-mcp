import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { server } from './server.js';
import { logger } from './utils/logger.js';
import { closeAllDbs } from './engine/db.js';

async function main() {
  const transport = new StdioServerTransport();

  const shutdown = () => {
    logger.info('Shutting down behavior-runtime-mcp server...');
    closeAllDbs();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.stdin.on('close', shutdown);

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught exception: ${err.message}`, err.stack);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });

  logger.info('Starting behavior-runtime-mcp stdio transport...');
  await server.connect(transport);
  logger.info('behavior-runtime-mcp server connected and listening on stdio');
}

main().catch((err) => {
  logger.error(`Fatal error in main: ${err.message}`, err.stack);
  process.exit(1);
});
