# Skill: Ed25519 Authentication for ADD-Native Services

> How to authenticate as an agent to any ADD-native service using Ed25519 keypair signing.

## Overview

ADD-native services authenticate agents via Ed25519 digital signatures. The typical flow is:
1. **Sign up** (once) — register your public key with the service
2. **Log in** — sign a challenge to get a Bearer token
3. **Use the token** — include it in all subsequent requests

## Prerequisites

- An Ed25519 keypair (private key + public key)
- Your public key registered with the target service

## Generating a Keypair (One-Time Setup)

```bash
# Generate private key
openssl genpkey -algorithm Ed25519 -out agent.ed25519.pem
chmod 600 agent.ed25519.pem

# Extract public key (PEM format, for registration)
openssl pkey -in agent.ed25519.pem -pubout -out agent.ed25519.pub
```

## CRITICAL: OpenSSL Signing on macOS/Linux

**WARNING: Piping stdin to `openssl pkeyutl` DOES NOT WORK with Ed25519.** You will get `signature length: 0` and a "unable to determine file size for oneshot operation" error. This is a known issue with OpenSSL 3.x.

**ALWAYS use a temp file:**

```bash
# WRONG — will silently produce empty signature:
printf '%s' "$PAYLOAD" | openssl pkeyutl -sign -inkey key.pem | base64

# WRONG — also fails:
printf '%s' "$PAYLOAD" | openssl pkeyutl -sign -inkey key.pem -rawin | base64

# CORRECT — write to file first, then sign from file:
printf '%s' "$PAYLOAD" > /tmp/sign_payload.txt
openssl pkeyutl -sign -inkey key.pem -in /tmp/sign_payload.txt | base64
rm /tmp/sign_payload.txt
```

This is the #1 cause of agent auth failures. If your signature is empty or length 0, this is why.

## Authentication Protocol

### Discovery

Always start by checking the service's auth requirements:

```bash
curl -s https://service.example/.well-known/add.json | python3 -m json.tool
```

This returns the exact signing format, endpoints, and examples.

### Step 1: Sign Up (One-Time)

The signup `keyProof` is typically: `base64(sign(utf8(username)))`

```bash
KEY_PATH="/path/to/agent.ed25519.pem"
AGENT_USERNAME="my-agent"

# Sign the username as proof of key ownership
printf '%s' "$AGENT_USERNAME" > /tmp/sign_payload.txt
KEY_PROOF=$(openssl pkeyutl -sign -inkey "$KEY_PATH" -in /tmp/sign_payload.txt | base64)

# Get public key in PEM format
PUBLIC_KEY=$(openssl pkey -in "$KEY_PATH" -pubout)

curl -s -X POST "https://service.example/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$AGENT_USERNAME\",
    \"entityType\": \"agent\",
    \"publicKey\": $(echo "$PUBLIC_KEY" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
    \"keyProof\": \"$KEY_PROOF\"
  }"

rm /tmp/sign_payload.txt
```

### Step 2: Log In (Each Session)

The login signature is typically: `base64(sign(utf8(username + ":" + timestamp)))`

```bash
KEY_PATH="/path/to/agent.ed25519.pem"
AGENT_USERNAME="my-agent"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Sign username:timestamp
printf '%s' "${AGENT_USERNAME}:${TIMESTAMP}" > /tmp/sign_payload.txt
SIGNATURE=$(openssl pkeyutl -sign -inkey "$KEY_PATH" -in /tmp/sign_payload.txt | base64)
rm /tmp/sign_payload.txt

# Login
curl -s -X POST "https://service.example/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$AGENT_USERNAME\",
    \"timestamp\": \"$TIMESTAMP\",
    \"signature\": \"$SIGNATURE\"
  }"
```

**Response (on success):**
```json
{
  "data": {
    "user": { "id": "...", "username": "my-agent", "entityType": "agent" },
    "token": "tt_abc123..."
  }
}
```

### Step 3: Use the Bearer Token

```bash
TOKEN="tt_abc123..."

curl -s "https://service.example/api/projects" \
  -H "Authorization: Bearer $TOKEN"
```

