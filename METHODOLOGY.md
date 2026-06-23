# Agent-Driven Development: The Methodology

> Build the API, run autonomous agents against it for feedback in minutes, *then* build the UI. If an agent can accomplish a real goal through your product, a human can too.

This document is the methodology behind the protocol. The rest of the repo specifies *how* an ADD-native API should behave. This explains *why you build that way* and how to use agents as your first users, your QA team, and your fastest feedback loop.

---

## The core inversion

Traditional development ships to humans late. You build for weeks on assumptions, test by hand, push to staging, let QA find issues, fix, ship, and then real users find the rest. The first honest signal about whether the product *works* arrives at the very end — after the most expensive work is already done.

ADD inverts the order:

1. Define your users as agents with goals and personas.
2. Build the minimum API.
3. Run agents against it immediately.
4. Agents attempt real workflows and report where they got stuck.
5. Fix, rerun, repeat until agents succeed end to end.
6. *Then* build the human UI — the API already works, and the UI is mostly presentation.

| Aspect | Traditional | ADD |
| --- | --- | --- |
| First users | Humans, after weeks | Agents, within hours |
| QA | Manual passes or unit tests | Agents driving real workflows |
| Feedback loop | Days to weeks | Minutes |
| UX validation | After the UI exists | Before the UI exists |
| Availability of testers | Need real users to surface bugs | Agents are always on call |

The key claim is not that agents replace human users. It is that **agent success is a leading indicator of human usability.** An agent that can only see what your API returns is a brutally honest black-box tester: if the response doesn't tell it what it can do and where to go next, it gets lost — exactly where a human would get confused.

---

## API-as-UI: design the surface agents will judge you on

Agents navigating a rendered web page like a human is expensive in tokens and brittle. The natural interface for an agent is the API. But a conventional API returns raw data with no context:

```json
{ "projects": [ { "id": "123", "title": "My Memoir", "budget_min": 1000 } ] }
```

An agent seeing this has no idea what page it is on, what it can do, or where to navigate next. The fix is to treat **every response like a self-describing page**. The only things that belong exclusively to the human-UI layer are style (agents don't care about button color) and spatial layout (agents don't care whether a button is above or beside another). Everything else — the data, the available actions, the navigation, the auth state — lives in the API.

```json
{
  "view": "project_list",
  "title": "Open Projects",
  "breadcrumbs": [ { "label": "Home", "href": "/api/v1" }, { "label": "Projects", "href": null } ],
  "content": { "projects": [ { "id": "123", "title": "My Memoir", "budget": "$1,000 - $2,000" } ] },
  "actions": [
    {
      "id": "post_project",
      "label": "Post Your Own Project",
      "method": "POST",
      "href": "/api/v1/projects",
      "requires_auth": true,
      "form_fields": [
        { "name": "title", "type": "string", "required": true },
        { "name": "budget_min", "type": "number", "required": true }
      ]
    }
  ],
  "navigation": { "back": { "label": "Home", "href": "/api/v1" } },
  "auth": { "is_authenticated": false, "login_url": "/api/v1/auth/login" }
}
```

The payoff comes at UI time. If the API already names the view, the title, the available actions, the form fields, and the navigation, the frontend is a thin renderer:

```tsx
function PageRenderer({ response }) {
  return (
    <Layout>
      <Breadcrumbs items={response.breadcrumbs} />
      <h1>{response.title}</h1>
      <ContentRenderer view={response.view} content={response.content} />
      <ActionButtons actions={response.actions} />
      <Navigation links={response.navigation} />
    </Layout>
  );
}
```

The structure is already there. The frontend adds styling and layout — nothing more. Two consequences worth stating plainly: **agents and humans run the same code paths**, so a bug an agent hits is a bug a human would have hit; and **404s become sitemaps** — a lost agent (and a lost human) gets the full map of available endpoints instead of a dead end.

---

## Customer agents are black boxes — and that's the point

There are two kinds of agent in an ADD project, and keeping them separate is what makes the feedback honest.

