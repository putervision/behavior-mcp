# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
