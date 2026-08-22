# Agent Instructions for behavior-runtime-mcp

This project uses `@putervision/behavior-runtime-mcp` for high-frequency in-browser behavior execution.

## Mandatory Workflow
1. **Load**: Activate behavior trees via `load_behavior(load)`.
2. **Monitor**: Check execution status with `get_status(current)`.
3. **Triggers**: Register reactive emergency interrupts via `register_trigger(register)`.
4. **Safety**: Use `abort_behavior(abort)` to halt execution on anomalies.
