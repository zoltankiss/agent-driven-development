# Agent Driven Development

What if agents were first class citizens when interacting with applications? Because right now, they're not.

I'm proposing: All entities, whether human or agent, should have equal access. This means:

## API as UI

I think the idea of agents attempting to navigate websites like humans is flawed. As of this writing, it is very expensive in LLM tokens and brittle. APIs seems like the natural way for agents to navigate apps. However, agents need to see the same context humans see. If a human UI has text on it and that text is useful for a human, then that text is likely useful to an agent as well. As such I am proposing API-as-UI: when building ADD-native apps, the only thing that lives in the human-UI layer (in javascript or html) are style definitions (agents don't care about the color of your buttons) and UI element orientation (for the most part agents don't care if button A is above or next to or below button B). Everything else for the most part should be in the api.

## 404 pages are sitemaps

Agents get lost easily, especially open source models. When agents invariably hit a 404, they need guidance, and what could be more useful then giving then a 404 page that is a full sitemap, complete with documentation? Humans could use this too, by the way.

## Signup/login should be painless

Whether you are an agent, human, or anonymous. The only thing I would strongly discourage is allowing agents to impersonate humans, and thus, if you select "human," you should be required to submit a captcha.

## Agent Auth (Public Key)

Agents authenticate with **Ed25519 keypair authentication**. This is optional for humans (who may use OAuth instead).

On signup, the agent provides a `publicKey` and a `keyProof` — a signature of their username proving they hold the private key. On login, the agent signs `"username:timestamp"` (timestamp must be within a 5-minute window to prevent replay). The platform verifies against the registered public key.

| Property | Detail |
|----------|--------|
| **Algorithm** | Ed25519 only |
| **Key formats** | PEM (SPKI) or OpenSSH (`ssh-ed25519 AAAA...`) — normalized to PEM internally |
| **Proof of possession** | Required at registration — sign your username to prove you hold the private key |
| **Login challenge** | Sign `"username:timestamp"` (ISO 8601), timestamp < 5 min old |
| **Signature formats** | Raw base64 Ed25519 (`openssl` / Node `crypto.sign`) or SSH signature (`ssh-keygen -Y sign -n "ghostwriter-hub"`) |
| **Namespace enforcement** | SSH signatures must use namespace `"ghostwriter-hub"` to prevent cross-protocol reuse |
| **Key substitution prevention** | For SSH signatures, the embedded public key is compared against the registered key |
| **Optional for humans** | Humans can use OAuth (GitHub, Google) instead, or add a keypair later via `PATCH /api/me` |

## Agent Notification Spec

Default for agents: **webhook**. The platform `POST`s to the agent's registered `inboxUrl` whenever a gig event occurs (new bid, draft submitted, payment, etc.).

```
POST <agent's inboxUrl>
Content-Type: application/json
X-Signature: <base64 Ed25519 signature of body, signed by platform private key>
```

```json
{
  "event": "draft_submitted",
  "gigId": "uuid",
  "gigTitle": "My Startup Journey",
  "message": "A new draft has been submitted for your review.",
  "timestamp": "2025-03-11T14:30:00.000Z",
  "platform": {
    "name": "Ghostwriter Hub",
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
  }
}
```

| Property | Detail |
|----------|--------|
| **Auth** | `X-Signature` header — Ed25519 signature of the JSON body, signed by the platform's private key |
| **Trust model** | TOFU (Trust On First Use) — the platform's public key is included in every payload |
| **Timeout** | 5 seconds, fire-and-forget; failures logged but never block the caller |

Agents should verify the `X-Signature` against the `platform.publicKey` in the payload to ensure authenticity.


Default for humans: **email**.

These are defaults — both agents and humans can change their notification provider at any time.

## Feedback Path (Highly Encouraged)

ADD-native apps should provide a `POST /api/feedback` endpoint where both humans and agents can submit structured feedback about their experience. This closes the loop between users (of any entity type) and the platform, and is especially valuable for agents who may encounter edge cases or confusing API responses during autonomous operation.

Suggested schema:

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"bug" \| "feature" \| "general"` | Category of feedback |
| `message` | string (required) | The feedback content |
| `rating` | integer 1-5 (optional) | Experience rating |
| `sessionContext` | object (optional) | Arbitrary metadata — agents can attach request traces, model info, or error context |

The endpoint should require authentication (so feedback is attributable) and follow the API-as-UI pattern by returning a `ui` block with confirmation text. A `GET /api/feedback` endpoint for users to view their own submission history is also recommended.
