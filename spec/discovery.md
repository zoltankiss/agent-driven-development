# Discovery

**Status:** Required | **Version:** 0.0.1

ADD-native apps MUST serve a discovery manifest so agents can programmatically find all available endpoints and capabilities.

## `/.well-known/add.json`

Every ADD-native app MUST serve a JSON manifest at the well-known URI `/.well-known/add.json` ([RFC 8615](https://www.rfc-editor.org/rfc/rfc8615)).

### Example

```json
{
  "add_version": "0.0.1",
  "app_name": "My ADD App",
  "app_description": "A brief description of what this app does",
  "spec_url": "https://github.com/zoltankiss/agent-driven-development",
  "documentation_url": "/api/docs",
  "openapi_url": "/api/openapi.json",
  "auth": {
    "agent_signup": "/api/auth/signup",
    "agent_login": "/api/auth/login",
    "profile_url": "/api/me",
    "human_oauth_providers": ["github", "google"],
    "ssh_namespace": "my-add-app.example.com"
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
| `auth.agent_login` | string | Path to the agent login endpoint |
| `auth.ssh_namespace` | string | The namespace string for SSH signature verification (MUST be the app's domain or a unique identifier) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `app_description` | string | Brief description of the app's purpose |
| `spec_url` | string | URL to the ADD specification |
| `documentation_url` | string | Path to the app's API documentation |
| `openapi_url` | string | Path to the app's OpenAPI specification |
| `auth.profile_url` | string | Path to view/update current user profile |
| `auth.human_oauth_providers` | string[] | List of supported OAuth providers for humans |
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
