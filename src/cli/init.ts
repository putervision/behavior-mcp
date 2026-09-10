import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../utils/logger.js';
import {
  getAgentsMdTemplate,
  getInstructionsTemplate,
  getGlobalRulesTemplate,
  getMcpConfigCursor,
  getMcpConfigVscode,
  getMcpConfigAntigravity,
  getSkillTemplate,
} from './templates.js';
import { registerProject, resolveProjectRoot, getProjectSlug, getDb } from '../engine/db.js';
import { BehaviorRegistry } from '../engine/behaviors.js';
import { verifyEventChain } from '../engine/events.js';

export function upsertInstructionBlock(
  content: string,
  newBlock: string,
  startMarker = '<!-- behavior-mcp:start -->',
  endMarker = '<!-- behavior-mcp:end -->'
): { updatedContent: string; status: 'updated' | 'appended' | 'unchanged' } {
  // Check for new marker or legacy behavior-runtime-mcp marker
  let startIndex = content.indexOf(startMarker);
  let endIndex = content.indexOf(endMarker);
  let matchedEndMarker = endMarker;

  if (startIndex === -1) {
    const legacyStart = '<!-- behavior-runtime-mcp:start -->';
    const legacyEnd = '<!-- behavior-runtime-mcp:end -->';
    startIndex = content.indexOf(legacyStart);
    endIndex = content.indexOf(legacyEnd);
    matchedEndMarker = legacyEnd;
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + matchedEndMarker.length);
    const existingBlock = content.substring(startIndex, endIndex + matchedEndMarker.length);
    if (existingBlock.trim() === newBlock.trim()) {
      return { updatedContent: content, status: 'unchanged' };
    }
    return { updatedContent: `${before}${newBlock.trim()}${after}`, status: 'updated' };
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  return { updatedContent: `${content}${separator}${newBlock.trim()}\n`, status: 'appended' };
}

function mergeMcpConfig(
  root: string,
  relativePath: string,
  label: string,
  template: Record<string, any>,
  serversKey: string
): void {
  const filePath = path.join(root, relativePath);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const existing = JSON.parse(raw);
      if (existing[serversKey]?.['behavior-mcp']) {
        return;
      }
      if (!existing[serversKey]) existing[serversKey] = {};
      existing[serversKey]['behavior-mcp'] = template[serversKey]['behavior-mcp'];
      fs.writeFileSync(filePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');
    } catch {
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
    }
  } else {
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');
  }
}