**The builder** has full access — code, database, shell, logs. It reads agent feedback, fixes issues, and iterates. It never uses the product as a customer.

**Customer agents** have *only* API access. They cannot read the database, the source, or any internal state. They are synthetic users with goals and personalities, and they interact with the product exactly the way a person would — through whatever the API chooses to show them.

```python
class FounderPersona(BaseAgent):
    """
    A 38-year-old startup founder who wants to write a memoir.
    Decisive, impatient, articulate. Will not tolerate bad UX.
    """
```

If the API is confusing, the customer agent suffers — and reports it. The discipline is to never let a customer agent peek behind the curtain. The moment it can query the database to "figure out" what to do, it stops being a proxy for a human and starts hiding your UX problems.

---

## Architect the codebase around the weakest executor

A separate but closely related insight comes from running a tiered build pipeline: a strong model setting strategy, a mid-tier model decomposing work into tickets, and a small, cheap, locally-runnable model doing the actual file edits. The weak executor is the constraint, and you design the whole codebase around its cognitive limits.

A small coding model:

- cannot hold more than ~150 lines in context at once,
- cannot reason reliably about complex cross-file dependencies,
- will rewrite an entire file from scratch rather than patch it, and
- works best when a file's purpose is obvious from its name and imports.

So the architecture rules become non-negotiable constraints, not style preferences:

- **Every source file stays under ~120 lines** (target 60–100). If a module would exceed that, split it. The entry point only mounts routes and starts the server.
- **One responsibility per file.** Route files define HTTP handlers and never run SQL; data-access files run queries and never define handlers.
- **One shared `types.ts`** that everything may import — the single source of truth for shapes, so each file can be written correctly while only seeing the types it imports, not the bodies of other files.
- **A clean dependency DAG.** No circular imports. Each file imports from at most a handful of others, so a ticket can be executed with just the target file plus the *signatures* of its dependencies in context.
- **Interface-first.** Define exact function signatures and return types up front; the executor treats them as a contract.
- **Whole-file rewrites with a test gate.** Because the weak model rewrites rather than patches, every change is "emit the complete file," followed immediately by a test command that returns a clean exit code on success.

The dividend shows up in **dependency-aware self-repair**. When a generated file fails its test because a dependency it needs doesn't exist yet, the planner doesn't blindly retry the same ticket — it creates a ticket for the missing dependency *first*, boosts its priority, and re-queues the original. Failures get reviewed in batches and turned into corrected, reprioritized work rather than retry-looped.

The general principle generalizes well beyond local models: **make the system legible to its least capable participant.** Small files, explicit contracts, and a clean dependency graph are good engineering anyway — designing for a weak executor just forces the discipline.

---

## Model tiering: spend tokens where they buy quality

Most agent actions are cheap decisions. A few are expensive content. Match the model to the task instead of paying premium rates for "which button do I click."

| Task | Model tier | Why |
| --- | --- | --- |
| Navigation decisions ("what do I click next") | Cheap / fast | Structured choice, no creativity needed |
| Form filling | Cheap / fast | Structured output from known fields |
| Authentic interview answers | Mid | Needs genuine, specific content |
| Final long-form content | Strong | Highest-quality output, the actual deliverable |

In practice a full simulation run dominated by hundreds of navigation calls plus a handful of content calls costs cents, not dollars — cheap enough to iterate freely. The same tiering applies to the build side: a strong model for strategy and review, a mid-tier model for ticket decomposition, and the cheapest viable model for execution.

---

## Graceful-failure agent design

The single most important behavior rule for a customer agent: **do not loop on a broken endpoint, and do not flood the feedback channel.** An agent that retries forever burns tokens and produces nothing. An agent that files a feedback item on every tick produces a hundred duplicates that bury the one signal you needed.

The pattern is bounded retries followed by a clean stop:

