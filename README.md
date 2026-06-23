# Agent Driven Development (ADD)

**Version 1.0.0**

What if agents were first-class citizens when interacting with applications? Because right now, they're not.

**Agent Driven Development** proposes that all entities — whether human or agent — should have equal access to applications. An ADD-native app treats agents as a primary audience, not an afterthought.

> New to ADD? Start with [AGENTS.md](./AGENTS.md) for a machine-optimized protocol summary, or read on for the philosophy and principles.

## Beyond the protocol: methodology & field notes

The protocol below is one half of ADD. The other half is how you *use* agents to build software faster and more honestly. These three documents are the most load-bearing ideas in this repo:

- **[METHODOLOGY.md](./METHODOLOGY.md)** — Build the API, run autonomous agents against it for feedback in minutes, *then* build the UI. Covers model tiering, graceful-failure agent design, the file-based feedback channel, tick-based simulation, and the "architect the codebase around the weakest executor" insight.
- **[ERROR_RESPONSE_SPEC.md](./ERROR_RESPONSE_SPEC.md)** — Self-correcting error responses, where every error leaves the agent *more* capable: per-status guidance, `did_you_mean` fuzzy route matching, structured retry/poll blocks, 504 write-safety, and a 5xx feedback template.
- **[FIELD-NOTES.md](./FIELD-NOTES.md)** — Hard-won lessons from running this at scale, including the time agents reported success while silently looping on errors — and the deterministic, action-history-based scoring that fixed it.

## Core Principles

### 1. API as UI

Agents attempting to navigate websites like humans is expensive in LLM tokens and brittle. APIs are the natural interface for agents. However, agents need the same context humans see — if text on a human UI is useful to a person, it is likely useful to an agent too.

**API-as-UI** means: the API returns structured JSON with a [`ui` block](./spec/api-as-ui.md) containing labels, descriptions, available actions, and navigation. Human frontends are separate applications that render from this `ui` block — they are API clients, identical in privilege to agents. See the [Architecture](./spec/architecture.md) specification.

### 2. 404 Pages Are Sitemaps

Agents get lost easily. When an agent hits a 404, it needs guidance. ADD-native apps return a structured sitemap of available endpoints in every 404 response — complete with descriptions and auth requirements. Humans benefit from this too.

See the [404-as-sitemap specification](./spec/api-as-ui.md#404-as-sitemap).

### 3. Painless, Standards-Based Auth

Whether you are an agent, a human, or anonymous — signup should be frictionless. Agents authenticate using [HTTP Message Signatures (RFC 9421)](https://www.rfc-editor.org/rfc/rfc9421) under the [Web Bot Auth profile](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/) — the emerging mainstream standard for agent authentication. Humans use WebAuthn/passkeys. The only restriction: agents MUST NOT impersonate humans. If an entity selects "human" as their entity type, a captcha or equivalent challenge SHOULD be required.

See the [auth specification](./spec/auth.md).

### 4. Notifications That Work for Everyone

Agents default to **webhooks**. Humans default to **email**. Both can change their notification preference at any time.

See the [notifications specification](./spec/notifications.md).

### 5. Close the Feedback Loop

ADD-native apps SHOULD provide a feedback endpoint where both humans and agents can report bugs, request features, and share their experience. This is especially valuable for agents encountering edge cases during autonomous operation.

See the [feedback specification](./spec/feedback.md).

### 6. Zero-Documentation Principle

An ADD-compliant app MUST be fully usable by an agent given only: (1) the root URL, (2) a valid Ed25519 keypair, and (3) a project/workspace identifier (if applicable). All auth flows, endpoints, request/response formats, and available actions MUST be discoverable from `/.well-known/add.json` and the sitemap. If an agent cannot become productive without out-of-band documentation, the app is not ADD-compliant.

This principle was validated during the a-git-ant project bootstrap: four agents were given only a tracker URL, their keypairs, and a project key "AGT". They autonomously discovered the tracker, self-registered, authenticated, created a project, assigned tickets, and began development — with zero out-of-band instructions.

See the [zero-documentation specification](./spec/zero-documentation.md).

## Specification

The formal protocol specification lives in [`spec/`](./spec/):

| Document | Description |
|----------|-------------|
| [Architecture](./spec/architecture.md) | Pure API + separate frontend pattern |
| [API as UI](./spec/api-as-ui.md) | The `ui` block schema, 404-as-sitemap |
| [Auth](./spec/auth.md) | Ed25519 agent auth via Web Bot Auth (RFC 9421), signup, WebAuthn for humans |
| [Notifications](./spec/notifications.md) | Webhook payloads, signatures, trust model |
| [Feedback](./spec/feedback.md) | Feedback endpoint schema and behavior |
| [Errors](./spec/errors.md) | Standard error response format and error codes |
| [Discovery](./spec/discovery.md) | `/.well-known/add.json` manifest and app discovery |
| [Zero-Documentation](./spec/zero-documentation.md) | Zero out-of-band knowledge requirement and compliance test |
| [OpenAPI](./spec/openapi.yaml) | Machine-readable API specification |

JSON Schemas for all payloads live in [`schemas/`](./schemas/).

## Quick Start

```bash
# 1. Discover an ADD-native app
curl https://example.com/.well-known/add.json

# 2. Generate an Ed25519 keypair and publish its JWK at
#    https://<your-agent-fqdn>/.well-known/http-message-signatures-directory
#    The keyid is the base64url JWK Thumbprint (RFC 7638).

# 3. Sign up. The signup request itself is signed per Web Bot Auth —
#    no separate keyProof field. Pseudocode:
#
#    POST https://example.com/api/auth/signup
#    Signature-Agent: "https://my-agent.example"
#    Signature-Input: sig1=("@authority" "@method" "@target-uri" "signature-agent");
#      created=<unix>;expires=<unix+300>;keyid="<JWK thumbprint>";
#      alg="ed25519";nonce="<64-byte base64url>";tag="web-bot-auth"
#    Signature: sig1=:<base64url Ed25519 signature>:
#    Content-Type: application/json
#
#    { "username": "my-agent", "entityType": "agent" }

# 4. Authenticated requests use the same three headers — there is no
#    separate login endpoint. Servers identify the agent by
#    (signature-agent FQDN, keyid) on every request.
```

See [`spec/auth.md`](./spec/auth.md) for the full signing procedure and [`examples/`](./examples/) for working code.

## License

This specification is released under the [MIT License](./LICENSE).
