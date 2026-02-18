# Twin-Driven Development

Old TDD meant write the tests first. New TDD means write the twin first.

A `.twin` file encodes how you think. Drop it into any project. Your AI does not wait for instructions. It decides what to build next and builds it. Not human in the loop. Twin in the loop.

## The Problem

You give an agent a task list. It finishes. It stops. Now you have to decide what comes next.

So you check at 2am. Write the next batch. Go back to sleep. Wake at 5am. Check again. You are not writing code but you are on call around the clock.

This is Vampire Coding. Hands-off in theory. Consumed in practice.

The root cause: agents do not know what you would build next. They can execute. They cannot decide.

## The Fix

Three commands.

```
twin init     # encode how you think
twin plan     # your twin decides what to build next
twin build    # your twin builds it without you
```

The difference between a `.twin` file and a Claude MD or a rules file: those are instructions. This is a decision-maker. Your twin knows how you think and decides what comes next.

Run `twin plan` once and you get the next batch of features you would have chosen. Run it again and you get the batch after that. Keep running it and you are watching your own product roadmap unfold without writing a single task yourself.

## Before You Start

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Claude Code** — [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) (powers all three commands)

## Quick Start

Each twin project starts in its own folder. Create one, then run from inside it.

```bash
# 0. Create a project folder
mkdir my-app && cd my-app

# 1. Create your twin (once)
npx twin-cli init
# → Asks your name, then 5 questions about how you build
# → Generates yourname.twin

# 2. Generate your first plan
npx twin-cli plan
# → Reads your twin, asks about your product, writes prd.json

# 3. Let your twin build
npx twin-cli build
# → Spawns Claude Code in a loop
# → Builds each story, updates prd.json as it goes
```

## Example: Building a Habit Tracker

A full walkthrough from zero to working app.

```bash
# Create the project
mkdir habit-tracker && cd habit-tracker

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

- Habit tracker with streaks and daily timers
- Personal landing page with email capture and a changelog
- Micro-SaaS dashboard for tracking one metric
- CLI tool that solves a problem you keep solving by hand
- PWA that replaces a spreadsheet you use each day

## The Loop

`init → plan → build → plan`

Your twin drives the whole cycle.

1. **`twin init`** — encode how you think (once)
2. **`twin plan`** — your twin generates tasks that match how you prioritize
3. **`twin build`** — your twin builds on its own, updating `prd.json` as stories complete
4. **`twin plan` again** — your twin reads what shipped and decides what comes next

You did not write a task list. The twin wrote it. You did not pick the next feature. The twin picked it. That is the shift: from reactive to proactive.

Each iteration, Claude Code starts fresh but reads the files on disk. Your twin. The PRD. A progress log. The files are the memory. Your taste stays consistent across runs.

## Commands

### `twin init`

Asks your name, then 5 questions about how you build things. Generates `yourname.twin`.

### `twin plan`

Reads your `.twin` file and project context. Generates 3-5 capabilities that match your taste. Writes `prd.json` with user stories and status tracking.

If no `product.md` exists, `twin plan` asks 2 quick questions to set up your project context first. Running it again adds new stories without duplicating old ones.

### `twin build`

Runs an autonomous build loop using Claude Code. Each iteration:

- Reads your twin file for how you think
- Reads `prd.json` for open stories
- Picks the next story to build (guided by your taste)
- Builds it, commits, and marks it done in `prd.json`
- Appends learnings to `progress.md`
- Repeats until all stories are done or max iterations hit

```bash
twin build              # default: 3 stories
twin build --stories 5  # build more in one run
twin build --loop       # fully autonomous: build → plan → build → plan
twin build --loop --stories 20  # autonomous with a ceiling
```

Requires Claude Code installed and available in your PATH.

## What Goes in a `.twin` File

- **Execution bias** — do you plan first or build first? Ship rough or wait for polish?
- **Quality compass** — how do you define "done"? What does "good" look like to you?
- **Decision-making style** — how do you get unstuck? How do you weigh trade-offs?
- **Strong beliefs** — what do you believe that most would disagree with?
- **Anti-patterns** — what do you refuse to do?

## What Does NOT Go in a `.twin` File

- Your product's target user (that goes in a product doc)
- Your tech stack (that goes in project config)
- Your roadmap (that goes in a PRD)

The twin encodes how you think. The project files encode what you are building. The twin is the founder. The project files are the company.

## What Comes Next

`twin tweak` for natural language updates. `twin share` for publishing your taste publicly.

## License

MIT
