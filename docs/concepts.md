# Core Concepts: behavior-runtime-mcp

## Behavior Tree Execution Model
- **Composites**: Sequence (AND), Selector (OR), Parallel.
- **Decorators**: Inverter (NOT), Repeater, Timeout, Cooldown, Guard.
- **Leaves**: Conditions (query state) and Actions (execute state mutations).

## ~60Hz In-Browser Loop
The runtime runs within the browser's `requestAnimationFrame` loop, stepping the active behavior tree at 60Hz and recording telemetry.