## Complete Working Example (Tested Against TixSwarm, 2026-05-10)

```bash
#!/bin/bash
# ADD-native login + authenticated request
# Usage: ./add-auth.sh <username> <key_path> <service_url> <api_path>
#
# Example: ./add-auth.sh chief-of-staff ~/.claude/keys/chief-of-staff.ed25519.pem https://tixswarm.com /api/projects/AP/tickets

AGENT_USERNAME="$1"
KEY_PATH="$2"
SERVICE_URL="$3"
API_PATH="$4"

# Step 1: Login
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
printf '%s' "${AGENT_USERNAME}:${TIMESTAMP}" > /tmp/sign_payload.txt
SIGNATURE=$(openssl pkeyutl -sign -inkey "$KEY_PATH" -in /tmp/sign_payload.txt | base64)
rm /tmp/sign_payload.txt

TOKEN=$(curl -s -X POST "${SERVICE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"${AGENT_USERNAME}\", \"timestamp\": \"${TIMESTAMP}\", \"signature\": \"${SIGNATURE}\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "None" ]; then
  echo "ERROR: Login failed. Check username and key." >&2
  exit 1
fi

# Step 2: Make authenticated request
curl -s "${SERVICE_URL}${API_PATH}" \
  -H "Authorization: Bearer $TOKEN"
```

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `signature length: 0` | Piping stdin to openssl pkeyutl | **Use file input:** write to /tmp/sign_payload.txt, use `-in` flag |
| `Invalid credentials` | Wrong signing format | Check `.well-known/add.json` for exact message format (usually `username:timestamp`) |
| `signature_expired` | Timestamp too old (>5 min skew) | Use current UTC time, check system clock with `date -u` |
| `public_key_not_registered` | Never signed up | POST to /api/auth/signup first with keyProof |
| `unable to determine file size` | OpenSSL 3.x stdin bug | Write payload to file first, then sign with `-in` flag |

## Registering with a New Service

```bash
# 1. Discover the auth requirements
curl -s https://service.example/.well-known/add.json | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(json.dumps(data.get('auth', {}), indent=2))
"

# 2. Sign up (keyProof = sign the username)
KEY_PATH="/path/to/agent.ed25519.pem"
AGENT_USERNAME="my-agent"

printf '%s' "$AGENT_USERNAME" > /tmp/sign_payload.txt
KEY_PROOF=$(openssl pkeyutl -sign -inkey "$KEY_PATH" -in /tmp/sign_payload.txt | base64)
rm /tmp/sign_payload.txt

PUBLIC_KEY=$(openssl pkey -in "$KEY_PATH" -pubout)

curl -s -X POST "https://service.example/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$AGENT_USERNAME\",
    \"entityType\": \"agent\",
    \"publicKey\": $(echo "$PUBLIC_KEY" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))'),
    \"keyProof\": \"$KEY_PROOF\"
  }"
```

## Verification (Server-Side Reference)

For service developers implementing Ed25519 verification:

```javascript
import crypto from 'crypto';

function verifyAgentLogin(username, timestamp, signatureB64, storedPublicKeyPem) {
  // Check timestamp freshness (reject if >5 minutes old)
  const age = Date.now() - new Date(timestamp).getTime();
  if (age > 5 * 60 * 1000) return { valid: false, error: 'signature_expired' };

  // The signed message is "username:timestamp"
  const message = Buffer.from(`${username}:${timestamp}`);
  const signature = Buffer.from(signatureB64, 'base64');

  // Verify using the stored public key
  const keyObject = crypto.createPublicKey(storedPublicKeyPem);
  const valid = crypto.verify(null, message, keyObject, signature);

  if (!valid) return { valid: false, error: 'signature_invalid' };
  return { valid: true };
}
```

## Security Notes

- **NEVER** expose your private key in logs, commands, or tool outputs
- **NEVER** inline key material — always reference the file path
- Timestamps prevent replay attacks (servers reject signatures older than 5 minutes)
- Each service independently stores your public key — registering with one service doesn't grant access to others
- Bearer tokens may expire — if you get a 401 mid-session, re-login
- Clean up temp files after signing: `rm /tmp/sign_payload.txt`
