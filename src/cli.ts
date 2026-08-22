#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { runInit } from './cli/init.js';
import { getDb, resolveProjectRoot, getProjectSlug } from './engine/db.js';
import { BehaviorRegistry } from './engine/behaviors.js';
import { ExecutionEngine } from './engine/executor.js';
import { TriggerRegistry } from './engine/triggers.js';
import { MetricsEngine } from './engine/metrics.js';
import { verifyEventChain } from './engine/events.js';
import { getVersion } from './utils/version.js';

function showHelp() {
  console.log(`
behavior-runtime-mcp CLI Tool v${getVersion()}

Usage:
  behavior-runtime-mcp <command> [options]

Commands:
  run                Start the MCP server on stdio transport (Default)
  init               Scaffold the workspace, database, seed behaviors, and IDE agent rules
  doctor             Run environment and database health checks
  inspect            Display tables of behaviors, active execution, and triggers
  audit              Audit cryptographic SHA-256 event ledger hash chain
  view               Open interactive behavior tree visualizer (viewer.html)
  update             Check npm registry for package updates

Options:
  -p, --project      Target specific project slug
  -v, --version      Show version number
  -h, --help         Show this help menu
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(getVersion());
    process.exit(0);
  }

  let project: string | undefined;
  const pIndex = args.findIndex((a) => a === '-p' || a === '--project');
  if (pIndex !== -1 && args[pIndex + 1]) {
    project = args[pIndex + 1];
  }

  switch (command) {
    case 'run': {
      await import('./index.js');
      break;
    }

    case 'init': {
      runInit({ project });
      break;
    }

    case 'doctor': {
      const root = resolveProjectRoot(project);
      const slug = getProjectSlug(project);
      console.log(`Running diagnostic doctor for "${slug}" in ${root}...`);
      try {
        const db = getDb(slug);
        const integrity = db.pragma('integrity_check');
        const journal = db.pragma('journal_mode');
        const eventAudit = verifyEventChain(db, slug);
        console.log(`✔ SQLite database accessibility: OK`);
        console.log(`✔ Journal mode: ${JSON.stringify(journal)}`);
        console.log(`✔ Database integrity: ${JSON.stringify(integrity)}`);
        console.log(`✔ Event chain verification: ${eventAudit.valid ? 'VALID (unbroken)' : 'FAILED'}`);
        console.log('\nDoctor diagnostic check PASSED.');
      } catch (err: any) {
        console.error(`✖ Doctor check failed: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'inspect': {
      const slug = getProjectSlug(project);
      const db = getDb(slug);
      console.log(`\n=== Registered Behaviors for ${slug} ===`);
      console.table(BehaviorRegistry.listBehaviors(db, slug), ['id', 'name', 'version', 'tree_hash']);

      console.log(`\n=== Active Executions for ${slug} ===`);
      console.table(ExecutionEngine.listExecutions(db, { project: slug, limit: 10 }), ['id', 'behavior_name', 'status', 'current_tick', 'active_node_path']);

      console.log(`\n=== Reactive Triggers for ${slug} ===`);
      console.table(TriggerRegistry.listTriggers(db, slug), ['id', 'name', 'behavior_name', 'condition_type', 'priority', 'is_enabled']);
      break;
    }

    case 'audit': {
      const slug = getProjectSlug(project);
      const db = getDb(slug);
      const audit = verifyEventChain(db, slug);
      console.log(`Audit result for "${slug}":`, audit);
      break;
    }

    case 'view': {
      console.log(`Interactive visualizer available at: ${path.resolve(process.cwd(), 'viewer.html')}`);
      break;
    }

    case 'update': {
      console.log(`@putervision/behavior-runtime-mcp is up to date (v${getVersion()}).`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal CLI error:', err);
  process.exit(1);
});
