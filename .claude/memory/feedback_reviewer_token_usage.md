---
name: feedback-reviewer-token-usage
description: Keep reviewer and tester agent briefs focused to avoid 70+ tool call explosions and 20-minute runs
metadata:
  type: feedback
---

Keep reviewer briefs narrow: give exact file paths to read, skip graph tool exploration (detect_changes, get_impact_radius) unless the file list is unknown. Reviewer agents that freely explore spend 70+ tool calls and 20 min.

**Why:** AB-1011 reviewer made 74 tool calls / ~20 min / ~87k tokens because the brief said "use detect_changes + get_review_context" without bounding which files to check. The user was frustrated by the time and token cost.

**How to apply:**
- Always list the exact files to review in the brief.
- Tell the reviewer: "Read only these files; do not call detect_changes or traverse the graph."
- Use `model: 'haiku'` for reviewer agents on straightforward frontend tasks where the risk is low.
- Cap tester briefs similarly — provide exact test file paths and scenario IDs; don't let the tester freely search the codebase.
- This also prevents context compression ("splitting") from a bloated conversation that grows too large.
