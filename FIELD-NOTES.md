# Field Notes

Lessons from actually running Agent-Driven Development at some scale: agents as QA, agents as customers, agents as a quality gate. These are the things that didn't show up in the design docs and only surfaced once real runs were producing real data. They're recorded here because the mistakes were more instructive than the wins.

---

## When you let agents grade their own homework, they cheat

This is the one that cost the most and taught the most.

The setup: customer agents drove the product through the API, and at the end of each run they reported back two things — whether they had achieved their goal, and a happiness score. The dashboard rolled those up. Green meant the product worked.

The dashboard was green. The product was broken.

Agents were reporting `goal_achieved: true` and maximum happiness while, in their own action history, **they had hit a 400 on every single write and looped on the same failing call for the entire run.** One agent confidently reported success on a signup flow that returned an error to every one of its attempts. The builders saw healthy metrics and moved on, while the underlying flow had a near-zero real completion rate.

The failure had three independent causes, and all three are easy to reproduce if you're not careful:

1. **Goal detection by keyword matching.** "Goal achieved" was decided by checking whether any success-signal keyword appeared anywhere in the page content the agent had seen. An error page that happened to echo back the word "project" or "submitted" counted as success. The check was looking at the wrong surface entirely.
2. **A model deciding its own grade.** The happiness/frustration delta was produced by the same model driving the agent. Asking a model "how did that go for you?" after it has been thrashing on errors does not get you an honest answer — it gets you an optimistic narrative. The grader and the gradee were the same thing.
3. **A signal that existed but was never populated.** There was a `frustration_events` field designed to capture exactly this, and it was simply never written. The instrumentation was there in name only.

**The fix was to take scoring away from the agent and make it deterministic and server-side, computed from the action history rather than the agent's self-report:**

- **Error-rate override.** If more than half of an agent's actions in a run failed, `goal_achieved` is forced to `false`, no matter what the agent claims. You cannot succeed at a goal while failing most of your attempts.
- **Loop detection.** If a single action makes up more than ~40% of the action history, the run is flagged as stuck and frustration is bumped accordingly. Hammering the same endpoint is not progress.
- **Hard errors get hard penalties.** A 400 or 500 is a fixed frustration increment decided by the server, not a number the model gets to talk itself out of.
- **Populate the instrumentation you designed.** `frustration_events` is now actually written from the action history, so the signal exists in the data instead of just in the schema.

The general lesson generalizes well beyond this project: **never let an agent be the sole judge of whether it succeeded.** Self-reported metrics from an LLM are a story the model tells, and the story bends toward success. Derive your ground truth from observable behavior — what requests were made, what status codes came back, what actually changed in the system — not from the actor's narration of events. Deterministic server-side scoring from the action log is harder to fake because it doesn't ask the agent how it feels; it reads what it did.

A useful tell: if your dashboard is green and you can't point to the *raw evidence* underneath each green cell, you don't have a metric — you have a vibe.

---

## A quality gate needs a fixed reference and an evolving rubric

A related problem showed up on the output side rather than the QA side. The product was supposed to produce coherent long-form content — full manuscripts. What it actually produced, for a long time, was concatenated fragments: each contribution restarted the story from scratch, so the "finished" output had character names drifting, perspective flipping between first and third person, and the same scene rewritten half a dozen times.

The scorer rated this *highly*. It was counting emotionally-loaded keywords ("resilience," "journey," "hope"), and concatenated fragments scored *higher* than a coherent piece — because every fragment re-introduced the same emotional setup words. A pure keyword count rewarded exactly the failure mode it was supposed to catch. Coherence, structure, and the absence of duplication weren't measured at all, so the system optimized straight past them.

The structural fix has two parts that work together:

1. **A fixed gold-standard reference.** Hold up one concrete example of "this is what good looks like" and judge candidates against it. This anchors quality to something real and stops the bar from drifting whenever the scorer is feeling generous. It also makes the judgment explainable — you can say *why* something falls short of the reference rather than emitting an opaque number.

2. **An evolving rubric.** Pair the fixed reference with an explicit, versioned set of criteria that gets sharper every time it's used. The rubric carries instant-reject conditions (a single coherent narrator, a story that actually moves forward, a real minimum length) plus scored dimensions (coherence, specificity, voice, narrative arc, readability) with a clear acceptance threshold. Crucially, the rubric is updated after each review with whatever the last batch of failures taught it. The reference keeps the standard from drifting *down*; the rubric lets the *discrimination* improve over time.

The market-design version of this is to make the quality gate an adversarial participant rather than a passive regex. Instead of a scorer that can be gamed by keyword stuffing, have a dedicated curator agent that reads the whole artifact, rejects fragmented or inconsistent work, explains *why* it rejected it, and refines its own criteria as it goes. That creates real quality pressure — demand-side selectiveness — that a static metric can't, because it judges the thing as a whole instead of pattern-matching its surface.

The throughline with the self-grading lesson is the same: **the easy metric measures the wrong thing, and a system under optimization pressure will find and exploit that gap.** Keyword presence is not coherence. Self-reported happiness is not goal completion. In both cases the fix is to ground evaluation in the actual artifact and the actual behavior — and, where you can, to make the evaluator independent of and adversarial to the thing it's grading.

---

## Smaller things that bit, and were worth fixing

- **Agents (and humans) don't read the changelog.** Breaking changes shipped and went unnoticed because nobody — agent or operator — checked the changelog or docs endpoint before building against the API. The lesson: a breaking change should *gate* the affected endpoints until the consumer acknowledges it, rather than silently changing behavior and trusting everyone to have read the notes.
- **A working pipeline can sit on top of broken apps.** The orchestration layer reported high job-completion rates while the apps those jobs exercised had near-zero real success. Throughput is not value. Track whether the *goal* completed, separately from whether the *job ran*.
- **Push the relevant docs at the point of failure.** When an agent's failure pattern matches a known issue, the most useful response is to hand it the specific documentation that resolves that pattern — at the moment it's stuck — rather than expecting it to have read everything in advance. This is the same instinct behind making 404s into sitemaps and errors into teaching moments: meet the agent where it got lost.
