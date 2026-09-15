export function registerAllPrompts(server: any): void {
  const registerPrompt = (
    name: string,
    metadata: { title: string; description: string; argsSchema?: Record<string, any> },
    handler: (args: any, extra?: { signal?: AbortSignal }) => Promise<any> | any
  ) => {
    if (typeof server.registerPrompt === 'function') {
      server.registerPrompt(name, metadata, handler);
    } else if (typeof server.prompt === 'function') {
      server.prompt(name, metadata.description, metadata.argsSchema || {}, handler);
    }
  };

  registerPrompt(
    'behavior-design',
    {
      title: 'Behavior Design',
      description:
        'Design a robust, composable behavior tree with sequences, selectors, guards, and decorators',
      argsSchema: {
        properties: {
          goal: { type: 'string', description: 'Target goal or behavior objective' },
          environment: { type: 'string', description: 'Operating environment constraints' },
        },
        required: ['goal'],
      },
    },
    async (args: any) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Design a behavior tree to accomplish "${args.goal}". Constraints: "${args.environment || 'Standard browser automation'}". Output valid JSON conforming to the PuterVision behavior tree schema with sequence, selector, and condition/action nodes. Register with \`manage_behaviors(register)\`.`,
            },
          },
        ],
      };
    }
  );

  registerPrompt(
    'debug-stuck',
    {
      title: 'Debug Stuck',
      description:
        'Investigate and resolve stuck behavior execution instances and infinite node loops',
      argsSchema: {
        properties: {
          execution_id: { type: 'string', description: 'Stuck execution instance ID' },
        },
        required: ['execution_id'],
      },
    },
    async (args: any) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Diagnose stuck execution "${args.execution_id}". Inspect active node path with \`get_status(current)\`, inspect blackboard state with \`manage_blackboard(get)\`, and analyze metrics via \`get_metrics(current)\`.`,
            },
          },
        ],
      };
    }
  );

  registerPrompt(
    'optimize-behavior',
    {
      title: 'Optimize Behavior',
      description: 'Optimize behavior tree node ordering and conditions for 60Hz tick efficiency',
      argsSchema: {
        properties: {
          behavior_name: { type: 'string', description: 'Behavior tree name to optimize' },
        },
        required: ['behavior_name'],
      },
    },
    async (args: any) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Analyze telemetry metrics for behavior tree "${args.behavior_name}" via \`get_metrics(history)\`. Identify slow condition evaluations and reorder selector branches to maximize early exits.`,
            },
          },
        ],
      };
    }
  );

  registerPrompt(
    'trigger-design',
    {
      title: 'Trigger Design',
      description:
        'Create reactive interrupt triggers with priority preemption and cooldown guards',
      argsSchema: {
        properties: {
          behavior_name: { type: 'string', description: 'Emergency behavior to trigger' },
          emergency_condition: { type: 'string', description: 'Trigger condition description' },
        },
        required: ['behavior_name', 'emergency_condition'],
      },
    },
    async (args: any) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Configure a reactive interrupt trigger for emergency behavior "${args.behavior_name}". Condition: "${args.emergency_condition}". Register with \`register_trigger(register)\` setting high priority (0.9+) and appropriate cooldown.`,
            },
          },
        ],
      };
    }
  );
}
