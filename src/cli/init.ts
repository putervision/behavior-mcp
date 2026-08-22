import * as fs from 'fs';
import * as path from 'path';
import { getAgentsMdTemplate } from './templates.js';
import { registerProject, resolveProjectRoot, getProjectSlug, getDb } from '../engine/db.js';
import { BehaviorRegistry } from '../engine/behaviors.js';

export function upsertInstructionBlock(
  content: string,
  newBlock: string,
  startMarker = '<!-- behavior-runtime-mcp:start -->',
  endMarker = '<!-- behavior-runtime-mcp:end -->'
): { updatedContent: string; status: 'updated' | 'appended' | 'unchanged' } {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + endMarker.length);
    const existingBlock = content.substring(startIndex, endIndex + endMarker.length);
    if (existingBlock.trim() === newBlock.trim()) {
      return { updatedContent: content, status: 'unchanged' };
    }
    return { updatedContent: `${before}${newBlock.trim()}${after}`, status: 'updated' };
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return { updatedContent: `${content}${separator}${newBlock.trim()}\n`, status: 'appended' };
}

export function runInit(options: { project?: string; cwd?: string } = {}): void {
  const cwd = options.cwd || process.cwd();
  const root = resolveProjectRoot(options.project, cwd);
  const slug = getProjectSlug(options.project, cwd);

  console.log(`Initializing behavior-runtime-mcp in: ${root} (project slug: ${slug})`);

  registerProject(slug, root);
  const db = getDb(slug, root);
  console.log('✔ SQLite behavior runtime database initialized with WAL mode.');

  // Seed built-in behaviors
  const coreDir = path.resolve(root, 'src', 'behaviors', 'core');
  if (fs.existsSync(coreDir)) {
    for (const f of fs.readdirSync(coreDir)) {
      if (f.endsWith('.json')) {
        const raw = fs.readFileSync(path.join(coreDir, f), 'utf-8');
        const tree = JSON.parse(raw);
        BehaviorRegistry.registerBehavior(db, { project: slug, name: tree.id || path.basename(f, '.json'), tree });
      }
    }
  }

  const agentsPath = path.join(root, '.agents', 'AGENTS.md');
  const dir = path.dirname(agentsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const existingContent = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf-8') : '';
  const result = upsertInstructionBlock(existingContent, getAgentsMdTemplate());
  fs.writeFileSync(agentsPath, result.updatedContent, 'utf-8');
  console.log(`✔ Agent instructions ${result.status} in ${agentsPath}`);

  console.log('\nbehavior-runtime-mcp initialization complete!');
}
