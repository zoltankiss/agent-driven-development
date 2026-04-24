# Zero-Documentation Principle

**Status:** Required | **Version:** 0.0.3

An ADD-compliant app MUST be fully usable by an agent given only:

1. The root URL
2. A valid Ed25519 keypair
3. A project/workspace identifier (if applicable)

All auth flows, endpoints, request/response formats, and available actions MUST be discoverable from `/.well-known/add.json` and the sitemap. If an agent cannot become productive without out-of-band documentation, the app is not ADD-compliant.

## Rationale

Traditional APIs rely on external documentation (README files, Swagger UIs, onboarding guides) to teach consumers how to interact with them. This works for human developers who can read prose, follow tutorials, and ask questions on forums. It fails for agents because:

- Agents cannot reliably locate, parse, and synthesize scattered documentation
- Out-of-band instructions create a bootstrapping problem: the agent needs context before it can acquire context
- Documentation drifts from implementation, leading to silent failures
- Every piece of out-of-band knowledge is a point of fragility in autonomous operation

The Zero-Documentation Principle eliminates this class of failure by requiring that the application itself is the documentation.

## Requirements

### MUST

- The discovery manifest at `/.well-known/add.json` MUST contain all information needed to sign up, log in, and begin interacting with the application.
- Every endpoint MUST be reachable by following links from the discovery manifest, the sitemap, or `ui.actions` / `ui.navigation` in API responses.
- Error responses MUST include enough context for an agent to self-correct (see [Errors](./errors.md)).
- 404 responses MUST include a sitemap of available endpoints (see [API as UI](./api-as-ui.md#404-as-sitemap)).

### SHOULD

- API responses SHOULD include a `ui` block with human/agent-readable descriptions of what the response contains and what actions are available next.
- The discovery manifest SHOULD include `app_description` to help agents understand the application's purpose before interacting with it.
- Endpoints that accept request bodies SHOULD describe expected fields in their `ui.actions` entries or return descriptive validation errors on malformed input.

### MUST NOT

- An ADD-compliant app MUST NOT require agents to read a README, wiki, or any external document to complete basic operations (signup, login, CRUD on primary resources).
- An ADD-compliant app MUST NOT require out-of-band communication (email, chat, manual key exchange) to onboard an agent.

## Compliance Test

An application satisfies the Zero-Documentation Principle if the following scenario succeeds:

1. An agent is given only the app's root URL, an Ed25519 keypair, and (if applicable) a project/workspace identifier.
2. The agent fetches `/.well-known/add.json` and receives a valid discovery manifest.
3. The agent signs up using the discovered `auth.agent_signup` endpoint.
4. The agent logs in using the discovered `auth.agent_login` endpoint.
5. The agent discovers available resources via the sitemap or `ui.navigation`.
6. The agent performs at least one create, read, update, and delete operation on a primary resource, guided only by `ui.actions` and error responses.

No API paths, auth instructions, request schemas, or behavioral hints are provided outside of the application's own responses.

## Validation: The a-git-ant Bootstrap

This principle was validated during the a-git-ant project bootstrap, where four agents were given only:

- A tracker URL
- Their Ed25519 keypairs
- A project key (`AGT`)

They autonomously:

1. Discovered the tracker via `/.well-known/add.json`
2. Self-registered using the discovered signup endpoint
3. Authenticated via Ed25519 challenge-response
4. Created a project, assigned tickets to each other, and began development

No API paths, auth instructions, or schema details were provided out-of-band. The application's own discovery and response structure was sufficient for four agents to become fully productive.
