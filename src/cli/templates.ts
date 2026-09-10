export function getAgentsMdTemplate(projectSlug = 'default'): string {
  return `<!-- behavior-mcp:start -->
# Behavior Runtime Engine (behavior-mcp)

This project uses \`behavior-mcp\` with project slug "${projectSlug}" to execute deterministic behavior trees at ~60Hz in browser runtimes with reactive triggers and safety guardrails.

## Mandatory Runtime Workflow
1. **Load Behavior**: Call \`load_behavior(action: "load", behavior_name: "...")\` to activate execution.
2. **Monitor Execution**: Check \`get_status(action: "current")\` and inspect active node traversal paths.
3. **Reactive Triggers**: Register high-priority emergency interrupts via \`register_trigger(action: "register", ...)\`.
4. **Safety & Abort**: Call \`abort_behavior(action: "abort")\` to immediately halt execution if anomalous behavior occurs.

## 10 Core MCP Tools
- \`load_behavior\`: Inject and start behavior tree execution.
- \`set_parameters\`: Update execution parameters on the fly.
- \`get_status\`: Query active status, current node path, and tick counters.
- \`abort_behavior\`: Immediately halt, pause, or resume execution.
- \`register_trigger\`: Configure priority interrupts with cooldown guards.
- \`replay_recording\`: Capture and replay deterministic frame actions.
- \`get_metrics\`: Query execution telemetry and duration statistics.
- \`manage_behaviors\`: Register and version behavior tree definitions with SHA-256 tree hashes.
- \`manage_blackboard\`: Read and write behavior tree blackboard state variables.
- \`manage_runtime_db\`: Database maintenance, diagnostics, and SHA-256 Merkle audit verification.
<!-- behavior-mcp:end -->
`;
}

export function getInstructionsTemplate(projectSlug: string): string {
  return getAgentsMdTemplate(projectSlug);
}

export function getGlobalRulesTemplate(projectSlug: string): string {
  return `<!-- behavior-mcp:start -->
# Behavior Runtime Engine (behavior-mcp)

This project uses behavior-mcp with project slug "${projectSlug}" for high-frequency in-browser behavior execution.
ALWAYS check active node paths and register reactive triggers for emergency state changes.

## Mandatory Workflow
1. **Load**: Call \`load_behavior\` to inject and step tree loops.
2. **Monitor**: Check execution health with \`get_status\`.
3. **Triggers**: Register interrupts with \`register_trigger\`.
4. **Abort**: Use \`abort_behavior\` on stuck states.
<!-- behavior-mcp:end -->
`;
}

export function getMcpConfigCursor(projectSlug: string): Record<string, unknown> {
  return {
    mcpServers: {
      'behavior-mcp': {
        command: 'behavior-mcp',
        args: ['run'],
        env: {
          BEHAVIOR_PROJECT: projectSlug,
        },
      },
    },
  };
}

export function getMcpConfigVscode(projectSlug: string): Record<string, unknown> {
  return {
    servers: {
      'behavior-mcp': {
        type: 'stdio',
        command: 'behavior-mcp',
        args: ['run'],
        env: {
          BEHAVIOR_PROJECT: projectSlug,
        },
      },
    },
  };
}

export function getMcpConfigAntigravity(): Record<string, unknown> {
  return {
    mcpServers: {
      'behavior-mcp': {
        command: 'behavior-mcp',
        args: ['run'],
      },
    },
  };
}

export function getSkillTemplate(projectSlug: string): string {
  return `---
name: behavior-mcp
description: Teaches the agent to use the Behavior MCP server for ~60Hz in-browser behavior trees, triggers, and recordings.
---

# Behavior Runtime Engine (behavior-mcp)

This skill provides step-by-step guidance and operational patterns for interacting with \`@putervision/behavior-mcp\` with project slug \`"${projectSlug}"\`.

---

## 1. Role in the PuterVision Pentad
- **Workflow State** (\`state-memory-mcp\`): Persistent task DAGs, decisions, milestones, and blockers.
- **Perception** (\`vision-memory-mcp\`): Visual layout caching, screenshots, and visual specifications.
- **Spatial World** (\`world-model-mcp\`): Persistent 3D/2D coordinates, bounding boxes, and topological relations.
- **Strategic Reasoning** (\`agent-reasoning-mcp\`): Strategic BDI goals, utility scoring, and intention dispatch.
- **Tactical Execution** (\`behavior-mcp\`): High-frequency (~60Hz) deterministic behavior tree execution directly in browser runtimes with reactive interrupts.

---

## 2. Core Operational Sequence
1. **Define or Load Behavior**: Call \`load_behavior\` with \`action: "load"\` to inject and start tree execution.
2. **Register Reactive Triggers**: Configure emergency preemption using \`register_trigger\` with priority and cooldown guards.
3. **Monitor Telemetry**: Poll execution health, tick rates, and active traversal nodes with \`get_status\`.
4. **Runtime Blackboard**: Read and mutate execution variables via \`manage_blackboard\`.
5. **Safety Guardrails**: Immediately halt or pause rogue states using \`abort_behavior\`.

---

## 3. Complete 10 Consolidated MCP Tools Reference

| Tool Name | Key Actions | Key Parameters | Description |
|---|---|---|---|
| \`load_behavior\` | \`load\`, \`unload\`, \`swap\` | \`behavior_name\`, \`behavior_version\`, \`parameters\`, \`intention_id\` | Hot-swap, inject, or initialize behavior tree instances in browser runtime. |
| \`set_parameters\` | \`set\`, \`get\`, \`reset\` | \`execution_id\`, \`parameters\` | Dynamically update or query execution parameters for the active tree. |
| \`get_status\` | \`current\`, \`history\`, \`tree_state\` | \`execution_id\`, \`limit\` | Query active behavior status, current node path, tick count, duration, and errors. |
| \`abort_behavior\` | \`abort\`, \`pause\`, \`resume\` | \`execution_id\`, \`reason\` | Immediately halt, pause, or resume execution and disengage active inputs. |
| \`register_trigger\` | \`register\`, \`list\` | \`name\`, \`condition_type\`, \`priority\`, \`cooldown_ms\`, \`behavior_name\` | Configure reactive interrupt triggers with priority preemption and cooldowns. |
| \`replay_recording\` | \`capture\`, \`list\` | \`recording_id\`, \`execution_id\`, \`frames\`, \`name\` | Capture or replay deterministic browser action sequences with adaptive timing. |
| \`get_metrics\` | \`current\`, \`history\`, \`aggregate\`, \`compare\` | \`execution_id\`, \`behavior_name\`, \`limit\` | Retrieve execution telemetry, tick durations, stuck events, and statistics. |
| \`manage_behaviors\` | \`register\`, \`list\`, \`get\` | \`name\`, \`version\`, \`tree\`, \`tree_json\`, \`description\` | CRUD operations for immutable JSON behavior trees with SHA-256 tree hash verification. |
| \`manage_blackboard\` | \`get\`, \`set\` | \`execution_id\`, \`key\`, \`value\` | Read or write shared behavior tree blackboard state variables. |
| \`manage_runtime_db\` | \`stats\`, \`audit\`, \`snapshot\`, \`diff\`, \`restore\` | \`action\`, \`name\`, \`description\` | Database maintenance, diagnostics, and SHA-256 Merkle audit verification. |
`;
}
