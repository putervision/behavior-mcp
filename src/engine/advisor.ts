export const TOOL_ALIASES: Record<string, string> = {
  load: 'load_behavior',
  load_tree: 'load_behavior',
  run_tree: 'load_behavior',
  step: 'step_behavior',
  tick: 'step_behavior',
  pause: 'pause_behavior',
  resume: 'pause_behavior',
  abort: 'abort_behavior',
  stop: 'abort_behavior',
  cancel: 'abort_behavior',
  trigger: 'register_trigger',
  add_trigger: 'register_trigger',
  record: 'manage_recordings',
  replay: 'manage_recordings',
  metrics: 'query_execution_metrics',
  telemetry: 'query_execution_metrics',
  status: 'get_runtime_status',
  blackboard: 'manage_blackboard',
  safety: 'emergency_kill_switch',
  kill: 'emergency_kill_switch',
};

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export class SchemaAdvisor {
  static resolveAlias(toolName: string): string | undefined {
    return TOOL_ALIASES[toolName.toLowerCase()];
  }

  static getAdvice(toolName: string, error: string, availableTools: string[]): string {
    const alias = this.resolveAlias(toolName);
    if (alias) {
      return `Tool "${toolName}" is an alias. Did you mean to call "${alias}"?`;
    }

    let closest = '';
    let minDistance = Infinity;
    for (const tool of availableTools) {
      const dist = levenshtein(toolName.toLowerCase(), tool.toLowerCase());
      if (dist < minDistance && dist <= 3) {
        minDistance = dist;
        closest = tool;
      }
    }

    if (closest) {
      return `Tool "${toolName}" not found. Did you mean "${closest}"? (${error})`;
    }

    return `Invalid tool call "${toolName}": ${error}`;
  }
}
