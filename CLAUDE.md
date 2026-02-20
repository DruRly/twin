# Claude Instructions for Twin

## When you add a feature or command

1. **Update README.md** — document it under the relevant command section or add a new section. If it introduces a new file the user touches (like `steer.md`), show a concrete usage example.
2. **Update .gitignore** — any new generated file that lives in the user's project root (not the twin source) must be gitignored.
3. **Update BACKLOG.md** — mark the item done with a brief implementation note.

## Project structure

- `bin/twin.js` — CLI entry point, routes commands
- `src/build.js` — build loop, story iteration, steering, synthesis
- `src/plan.js` — reads twin + context, outputs prd.json
- `src/init.js` — interview flow, generates name.twin
- `src/generate.js` — LLM call to produce twin file content
- `src/llm.js` — shared LLM layer (callLLM)
- `src/prompt.js` — shared multi-line input handler

## Generated files (live in user's project, not this repo)

These are all gitignored in the user's project root:
- `name.twin` — developer taste file
- `prd.json` — product requirements with story status
- `progress.md` — build log
- `synthesis.md` — priority justification log (written before each story)
- `steer.md` — developer steering input (read and cleared at story boundaries)
- `twin-proposal.md` — proposed taste updates for human review

## Style rules

- No over-engineering. Ship the skateboard.
- Don't add features that aren't explicitly requested.
- Don't add docstrings or comments to code you didn't change.
- The `.twin` extension is the brand — never change it to `.md` or hidden files.
- Keep CLI output concise. Use `dim()` for secondary info, `bold()` for headers.
- All guidance messages at terminal moments (all done, story limit hit) must show both the manual option and `--loop`.
