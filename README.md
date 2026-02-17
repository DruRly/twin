# Twin-Driven Development

Old TDD meant write the tests first. New TDD means write the twin first.

A `.twin` file is your decision-making source code. Your taste. Your biases. Your heuristics. Drop it into any project and your AI tools make decisions the way you would.

The twin is not a PRD. It is not a project spec. It is you.

## The Problem

AI agents have velocity but no vector. They do what you tell them. When you stop telling them, they stop.

You are not writing code. But you are checking at 2am. Writing the next batch of tasks. Going back to sleep. Waking at 5am to check again.

This is Vampire Coding. Hands-off in theory. Consumed in practice.

The root cause: agents do not know what you would build next. They do not have your taste.

## The Fix

Three commands.

```
twin init     # encode your taste
twin plan     # your twin decides what to build
twin build    # your twin builds it
```

## Before You Start

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **OpenRouter API key** — [openrouter.ai/keys](https://openrouter.ai/keys) (used by `twin init` and `twin plan`)
- **Claude Code** — [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) (used by `twin build`)

## Quick Start

Every twin project starts in its own folder. Create one, then run the commands from inside it.

```bash
# 0. Create a project folder
mkdir my-app && cd my-app

# 1. Set your OpenRouter API key
export OPENROUTER_API_KEY="your-key-here"

# 2. Create your twin (only need to do this once)
npx twin-cli init
# → Asks your name, then 5 questions about how you build
# → Generates yourname.twin

# 3. Generate your first plan
npx twin-cli plan
# → Reads your twin, asks about your product, writes prd.json

# 4. Let your twin build
npx twin-cli build
# → Spawns Claude Code in a loop
# → Builds each story, updates prd.json as it goes
```

Get an OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys).

## Example: Building a Habit Tracker

Here is a full walkthrough from zero to working app.

```bash
# Create the project
mkdir habit-tracker && cd habit-tracker

# Set your key
export OPENROUTER_API_KEY="sk-or-..."

# Create your twin
npx twin-cli init
# → "What should we call you?" → Dru
# → Answer 5 questions about how you build
# → Generates dru.twin

# Generate the plan
npx twin-cli plan
# → "What are you building?" → A habit app with GitHub-style tracking and timers
# → "Who is it for?" → People who want to build daily habits
# → Writes prd.json with 3-5 user stories based on YOUR taste

# Build it
npx twin-cli build
# → Claude picks the first story, builds it, marks it done
# → Picks the next story, builds it, marks it done
# → You watch it happen in real time

# Want more features? Plan again.
npx twin-cli plan
# → Sees what is done, generates the next batch
npx twin-cli build
```

Your `.twin` file is portable. Copy it into any new project and run `twin plan` to start.

## Project Ideas

Twin works best on new projects. Some things to try:

- **Habit tracker** with streaks and daily timers
- **Personal landing page** with email capture and a changelog
- **Micro-SaaS dashboard** for tracking one metric
- **CLI tool** that solves a problem you keep solving manually
- **PWA** that replaces a spreadsheet you use every day

## The Loop

`init → plan → build → plan`

This is the core cycle. Your twin drives the whole thing.

1. **`twin init`** — create your taste profile (once)
2. **`twin plan`** — your twin generates tasks that match how you prioritize
3. **`twin build`** — your twin builds on its own, updating `prd.json` as stories complete
4. **`twin plan` again** — your twin reads what shipped and plans what comes next

Each iteration, Claude Code starts fresh but reads the files on disk. Your twin. The PRD. A progress log. The files are the memory. Your taste stays consistent across runs.

## Commands

### `twin init`

Asks your name, then 5 questions about how you build things. Generates `yourname.twin`.

### `twin plan`

Reads your `.twin` file and project context. Generates 3-5 atomic capabilities that match your taste. Writes `prd.json` with user stories and status tracking.

If no `product.md` exists, `twin plan` asks 2 quick questions to set up your project context first. Running it again adds new stories without duplicating old ones.

### `twin build`

Runs an autonomous build loop using Claude Code. Each iteration:

- Reads your twin file for taste
- Reads `prd.json` for open stories
- Picks the next story to build (the model decides, guided by your taste)
- Builds it, commits, and marks it done in `prd.json`
- Appends learnings to `progress.md`
- Repeats until all stories are done or max iterations hit

```bash
twin build                     # default: 5 iterations
twin build --max-iterations 10 # custom limit
```

Requires Claude Code installed and available in your PATH.

## What Goes in a `.twin` File

- **Execution bias** — do you plan first or build first? Ship rough or wait for polish?
- **Quality compass** — how do you define "done"? What does "good" look like to you?
- **Decision-making style** — how do you get unstuck? How do you weigh trade-offs?
- **Strong beliefs** — what do you believe that most people would disagree with?
- **Anti-patterns** — what do you refuse to do?

## What Does NOT Go in a `.twin` File

- Your product's target user (that goes in a product doc)
- Your tech stack (that goes in project config)
- Your roadmap (that goes in a PRD)

The twin encodes how you think. The project files encode what you are building. The twin is the founder. The project files are the company.

## What Comes Next

`twin tweak` for natural language updates. `twin share` for publishing your taste.

## License

MIT
