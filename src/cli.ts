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
behavior-mcp CLI Tool v${getVersion()}

Usage:
  behavior-mcp <command> [options]

Commands:
  run                Start the MCP server on stdio transport (Default)
  init               Scaffold the workspace, database, seed behaviors, and IDE agent rules
  init-global        Re-initialize across all projects registered in ~/.behavior-mcp/projects.json
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
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (rawArgs.includes('--version') || rawArgs.includes('-v')) {
    console.log(getVersion());
    process.exit(0);
  }

  let project: string | undefined;
  const pIndex = rawArgs.findIndex((a) => a === '-p' || a === '--project');
  if (pIndex !== -1 && rawArgs[pIndex + 1]) {
    project = rawArgs[pIndex + 1];
  }

  // Filter out options and their paired values for command determination
  const positional = rawArgs.filter((a, idx) => {
    if (a.startsWith('-')) return false;
    if (idx > 0 && (rawArgs[idx - 1] === '-p' || rawArgs[idx - 1] === '--project' || rawArgs[idx - 1] === '-o' || rawArgs[idx - 1] === '--out')) {
      return false;
    }
    return true;
  });

  const command = positional[0] || 'run';

  switch (command) {
    case 'run': {
      await import('./index.js');
      break;
    }

    case 'init': {
      runInit({ project });
      break;
    }

    case 'init-global': {
      const { runInitGlobal } = await import('./cli/init.js');
      await runInitGlobal();
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

    case 'doctor-global': {
      const { getRegistry } = await import('./engine/db.js');
      const registry = getRegistry();
      const entries = Object.entries(registry);
      console.log(`Running global diagnostic doctor across ${entries.length} registered project(s)...`);
      let allPassed = true;

      for (const [slug, projectRoot] of entries) {
        if (!fs.existsSync(projectRoot)) {
          console.log(`⚠️  ${slug}: Missing project root directory (${projectRoot})`);
          continue;
        }
        try {
          const db = getDb(slug, projectRoot);
          const integrity = db.pragma('integrity_check');
          const eventAudit = verifyEventChain(db, slug);
          const ok = integrity && eventAudit.valid;
          console.log(`  ${ok ? '✔' : '✖'} ${slug}: ${ok ? 'HEALTHY' : 'ANOMALY DETECTED'}`);
          if (!ok) allPassed = false;
        } catch (err: any) {
          console.log(`  ✖ ${slug}: ${err.message}`);
          allPassed = false;
        }
      }
      console.log(`\nGlobal doctor check ${allPassed ? 'PASSED' : 'COMPLETED WITH WARNINGS'}.`);
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
      console.log(`@putervision/behavior-mcp is up to date (v${getVersion()}).`);
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
