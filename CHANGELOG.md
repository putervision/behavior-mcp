# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.1] - 2026-10-03

### 🛡️ Security Hardening & Dispatch Token Enforcement
- **Dispatch Token Enforcement**: Wired HMAC intention dispatch token verification into `load_behavior` with canonical `params_hash` re-computation and behavior name matching.
- **Token Replay Protection**: Added in-memory token cache with TTL expiration to prevent token replay attacks.
- **Browser Injector Sandboxing**: Hardened runtime injection script generation against script breakout via unescaped identifiers, and restricted default origin allowlists.
- **Schema & Policy Protection**: Added prototype key filtering (`__proto__`, `constructor`, `prototype`) in `RecordSchema` to prevent prototype pollution during dictionary validation.
- **Documentation & Manifest Alignment**: Updated security policy contact domains and synchronized package metadata across documentation and schemas.

## [0.4.0] - 2026-10-02

### 🚀 Blackboard Slice Projections, Typed Spatial Conditions & 60Hz Outcome Spool
- **Structured Blackboard Slices**: Added `manage_blackboard(action: 'ingest_slice')` with namespaced slice keys, ingestion timestamps, and configurable TTL-based staleness protection.
- **Typed Spatial Conditions**: Added deterministic condition evaluators (`spatial_entity_near`, `affordance_check`, `threat_in_frustum`, `path_clear`) with fail-closed staleness checks against expired blackboard data.
- **60Hz SQLite Outcome Spool**: Implemented non-blocking local SQLite spooling (`SpoolEngine`) for high-frequency tick actions and executions, preventing cross-server network latency bottlenecks during behavior loops.
- **Spool Telemetry & Draining**: Added `get_metrics(action: 'spool')` and `get_metrics(action: 'drain_spool')` to batch-sync spooled outcomes to higher-level strategic reasoning off-tick.
- **Manifest Synchronization**: Synchronized package manifests, bumped version to 0.4.0, and updated tool documentation.

## [0.3.1] - 2026-09-28

### 🛠️ Glama TDQS Optimizations & MCP Annotations
- Added `idempotentHint` and explicit `destructiveHint` annotations across tool definitions.
- Enhanced tool descriptions with action enum definitions in the opening summary, routing guidance sentences ('Use X instead of Y when Z'), and standardized Returns blocks.
- Preserved JSON schema action enums and synchronized package manifests and documentation.

## [0.2.0] - 2026-09-15

### 🚀 Zero-Dependency Native MCP Transport & Cross-Pentad Synchronization
- Added zero-dependency Native MCP Transport engine (`PV_NATIVE_TRANSPORT=1`) with pure Node.js stdio streaming and schema validation.
- Enhanced database maintenance and diagnostic actions to strictly validate supported operations.
- Synchronized package manifests, registry configurations (`server.json`, `manifest.json`), and documentation across the Pentad.

## [0.1.2] - 2026-09-10

### 🌐 Documentation Responsive Redesign & Registry Metadata Standardization
- Enhanced documentation website UI with responsive mobile navigation toggles, Pentad server ecosystem cross-links, and unified styling.
- Standardized registry schemas and metadata (`manifest.json`, `glama.json`, `server.json`, `.well-known/mcp.json`) with concise descriptions (<= 100 characters).
- Bumped version across runtime CLI, build system, and package manifests.

## [0.1.1] - 2026-08-30

### 🚀 Autonomous Gaming Suite & In-Browser Telemetry Bridge
- Added `window.__PUTERVISION_TELEMETRY__` and `window.__PUTERVISION_GAME_STATE__` bridge hooks in `BrowserInjector`, auto-syncing `putervision:telemetry` DOM events to blackboard in <1ms.
- Pre-seeded 3 tactical behavior trees (`dungeon_crawler.json`, `resource_gatherer.json`, `kiting_tactics.json`).
- Synchronized version across package manifests, CLI runtime, and documentation.

## [0.1.0] - 2026-08-22

### Added
- Initial release of PuterVision MCP server.
