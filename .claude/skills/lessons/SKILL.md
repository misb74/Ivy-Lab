---
name: lessons
description: Learned Rules — Session Corrections. Apply when a user corrects a mistake or redirects an approach, to record and recall session-learned rules that prevent repeating the same class of error.
---

# Learned Rules — Session Corrections

Rules captured from user corrections. Each rule prevents a specific class of mistake from recurring.
Review periodically — remove rules that are no longer relevant.

## Project & Directory
(empty — rules accumulate here)

## Implementation Approach
- Don't pre-design routing infrastructure (orchestrators, sub-source modes, provenance columns) when the user's actual ask is a single-question chooser. Branch at the skill level first; add tool/server changes only if the simple path doesn't hold.
- When you ship a behavior change to a skill or CLAUDE.md, check both the parent repo (`/Users/moraybrown/Desktop/Ivy/.claude/`) and any active worktree (`/Users/moraybrown/Desktop/Ivy/.claude/worktrees/<name>/.claude/`). Edits in only one location won't apply to sessions opened in the other.

## Data & Accuracy
(empty)

## UI & Artifacts
- When user asks for a document/report, always ask whether they want **HTML** (rich layout, print-to-PDF) or **DOCX** (Word, via doc-generator MCP tool) before generating. Don't assume format.
