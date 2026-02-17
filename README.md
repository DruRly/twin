# Twin-Driven Development

> **Old TDD**: write the tests first. **New TDD**: write the twin first.

A `.twin` file encodes your decision-making DNA — your taste, your biases, your heuristics. Drop it into any project and your AI tools make decisions the way you would.

The twin is not a PRD. It's not a project spec. It's **you**.

## The Problem

AI agents have velocity but no vector. They'll do whatever you tell them — but when you stop telling them, they stop. You're not writing code, but you're always on call. Checking at 2am. Writing the next batch. Going back to sleep.

**We call this Vampire Coding.** Technically hands-off. Practically consumed.

The root cause: agents don't know what you *would* build next. They don't have your taste.

## The Solution

Three commands. That's it.

```bash
twin init     # encode your taste
twin plan     # your twin decides what to build
twin build    # your twin builds it
```

## Quick Start

```bash
# 1. Set your OpenRouter API key
export OPENROUTER_API_KEY="your-key-here"

# 2. Create your twin
npx twin-cli init
# → Asks your name, then 5 questions about how you build
# → Generates dru.twin (or whatever your name is)

# 3. Generate your first plan
npx twin-cli plan
# → Reads your twin, asks about your product, writes prd.json + tasks.md

# 4. Let your twin build it
npx twin-cli build
# → Spawns Claude Code in a loop, builds each story, updates prd.json as it goes
```

Get an OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys).

## The Loop: init → plan → build → plan

This is the core workflow. Your twin drives the whole cycle:

1. **`twin init`** — create your taste profile (once)
2. **`twin plan`** — your twin generates tasks that match how you'd prioritize
3. **`twin build`** — your twin builds autonomously, updating prd.json as stories complete
4. **`twin plan`** again — your twin sees what's done and plans what's next

Each iteration, Claude Code starts fresh but reads the files on disk — your twin, the PRD, and a progress log. The files are the memory. Your taste stays consistent across every iteration.

## Commands

### `twin init`
Asks your name, then 5 questions about how you build things. Generates `yourname.twin` — your decision-making DNA.

### `twin plan`
Reads your `.twin` file + project context, generates 3-5 atomic capabilities that match your taste.

Outputs two files:
- **`prd.json`** — structured JSON with user stories and status tracking
- **`tasks.md`** — human-readable Markdown, paste-able into any AI chat

If no `product.md` exists, `twin plan` asks 2 quick questions to set up your project context first. Running it again appends new tasks without duplicating existing ones.

### `twin build`
Runs an autonomous build loop using Claude Code. Each iteration:
- Reads your twin file for taste
- Reads `prd.json` for open stories
- Picks the next story to build (the model decides, based on your taste)
- Builds it, commits, and marks it done in `prd.json`
- Appends learnings to `progress.md`
- Repeats until all stories are done or max iterations hit

```bash
twin build                     # default: 5 iterations
twin build --max-iterations 10 # custom limit
```

Requires [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed and available in your PATH.

## What Goes in a `.twin` File

- **Execution Bias** — do you plan or build first? Ship ugly or wait for polish?
- **Quality Compass** — how do you define "done"? What does "good" mean to you?
- **Decision-Making Style** — how do you get unstuck? How do you evaluate tradeoffs?
- **Strongly Held Beliefs** — what do you believe that others would disagree with?
- **Anti-Patterns** — what do you refuse to do?

## What Does NOT Go in a `.twin` File

- Your product's target user (that's a product doc)
- Your tech stack (that's a project config)
- Your roadmap (that's a PRD)

**The twin encodes how you think. Project files encode what you're building. The twin is the founder. The project files are the company.**

## Philosophy

This project follows the skateboard-to-car model of iterative delivery.

What comes next: `twin tweak` for natural language updates, `twin share` for publishing your taste publicly.

## License

MIT
