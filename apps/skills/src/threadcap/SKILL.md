---
name: threadcap
description: Ship the current conversation (or named capsule versions) into ThreadCap and back into this chat without ever starting from zero. Use when the user says "save this", "inject context", "update my capsule", or references ThreadCap.
---

# ThreadCap skill

Every toggle below is safe: capturing a thread never re-reads anything without an explicit user gesture
(zero-ingest posture, H-REQ-12 / D-015), and injections are always purpose-driven briefs with token budgets (D-012).

## Workflow
1. **Capture** — `threadcap cap --save <title>` stores this conversation as an immutable capsule version.
2. **Inject** — `threadcap inject --purpose <purpose> --budget <tokens>` prepares a brief and pastes it in.
3. **Update** — `threadcap cap --update` diffs against the latest version and creates vN+1.

## Setup
Run `setup.sh` (or `threadcap setup`) once: installs the CLI, registers this skill, and authenticates.
Repeated runs are idempotent.