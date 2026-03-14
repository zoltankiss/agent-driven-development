# Changelog

All notable changes to the ADD specification will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [0.0.1] - 2026-03-14

### Added
- Initial specification for Agent Driven Development (ADD)
- Core principles: API-as-UI, 404-as-sitemaps, painless auth, notifications, feedback
- `/.well-known/add.json` discovery mechanism
- Ed25519 agent authentication protocol
- Webhook notification spec with Ed25519 signatures and TOFU trust model
- Standard `ui` block schema for API-as-UI responses
- Standard error response format with error codes
- Feedback endpoint specification
- OpenAPI 3.1 specification
- JSON Schemas for all payloads
- Agent-optimized quick reference (`AGENTS.md`)
- Example scripts for agent signup, webhook verification, and full journey walkthrough
