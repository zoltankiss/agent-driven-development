# Changelog

All notable changes to the ADD specification will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-05-16

### Changed (BREAKING)

- **Authentication is now Web Bot Auth.** ADD's custom Ed25519 signing envelope has been replaced with [HTTP Message Signatures (RFC 9421)](https://www.rfc-editor.org/rfc/rfc9421) under the [Web Bot Auth profile](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/). Agents now sign every request with `Signature-Agent`, `Signature-Input`, and `Signature` headers; servers verify signatures and identify agents by `(signature-agent FQDN, keyid)`. Algorithm remains Ed25519. This aligns ADD with the emerging mainstream standard for agent authentication and removes ADD-specific cryptographic surface area.
- **Agent login endpoint removed.** Per-request signing replaces session-based login. Servers MAY still issue optional Bearer tokens as a performance optimization, but signed requests are canonical.
- **Signup no longer takes a `keyProof` field.** The signed signup request itself proves possession of the private key.
- **Webhook signing aligned to Web Bot Auth.** Platform-issued webhooks are now signed using the same RFC 9421 mechanism (replacing the `X-Signature` header).
- **SSH signatures removed from core auth.** The `auth.ssh_namespace` manifest field is removed. Agents that want OpenSSH-format keys can convert to JWK.
- **Manifest changes.** `auth.agent_login` and `auth.ssh_namespace` removed. Added optional `auth.session_url` (for servers offering opportunistic Bearer tokens) and `platform_directory_url` (the platform's RFC 9421 key directory). `platform_public_key` is now JWK rather than PEM. `add_version` patterns now accept full semver.

### Added

- **Key directory.** Agents publish their Ed25519 public keys at `https://<signature-agent>/.well-known/http-message-signatures-directory` as a JWK Set. `keyid` is the base64url JWK Thumbprint ([RFC 7638](https://www.rfc-editor.org/rfc/rfc7638)) per [RFC 8037 Appendix A.3](https://www.rfc-editor.org/rfc/rfc8037#appendix-A.3).
- **Replay protection.** Signatures MUST expire within 300 seconds of `created` (tighter than the Web Bot Auth draft's 24-hour recommendation, preserving ADD 0.x's 5-minute freshness guarantee). Nonces are SHOULD with 64-byte base64url RECOMMENDED.
- **Migration table** in `spec/auth.md` mapping every 0.x mechanism to its 1.0 replacement.

### Removed

- ADD-specific `keyProof`-on-signup field.
- ADD-specific `username:timestamp` login signature scheme.
- SSH-signature signing path.
- `agent_login` and `ssh_namespace` manifest fields.

## [0.0.3] - 2026-04-23

### Added
- **Core Principle 6: Zero-Documentation Principle.** An ADD-compliant app MUST be fully usable by an agent given only the root URL, an Ed25519 keypair, and (if applicable) a project/workspace identifier. All auth flows, endpoints, and available actions must be discoverable from `/.well-known/add.json` and the sitemap — no out-of-band documentation allowed.
- New specification document: `spec/zero-documentation.md` — covers rationale, MUST/SHOULD/MUST NOT requirements, a formal compliance test, and real-world validation from the a-git-ant bootstrap.
- Added Zero-Documentation section to `AGENTS.md` agent quick reference.

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
