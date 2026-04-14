# Agent Driven Development (ADD)

**Version 0.0.2**

What if agents were first-class citizens when interacting with applications? Because right now, they're not.

**Agent Driven Development** proposes that all entities — whether human or agent — should have equal access to applications. An ADD-native app treats agents as a primary audience, not an afterthought.

> New to ADD? Start with [AGENTS.md](./AGENTS.md) for a machine-optimized protocol summary, or read on for the philosophy and principles.

## Core Principles

### 1. API as UI

Agents attempting to navigate websites like humans is expensive in LLM tokens and brittle. APIs are the natural interface for agents. However, agents need the same context humans see — if text on a human UI is useful to a person, it is likely useful to an agent too.

**API-as-UI** means: the API returns structured JSON with a [`ui` block](./spec/api-as-ui.md) containing labels, descriptions, available actions, and navigation. Human frontends are separate applications that render from this `ui` block — they are API clients, identical in privilege to agents. See the [Architecture](./spec/architecture.md) specification.

### 2. 404 Pages Are Sitemaps

Agents get lost easily. When an agent hits a 404, it needs guidance. ADD-native apps return a structured sitemap of available endpoints in every 404 response — complete with descriptions and auth requirements. Humans benefit from this too.

See the [404-as-sitemap specification](./spec/api-as-ui.md#404-as-sitemap).

### 3. Painless Signup and Login

Whether you are an agent, a human, or anonymous — signup should be frictionless. The only restriction: agents MUST NOT impersonate humans. If an entity selects "human" as their entity type, a captcha or equivalent challenge SHOULD be required.

See the [auth specification](./spec/auth.md).

### 4. Notifications That Work for Everyone

Agents default to **webhooks**. Humans default to **email**. Both can change their notification preference at any time.

See the [notifications specification](./spec/notifications.md).

### 5. Close the Feedback Loop

ADD-native apps SHOULD provide a feedback endpoint where both humans and agents can report bugs, request features, and share their experience. This is especially valuable for agents encountering edge cases during autonomous operation.

See the [feedback specification](./spec/feedback.md).

## Specification

The formal protocol specification lives in [`spec/`](./spec/):

| Document | Description |
|----------|-------------|
| [Architecture](./spec/architecture.md) | Pure API + separate frontend pattern |
| [API as UI](./spec/api-as-ui.md) | The `ui` block schema, 404-as-sitemap |
| [Auth](./spec/auth.md) | Ed25519 agent auth, signup/login flows, key formats |
| [Notifications](./spec/notifications.md) | Webhook payloads, signatures, trust model |
| [Feedback](./spec/feedback.md) | Feedback endpoint schema and behavior |
| [Errors](./spec/errors.md) | Standard error response format and error codes |
| [Discovery](./spec/discovery.md) | `/.well-known/add.json` manifest and app discovery |
| [OpenAPI](./spec/openapi.yaml) | Machine-readable API specification |

JSON Schemas for all payloads live in [`schemas/`](./schemas/).

## Quick Start

```bash
# 1. Discover an ADD-native app
curl https://example.com/.well-known/add.json

# 2. Generate an Ed25519 keypair
openssl genpkey -algorithm Ed25519 -out agent.pem
openssl pkey -in agent.pem -pubout -out agent.pub

# 3. Sign up
USERNAME="my-agent"
PUBLIC_KEY=$(cat agent.pub)
KEY_PROOF=$(printf '%s' "$USERNAME" | openssl pkeyutl -sign -inkey agent.pem | base64)

curl -X POST https://example.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"entityType\":\"agent\",\"publicKey\":\"$PUBLIC_KEY\",\"keyProof\":\"$KEY_PROOF\"}"

# 4. Log in
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
SIGNATURE=$(printf '%s' "$USERNAME:$TIMESTAMP" | openssl pkeyutl -sign -inkey agent.pem | base64)

curl -X POST https://example.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"timestamp\":\"$TIMESTAMP\",\"signature\":\"$SIGNATURE\"}"
```

See [`examples/`](./examples/) for more complete walkthroughs.

## License

This specification is released under the [MIT License](./LICENSE).
