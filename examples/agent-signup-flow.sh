#!/bin/bash
# Agent Signup & Login Flow
# This script demonstrates the full authentication flow for an agent
# interacting with an ADD-native application.

set -euo pipefail

# Configuration — change these for your app
APP_URL="${APP_URL:-https://example.com}"
AGENT_USERNAME="${AGENT_USERNAME:-my-agent}"

echo "=== ADD Agent Signup & Login Flow ==="
echo "App: $APP_URL"
echo "Agent: $AGENT_USERNAME"
echo ""

# Step 1: Discover the app
echo "--- Step 1: Discover ---"
echo "GET $APP_URL/.well-known/add.json"
MANIFEST=$(curl -sf "$APP_URL/.well-known/add.json")
echo "$MANIFEST" | python3 -m json.tool
echo ""

# Extract endpoints from manifest
SIGNUP_URL=$(echo "$MANIFEST" | python3 -c "import sys,json; print(json.load(sys.stdin)['auth']['agent_signup'])")
LOGIN_URL=$(echo "$MANIFEST" | python3 -c "import sys,json; print(json.load(sys.stdin)['auth']['agent_login'])")

# Step 2: Generate Ed25519 keypair
echo "--- Step 2: Generate Keypair ---"
KEYDIR=$(mktemp -d)
openssl genpkey -algorithm Ed25519 -out "$KEYDIR/agent.pem" 2>/dev/null
openssl pkey -in "$KEYDIR/agent.pem" -pubout -out "$KEYDIR/agent.pub" 2>/dev/null
echo "Private key: $KEYDIR/agent.pem"
echo "Public key:  $KEYDIR/agent.pub"
PUBLIC_KEY=$(cat "$KEYDIR/agent.pub")
echo "$PUBLIC_KEY"
echo ""

# Step 3: Create key proof (sign username)
echo "--- Step 3: Sign Up ---"
KEY_PROOF=$(printf '%s' "$AGENT_USERNAME" | openssl pkeyutl -sign -inkey "$KEYDIR/agent.pem" | base64)
echo "Key proof (signature of username): ${KEY_PROOF:0:32}..."

# Build and send signup request
SIGNUP_BODY=$(python3 -c "
import json
print(json.dumps({
    'username': '$AGENT_USERNAME',
    'entityType': 'agent',
    'publicKey': '''$PUBLIC_KEY''',
    'keyProof': '$KEY_PROOF'
}))
")

echo "POST $APP_URL$SIGNUP_URL"
SIGNUP_RESPONSE=$(curl -sf -X POST "$APP_URL$SIGNUP_URL" \
  -H "Content-Type: application/json" \
  -d "$SIGNUP_BODY")
echo "$SIGNUP_RESPONSE" | python3 -m json.tool
echo ""

# Step 4: Log in
echo "--- Step 4: Log In ---"
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
MESSAGE="$AGENT_USERNAME:$TIMESTAMP"
SIGNATURE=$(printf '%s' "$MESSAGE" | openssl pkeyutl -sign -inkey "$KEYDIR/agent.pem" | base64)
echo "Signing: $MESSAGE"
echo "Signature: ${SIGNATURE:0:32}..."

LOGIN_BODY=$(python3 -c "
import json
print(json.dumps({
    'username': '$AGENT_USERNAME',
    'timestamp': '$TIMESTAMP',
    'signature': '$SIGNATURE'
}))
")

echo "POST $APP_URL$LOGIN_URL"
LOGIN_RESPONSE=$(curl -sf -X POST "$APP_URL$LOGIN_URL" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY")
echo "$LOGIN_RESPONSE" | python3 -m json.tool

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
echo ""
echo "=== Authenticated! ==="
echo "Token: ${TOKEN:0:32}..."
echo ""
echo "Use this token for subsequent requests:"
echo "  curl -H 'Authorization: Bearer $TOKEN' $APP_URL/api/me"

# Cleanup
rm -rf "$KEYDIR"
