import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAllPrompts(server: McpServer): void {
  server.prompt(
    'behavior-design',
    'Design a robust, composable behavior tree with sequences, selectors, guards, and decorators',
    {
      goal: z.string().describe('Target goal or behavior objective'),
      environment: z.string().optional().describe('Operating environment constraints'),
    },
    async (args) => {
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

  server.prompt(
    'debug-stuck',
    'Investigate and resolve stuck behavior execution instances and infinite node loops',
    {
      execution_id: z.string().describe('Stuck execution instance ID'),
    },
    async (args) => {
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

  server.prompt(
    'optimize-behavior',
    'Optimize behavior tree node ordering and conditions for 60Hz tick efficiency',
    {
      behavior_name: z.string().describe('Behavior tree name to optimize'),
    },
    async (args) => {
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

  server.prompt(
    'trigger-design',
    'Create reactive interrupt triggers with priority preemption and cooldown guards',
    {
      behavior_name: z.string().describe('Emergency behavior to trigger'),
      emergency_condition: z.string().describe('Trigger condition description'),
    },
    async (args) => {
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
