---
name: import-notes
description: Import the learner's own notes (markdown or text files, or a folder of them) into their knowledge graph, so the probe and practice know what they've already studied elsewhere. Re-importing an unchanged file does nothing; an appended file imports only the new part.
argument-hint: <file or folder> [...]
disable-model-invocation: true
---

# Import notes

1. **Resolve the files.** Each argument is a file or a folder; a folder means every `.md` and `.txt` under it (`Glob`), excluding anything in `lessons/`, `practice/`, `graph/`, `viz/` and `.claude/` — those are the system's own files. Names without a path: find them yourself (`Glob`), never ask them to paste. Files are best kept inside the vault, so the notes' source links resolve in Obsidian; outside files still import, with unlinked sources.

2. **Run the extraction** exactly as `.claude/skills/extract/SKILL.md` describes, passing the files to `pending`:

   ```bash
   node .claude/scripts/graph.mjs pending <file> [<file> ...]
   ```

   For every stretch whose `source` is one of these files, dispatch the extractor with `MODE: notes`. Pending lesson-log stretches that show up too may be processed in the same run (`MODE: session`).

3. **Report** per file: new ideas, ideas linked to what the graph already held, or "unchanged since last import".
