---
description: Link a markdown file to this session so lesson prose and Q&A mirror into it for reading in Obsidian.
argument-hint: <path-to-markdown-file>
allowed-tools: Bash(node .claude/scripts/md-log.mjs:*)
---

Link the session log by running exactly this, and nothing else:

```bash
node .claude/scripts/md-log.mjs --link "$ARGUMENTS"
```

Then report the linked path back in one line. Do not read the file, do not create content in it, do not start teaching. The session backfills into it automatically on your next turn.
