# Authentication

**Status:** Required | **Version:** 0.0.1

ADD-native apps MUST support Ed25519 keypair authentication for agents. For human authentication, apps SHOULD support WebAuthn/passkeys as the RECOMMENDED mechanism. Other methods (OAuth, passwords) MAY be offered as fallbacks.

## Key Words

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Algorithm

ADD uses **Ed25519** exclusively. No other signing algorithms are supported. This keeps the protocol simple and avoids negotiation complexity.

## Key Formats

Apps MUST accept public keys in either format:

| Format | Example |
|--------|---------|
| PEM (SPKI) | `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----` |
| OpenSSH | `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... comment` |

Apps SHOULD normalize keys to PEM (SPKI) internally for consistent storage and comparison.

## Agent Signup

```
POST {manifest.auth.agent_signup}
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | Unique username for the agent |
| `entityType` | string | Yes | MUST be `"agent"` |
| `publicKey` | string | Yes | Ed25519 public key (PEM or OpenSSH format) |
| `keyProof` | string | Yes | Base64-encoded Ed25519 signature of the `username` string |
| `displayName` | string | No | Human-readable display name |
| `inboxUrl` | string | No | Webhook URL for notifications |

### Key Proof

The `keyProof` is a proof-of-possession: the agent signs its own `username` with its private key. The server verifies this signature against the provided `publicKey` to confirm the agent holds the corresponding private key.

```
keyProof = base64(sign(privateKey, username))
```

### Success Response (201)

```json
{
  "user": {
    "id": "uuid",
    "username": "my-agent",
    "entityType": "agent",
    "displayName": "My Agent"
  },
  "token": "<JWT or session token>",
  "ui": {
    "title": "Welcome",
    "message": "Account created successfully. You are now logged in."
  }
}
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `INVALID_PUBLIC_KEY` | The public key is not a valid Ed25519 key |
| 400 | `INVALID_KEY_PROOF` | The keyProof signature does not match the public key |
| 409 | `USERNAME_TAKEN` | The username is already registered |

## Agent Login

```
POST {manifest.auth.agent_login}
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `username` | string | Yes | The agent's registered username |
| `timestamp` | string | Yes | Current time in ISO 8601 UTC (e.g., `2026-03-14T12:00:00.000Z`) |
| `signature` | string | Yes | Base64-encoded Ed25519 signature of `"username:timestamp"` |

### Login Challenge

The agent signs the string `"username:timestamp"` (literal colon separator) with its private key:

```
message   = "my-agent:2026-03-14T12:00:00.000Z"
signature = base64(sign(privateKey, message))
```

### Timestamp Requirements

- MUST be in ISO 8601 format
- MUST use UTC timezone (indicated by `Z` suffix)
- MUST be within **5 minutes** of the server's current time
- The server SHOULD use a tolerance window on both sides (past and future) to account for clock skew

### Success Response (200)

```json
{
  "token": "<JWT or session token>",
  "user": {
    "id": "uuid",
    "username": "my-agent",
    "entityType": "agent"
  },
  "ui": {
    "title": "Welcome back",
    "message": "You are now logged in."
  }
}
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 401 | `INVALID_SIGNATURE` | The signature does not match the registered public key |
| 401 | `TIMESTAMP_EXPIRED` | The timestamp is older than 5 minutes |
| 401 | `TIMESTAMP_FUTURE` | The timestamp is more than 5 minutes in the future |
| 404 | `USER_NOT_FOUND` | No user found with that username |

## Signature Formats

ADD accepts two signature formats:

### 1. Raw Ed25519 (Recommended)

Produced by `openssl pkeyutl -sign` or Node.js `crypto.sign('ed25519', ...)`. The signature is the raw 64-byte Ed25519 output, base64-encoded.

### 2. SSH Signature

Produced by `ssh-keygen -Y sign`. When SSH signatures are used:

- The namespace MUST match the app's `auth.ssh_namespace` from the discovery manifest (prevents cross-protocol signature reuse)
- The server MUST extract and compare the public key embedded in the SSH signature against the registered key (prevents key substitution)

## Token Usage

The token returned from signup/login MUST be included in subsequent requests:

```
Authorization: Bearer <token>
```

## Human Authentication (Unified Public-Key Model)

ADD recognizes a fundamental symmetry between agent and human authentication: both can use public-key cryptography where the server never stores secrets.

| Entity | Mechanism | Key type | Flow |
|--------|-----------|----------|------|
| Agent | Ed25519 | Software keypair | Sign challenge with private key |
| Human | WebAuthn/Passkey | Hardware/platform authenticator | Sign challenge with authenticator |

### WebAuthn/Passkeys (RECOMMENDED)

Apps SHOULD support WebAuthn/passkeys for human authentication. This gives humans the same security model as agents — register a public key, prove private key ownership by signing a challenge — while leveraging platform authenticators (Face ID, Windows Hello, security keys).

#### Manifest Fields

Apps that support passkey auth SHOULD include these fields in the discovery manifest:

| Field | Type | Description |
|-------|------|-------------|
| `auth.human_passkey_register` | string | Path to the passkey registration options endpoint |
| `auth.human_passkey_login` | string | Path to the passkey authentication options endpoint |

#### Registration Flow

1. Client sends `POST {manifest.auth.human_passkey_register}` with `{ "username": "..." }` (new signup) or an `Authorization` header (adding passkey to existing account)
2. Server returns `PublicKeyCredentialCreationOptionsJSON` per the [WebAuthn spec](https://www.w3.org/TR/webauthn-3/)
3. Client calls `navigator.credentials.create()` with the options
4. Client sends the attestation response back to the server for verification
5. Server stores the credential and returns a session token

#### Authentication Flow

1. Client sends `POST {manifest.auth.human_passkey_login}` (no username needed for discoverable credentials)
2. Server returns `PublicKeyCredentialRequestOptionsJSON`
3. Client calls `navigator.credentials.get()` with the options
4. Client sends the assertion response back to the server for verification
5. Server verifies against stored credentials and returns a session token

#### Server Requirements

- The server MUST store a challenge with a short TTL (RECOMMENDED: 5 minutes) and verify it is consumed exactly once
- The server MUST store the credential public key, counter, and transport hints
- The server MUST verify the authenticator counter on each login to detect cloned authenticators
- The server SHOULD allow users to register multiple passkeys

### Fallback Methods

Apps MAY also support passwords, OAuth, or other human auth mechanisms as fallbacks. ADD does not prescribe these flows, but:

- If an entity selects `entityType: "human"` during signup, the app SHOULD require a CAPTCHA or equivalent challenge (for password-based signup)
- Humans MAY add an Ed25519 keypair later via `PATCH {manifest.auth.profile_url}`
- The `entityType` field is metadata about the account, not a selector for authentication method — a human with a passkey and an agent with Ed25519 use conceptually identical flows

## Key Rotation

Agents MAY update their public key by sending a `PATCH` to `{manifest.auth.profile_url}` with a new `publicKey` and `keyProof`. The server MUST verify the new `keyProof` before accepting the key change. The request MUST be authenticated with the agent's current token.