```python
class BaseAgent:
    def __init__(self):
        self.blocked = False
        self.consecutive_failures = 0
        self.max_consecutive_failures = 3

    def take_turn(self):
        if self.blocked:
            return {"action": "blocked", "reason": self.blocked_reason}

        result = self._do_action()
        if not result.success:
            self.consecutive_failures += 1
            if self.consecutive_failures >= self.max_consecutive_failures:
                self._write_feedback(
                    type="bug_report",
                    summary=f"Blocked after {self.consecutive_failures} failures",
                    details="Reporting and stopping until this is fixed.",
                )
                self.blocked = True
                self.blocked_reason = result.error
        else:
            self.consecutive_failures = 0
```

Without this: 100 ticks become 100 duplicate feedback items and a pile of wasted calls. With it: one clear, actionable feedback item, and the builder knows exactly what to fix. When the builder fixes the issue and reruns, agents `reset()` to a clean state and try again.

---

## The feedback channel must never break

Feedback is the product of the whole loop, so the channel that carries it has to survive everything else failing — including the API being down, the database being corrupted, or the server being on fire. The most robust option is the simplest: **plain JSON files on disk.**

```
feedback/
  001-founder-2026-01-17T14-30-00.json
  002-writer-2026-01-17T14-31-00.json
```

```json
{
  "agent_id": "founder_persona",
  "timestamp": "2026-01-17T14:30:00Z",
  "type": "bug_report",
  "severity": "high",
  "summary": "Cannot register — repeated 500 error",
  "details": "Tried 3 times, server returned 500 each time. Stopping until fixed.",
  "context": {
    "endpoint": "POST /api/v1/auth/register",
    "response_status": 500,
    "goal": "Register so I can post my memoir project"
  }
}
```

Two axes carry most of the signal: a **type** (`bug_report`, `usability_issue`, `feature_request`, `praise` — praise matters; it tells you what *not* to break) and a **severity** (`low`, `medium`, `high`, `critical`). A file channel has a nice property a database-backed one lacks: when everything else is broken, this still works, which is precisely when you most need to hear from your agents.

---

## Tick-based simulation

Run the simulation as discrete ticks — one action per agent per tick — and run agents sequentially rather than in parallel. Sequential execution is easier to follow in logs, has no race conditions, and tends to be more realistic than a thundering herd of simultaneous requests.

```python
for tick in range(max_ticks):
    founder.take_turn()
    writer.take_turn()
```

Log every action twice: a human-readable narrative line you can `tail -f` while the run proceeds, and a machine-readable JSONL record you can analyze afterward. Define success explicitly and deterministically — goal reached, no critical feedback, agents not stuck in loops — and define failure just as explicitly so a run can end on its own:

- **Success:** agents achieve their goals, no critical feedback outstanding, no loop or error patterns in the action history.
- **Failure:** all agents blocked, feedback piling up, or max ticks reached without completion.

---

## The development loop

```
1. CHECK FEEDBACK   →  read feedback/*.json — what are agents blocked on?
2. BUILD / FIX      →  fix the reported issue, or build the next thing they need
3. SANITY CHECK     →  hit the API directly; does it respond?
4. RUN AGENTS       →  run the tick-based simulation
5. CHECK RESULTS    →  read the narrative log; did they progress? where did they stall?
6. SUCCESS?         →  yes: done. no: clear feedback, return to step 1.
```

---

## When ADD fits — and when it doesn't

**Good fits:** marketplaces (two-sided, complex flows, agents can play both sides), SaaS tools with clear user goals, content platforms (agents can both create and consume), and anything API-first by nature.

**Poor fits:** games and other timing- or visually-dependent products, creative tools whose output is too subjective to score, and anything requiring physical interaction that can't be simulated.

**Signals it's working:** agents find real bugs before you do; feedback leads to genuine improvements; the simulation runs unattended; agent success tracks human usability.

**Signals it's not working:** agents are confused by model limitations rather than real UX problems; feedback is noise, not signal; you spend more time debugging the agents than building the product. If that's where you are, the agents have stopped being a proxy for your users — fix that before trusting another run.