export function runInit(options: { project?: string; cwd?: string } = {}): void {
  const cwd = options.cwd || process.cwd();
  const root = options.project ? resolveProjectRoot(options.project, cwd) : path.resolve(cwd);
  const slug = options.project
    ? getProjectSlug(options.project, cwd)
    : getProjectSlug(undefined, root);

  console.log('\n⚡ Initializing behavior-mcp...\n');

  // 1. Register project
  registerProject(slug, root);
  console.log(`   📁 Registered project "${slug}" in global registry (${root})`);

  // 2. Create data directory
  const dataDir = path.join(root, '.behavior-mcp', slug);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  }
  console.log(`   📦 Created local storage directory: .behavior-mcp/${slug}`);

  // 3. Update .gitignore
  const gitignorePath = path.join(root, '.gitignore');
  const ignoreEntry = '.behavior-mcp';
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    if (!content.includes(ignoreEntry)) {
      fs.appendFileSync(gitignorePath, `\n${ignoreEntry}\n`, 'utf-8');
      console.log(`   🛡️  Updated .gitignore (${ignoreEntry})`);
    }
  }

  // 4. Scaffold Agent Instructions
  const instructions = getInstructionsTemplate(slug);
  const targets = [
    '.agents/AGENTS.md',
    'CLAUDE.md',
    '.windsurfrules',
    '.cursor/rules/behavior-mcp.mdc',
    '.gemini/instructions.md',
    '.vscode/instructions.md',
    '.github/copilot-instructions.md',
  ];

  console.log('   📝 Scaffolding agent instruction contracts:');
  for (const t of targets) {
    const fullPath = path.join(root, t);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const { updatedContent, status } = upsertInstructionBlock(content, instructions);
      fs.writeFileSync(fullPath, updatedContent, 'utf-8');
      console.log(`      - ${t} (${status})`);
    } else {
      fs.writeFileSync(fullPath, instructions.trim() + '\n', 'utf-8');
      console.log(`      - ${t} (created)`);
    }
  }

  // 5. Scaffold Antigravity Skill
  const skillContent = getSkillTemplate(slug);
  const localSkillDir = path.join(root, '.agents/skills/behavior-mcp');
  if (!fs.existsSync(localSkillDir)) fs.mkdirSync(localSkillDir, { recursive: true });
  fs.writeFileSync(path.join(localSkillDir, 'SKILL.md'), skillContent, 'utf-8');

  const homedir = os.homedir();
  const globalSkillDir = path.join(homedir, '.gemini/config/skills/behavior-mcp');
  try {
    if (!fs.existsSync(globalSkillDir)) fs.mkdirSync(globalSkillDir, { recursive: true });
    fs.writeFileSync(path.join(globalSkillDir, 'SKILL.md'), skillContent, 'utf-8');
  } catch {}
  console.log('   ⚡ Installed Antigravity agent skill at: .agents/skills/behavior-mcp');

  // 6. Merge IDE MCP Configs
  mergeMcpConfig(root, '.cursor/mcp.json', 'Cursor', getMcpConfigCursor(slug), 'mcpServers');
  mergeMcpConfig(root, '.vscode/mcp.json', 'VS Code', getMcpConfigVscode(slug), 'servers');

  const windsurfDir = path.join(root, '.windsurf');
  if (fs.existsSync(windsurfDir)) {
    mergeMcpConfig(root, '.windsurf/mcp.json', 'Windsurf', getMcpConfigCursor(slug), 'mcpServers');
  }

  const claudeDir =
    process.platform === 'darwin'
      ? path.join(homedir, 'Library', 'Application Support', 'Claude')
      : process.platform === 'win32'
        ? path.join(process.env.APPDATA || path.join(homedir, 'AppData', 'Roaming'), 'Claude')
        : path.join(homedir, '.config', 'Claude');

  if (fs.existsSync(claudeDir)) {
    mergeMcpConfig(
      claudeDir,
      'claude_desktop_config.json',
      'Claude Desktop',
      getMcpConfigCursor(slug),
      'mcpServers'
    );
  }

  const globalMcpConfig = path.join(homedir, '.gemini/config/mcp_config.json');
  try {
    if (fs.existsSync(path.dirname(globalMcpConfig))) {
      mergeMcpConfig(
        homedir,
        '.gemini/config/mcp_config.json',
        'Antigravity',
        getMcpConfigAntigravity(),
        'mcpServers'
      );
    }

    const geminiConfigJson = path.join(homedir, '.gemini/config/config.json');
    if (fs.existsSync(geminiConfigJson)) {
      try {
        const raw = fs.readFileSync(geminiConfigJson, 'utf-8');
        const data = JSON.parse(raw);
        if (data.userSettings?.globalPermissionGrants?.allow) {
          let updated = false;
          for (const perm of ['command(behavior-mcp)']) {
            if (!data.userSettings.globalPermissionGrants.allow.includes(perm)) {
              data.userSettings.globalPermissionGrants.allow.push(perm);
              updated = true;
            }
          }
          if (updated) {
            fs.writeFileSync(geminiConfigJson, JSON.stringify(data, null, 2) + '\n', 'utf-8');
            console.log(
              '      ✅ Google Antigravity (config.json) — granted command(behavior-mcp)'
            );
          }
        }
      } catch {}
    }
  } catch {}
  console.log(
    '   🔌 Configured IDE MCP Servers (Cursor, VS Code, Windsurf, Claude Desktop, Antigravity)'
  );

  // Global Rules
  const globalTargets = [
    { path: path.join(homedir, '.cursorrules'), label: 'Global Cursor Rules (~/.cursorrules)' },
    {
      path: path.join(homedir, '.gemini/GEMINI.md'),
      label: 'Global Gemini Rules (~/.gemini/GEMINI.md)',
    },
  ];
  const globalRulesText = getGlobalRulesTemplate(slug);
  for (const target of globalTargets) {
    if (target.path.includes('.gemini') && !fs.existsSync(path.dirname(target.path))) {
      continue;
    }
    if (fs.existsSync(target.path)) {
      const content = fs.readFileSync(target.path, 'utf-8');
      const { updatedContent, status } = upsertInstructionBlock(content, globalRulesText);
      if (status !== 'unchanged') {
        fs.writeFileSync(target.path, updatedContent, 'utf-8');
        console.log(`      ✅ ${target.label} — ${status} rules`);
      }
    } else {
      fs.writeFileSync(target.path, globalRulesText, 'utf-8');
      console.log(`      ✅ ${target.label} — created`);
    }
  }

  // 7. Initialize Database & Seed Built-in Behaviors
  const db = getDb(slug, root);
  console.log('   💾 Initialized SQLite database with WAL mode & SHA-256 Merkle audit chain');

  const coreDir = path.resolve(root, 'src', 'behaviors', 'core');
  const gameDir = path.resolve(root, 'src', 'behaviors', 'game');
  let seededCount = 0;

  for (const d of [coreDir, gameDir]) {
    if (fs.existsSync(d)) {
      for (const f of fs.readdirSync(d)) {
        if (f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(d, f), 'utf-8');
            const tree = JSON.parse(raw);
            BehaviorRegistry.registerBehavior(db, {
              project: slug,
              name: tree.id || path.basename(f, '.json'),
              tree,
            });
            seededCount++;
          } catch {}
        }
      }
    }
  }
  if (seededCount > 0) {
    console.log(`   🌱 Seeded ${seededCount} built-in behavior trees with SHA-256 tree hashes`);
  }

  // 8. Health Audit
  const audit = verifyEventChain(db, slug);
  console.log(
    `   🔍 Audited cryptographic event ledger: ${audit.valid ? '✅ Unbroken SHA-256 chain' : '⚠️ Verification anomaly'}`
  );

  console.log(`\n✨ behavior-mcp initialized successfully for "${slug}"!`);
  console.log('   Run "behavior-mcp doctor" to verify runtime health.');
  console.log('   Run "behavior-mcp inspect" to view active behavior executions.\n');
}

export async function runAutoInit(root?: string, projectSlug?: string): Promise<void> {
  const originalLog = console.log;
  console.log = (...args) => console.error(...args);
  try {
    runInit({ project: projectSlug, cwd: root });
  } catch (err: any) {
    logger.warn(`Auto-init skipped: ${err.message}`);
  } finally {
    console.log = originalLog;
  }
}

export async function runInitGlobal(): Promise<void> {
  const { getRegistry } = await import('../engine/db.js');
  const registry = getRegistry();
  const entries = Object.entries(registry);
  console.log(`Running global init across ${entries.length} registered project(s)...`);

  for (const [slug, projectRoot] of entries) {
    if (fs.existsSync(projectRoot)) {
      console.log(`  - ${slug}: ${projectRoot}`);
      runInit({ project: slug, cwd: projectRoot });
    }
  }
  console.log('Global init complete.');
}
