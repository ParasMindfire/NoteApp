---
name: feedback-no-code-review-graph
description: Do not call code-review-graph MCP tools during /implement — user wants direct implementation without graph orientation step
metadata:
  type: feedback
---

Skip the GRAPH ORIENTATION step (detect_changes, get_architecture_overview, semantic_search_nodes) entirely during /implement. Go straight to reading files and writing code.

**Why:** User explicitly interrupted graph tool calls and said "stop calling code review graph and start implementation."

**How to apply:** On every /implement run, skip the "GRAPH ORIENTATION" block and proceed directly to file reads and task implementation. Do not call any `mcp__code-review-graph__*` tools at the start of a ticket.
