# Changelog

All notable changes to the ADD specification will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [0.0.2] - 2026-04-13

### Changed
- **Architecture: Pure API + Separate Frontend.** The spec now recommends that APIs return JSON exclusively. Human-facing interfaces should be separate frontend applications that consume the same API as agents. Content negotiation (`Accept: text/html`) is no longer recommended.
- The `ui` block is now positioned as a rendering contract between the API and any client (agent or frontend), not just metadata for agents.
- Updated `spec/api-as-ui.md`: Replaced "Content Negotiation" section with "Response Format" section recommending JSON-only responses.

### Added
- New specification document: `spec/architecture.md` — covers the Pure API + Separate Frontend pattern, the `ui` block as rendering contract, CORS guidance, and the "frontend is just another client" principle.

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
