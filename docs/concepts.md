# Core Architecture & Concepts: `@putervision/behavior-mcp`

`@putervision/behavior-mcp` provides high-frequency (~60Hz) deterministic behavior tree execution for browser-based AI agent automation.

---

## 1. The Behavior Tree Model

Behavior trees offer structured, modular, and deterministic action execution:

```
                    [ Root Selector (?)]
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
    [ Emergency Heal (->) ]        [ Harvest Wood (->) ]
      ├── (HP < 30?)                 ├── (Find Tree)
      └── [ Drink Potion ]           └── [ Swing Axe ]
```

### Node Types
1. **Composites**:
   - `sequence` (`->`): Executes children in order until one returns `FAILURE` or `RUNNING`. Returns `SUCCESS` if all succeed.
   - `selector` (`?`): Executes children in order until one returns `SUCCESS` or `RUNNING`. Returns `FAILURE` if all fail.
   - `parallel`: Executes all children concurrently each tick.
2. **Decorators**:
   - `inverter`: Negates child status (`SUCCESS` ↔ `FAILURE`).
   - `repeater`: Re-executes child fixed times or indefinitely.
   - `timeout`: Enforces max tick duration.
   - `cooldown`: Enforces minimum delay between evaluations.
3. **Leaves**:
   - `action`: Performs state mutations in browser or blackboard (`click`, `type`, `move_to`, `cast_spell`, `flee_to_safety`).
   - `condition`: Read-only predicates checking blackboard or telemetry (`hp_below`, `enemy_in_range`, `timer_elapsed`).

---

## 2. ~60Hz In-Browser Tick Loop
- The runtime injects lightweight JavaScript into the browser runtime via Playwright or user scripts.
- Tree traversal occurs at ~60 ticks/second (16.6ms per tick) with low latency.
- Each tick traverses from root through active node paths, updating blackboard state and metrics.

---

## 3. Reactive Interrupt Triggers
- High-priority interrupt handlers registered via `register_trigger`.
- Evaluated before standard tree traversal each tick.
- When an emergency condition triggers (e.g. `hp_below: 25`), execution immediately preempts the active branch to run emergency recovery behaviors.

---

## 4. Multi-Layer Safety Guardrails
1. **Fail-Closed Evaluator**: Unrecognized node definitions fail closed immediately.
2. **Watchdog Heartbeat Timer**: Detects and halts stalled execution beyond 5,000ms.
3. **Action Rate Limiter**: Capped at 60 actions/second.
4. **Leaf Policy Gate**: Blocks irreversible, high-risk mutations.
5. **Emergency Kill Switch**: Atomic software latch for instant halts.

---

## 5. PuterVision Game Telemetry Bridge
- **`window.__PUTERVISION_TELEMETRY__`**: Bi-directional telemetry API installed by `BrowserInjector` into WebGL / Canvas / DOM game runtimes.
- **Auto-Sync**: Custom game events (`window.dispatchEvent(new CustomEvent('putervision:telemetry', { detail: { hp: 45, mana: 80 } }))`) automatically mirror player vitals, coordinates, and visible entity tags directly into the behavior tree blackboard.
- **Pre-Seeded Game Trees**: Built-in behavior trees for common gaming archetypes:
  - `dungeon_crawler.json`: Room exploration, spell rotations, aggro mitigation, and emergency potion preemption.
  - `resource_gatherer.json`: Waypoint route harvesting, weight monitoring, and town bank deposit cycles.
  - `kiting_tactics.json`: Dynamic range maintenance, ranged spellcasting, and retreat maneuvers.

