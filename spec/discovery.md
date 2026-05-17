# Discovery

**Status:** Required | **Version:** 1.0.0

ADD-native apps MUST serve a discovery manifest so agents can programmatically find all available endpoints and capabilities.

## `/.well-known/add.json`

Every ADD-native app MUST serve a JSON manifest at the well-known URI `/.well-known/add.json` ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615)).

### Example

```json
{
  "add_version": "1.0.0",
  "app_name": "My ADD App",
  "app_description": "A brief description of what this app does",
  "spec_url": "https://github.com/zoltankiss/agent-driven-development",
  "documentation_url": "/api/docs",
  "openapi_url": "/api/openapi.json",
  "auth": {
    "protocol": "web-bot-auth",
    "agent_signup": "/api/auth/signup",
    "profile_url": "/api/me",
    "session_url": "/api/auth/session",
    "human_passkey_register": "/api/auth/passkey/register",
    "human_passkey_login": "/api/auth/passkey/login",
    "human_oauth_providers": ["github", "google"]
  },
  "platform_directory_url": "https://my-add-app.example.com/.well-known/http-message-signatures-directory",
  "platform_public_key": {
    "kty": "OKP",
    "crv": "Ed25519",
    "x": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
    "kid": "RkAU8wVqYDjY5R7tF3xkQwYi1c5xqQYHsftUomZ8b-c"
  },
  "notifications": {
    "webhook_config": "/api/me"
  },
  "feedback_url": "/api/feedback",
  "sitemap_url": "/api/sitemap"
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `add_version` | string | The ADD spec version this app implements (semver) |
| `app_name` | string | Human/agent-readable name of the application |
| `auth.agent_signup` | string | Path to the agent signup endpoint |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `app_description` | string | Brief description of the app's purpose |
| `spec_url` | string | URL to the ADD specification |
| `documentation_url` | string | Path to the app's API documentation |
| `openapi_url` | string | Path to the app's OpenAPI specification |
| `auth.protocol` | string | Auth protocol identifier. MUST be `"web-bot-auth"` in ADD 1.0. Reserved for future protocols |
| `auth.profile_url` | string | Path to view/update current user profile |
| `auth.session_url` | string | Path to mint an opportunistic Bearer token from a signed request (servers MAY offer; see [auth](./auth.md#optional-bearer-tokens-performance)) |
| `auth.human_passkey_register` | string | Path to the WebAuthn/passkey registration options endpoint |
| `auth.human_passkey_login` | string | Path to the WebAuthn/passkey authentication options endpoint |
| `auth.human_oauth_providers` | string[] | List of supported OAuth providers for humans |
| `platform_directory_url` | string | URL to the platform's RFC 9421 key directory (JWK Set). Agents fetch this to verify platform-signed webhooks |
| `platform_public_key` | object | Platform's Ed25519 public key as a JWK (`{kty, crv, x, kid}`). Bootstrap shortcut for agents that want TOFU pinning instead of fetching the directory |
| `notifications.webhook_config` | string | Path to configure webhook notifications |
| `feedback_url` | string | Path to the feedback endpoint |
| `sitemap_url` | string | Path to the full sitemap |

### Schema

See [`../schemas/add-manifest.schema.json`](../schemas/add-manifest.schema.json).

## Discovery Flow

1. Agent fetches `GET https://example.com/.well-known/add.json`
2. If the response is `200` with valid JSON matching the schema, the app is ADD-native
3. Agent reads `add_version` to determine compatibility
4. Agent uses the paths in the manifest to interact with the app

## 404 Link Header

ADD-native apps SHOULD include a `Link` header in 404 responses pointing to the manifest:

```
HTTP/1.1 404 Not Found
Link: </.well-known/add.json>; rel="service-desc"
Content-Type: application/json
```

This allows agents that land on an unknown URL to discover the app's capabilities.


## Platform Key Publication

Apps SHOULD publish their platform Ed25519 public key for agents to verify signed webhooks (see [auth: Webhook Authentication](./auth.md#webhook-authentication)).

Two manifest fields are available:

- **`platform_directory_url`** (RECOMMENDED) — URL to the platform's RFC 9421 key directory (JWK Set). This is the canonical mechanism; it supports rotation and multi-key publication.
- **`platform_public_key`** — A single JWK (`{kty: "OKP", crv: "Ed25519", x, kid}`). Bootstrap shortcut for agents that want to pin a key on first contact (TOFU). If present, MUST match a key currently published in the directory.

If both are present, agents SHOULD prefer the directory for live verification and use `platform_public_key` only for initial TOFU pinning.
