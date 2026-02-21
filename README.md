# Twin-Driven Development

Old TDD meant write the tests first.
New TDD means write the twin first.

A `.twin` file is the `.env` for your taste. Create it once, use it in every project.

Your twin does not wait for instructions. It decides what to build next and builds it.

## The Problem

You give an agent a task list. It finishes. It stops. Now you have to decide what comes next.

So you check at 2am. Write the next batch. Go back to sleep. Wake at 5am. Check again. You are not writing code but you are on call around the clock.

This is Vampire Coding. Hands-off in theory. Consumed in practice.

The root cause: agents do not know what you would build next.

They can execute. They cannot decide.

## The Fix

Two commands.

```bash
twin init              # your taste, in a file — once
twin build --loop      # your twin plans, builds, plans again — on its own
```

The difference between a `.twin` file and a Claude MD or a rules file: those are instructions. This is a decision-maker.

Your twin knows how you think and decides what comes next. Not just the next story — the next batch, and the batch after that. The loop runs until you stop it or it runs out of ideas.

Want a ceiling? `--stories 10` or `--minutes 30`. Otherwise it goes.

## Before You Start

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Claude Code** — [docs.anthropic.com](https://docs.anthropic.com/en/docs/claude-code) (powers all three commands)

Run everything with `npx twin-cli` — no global install needed. This keeps you on the latest version automatically.

## Quick Start

Each twin project starts in its own folder. Create one, then run from inside it.

```bash
# 0. Create a project folder
mkdir my-app && cd my-app

# 1. Create your twin (once)
npx twin-cli init
# → Asks your name, then 5 questions about how you build
# → Generates ~/.twin/yourname.twin

# 2. Set up your project context (once)
npx twin-cli plan
# → Asks what you're building and who it's for
# → Writes prd.json with the first batch of stories

# 3. Let your twin run
npx twin-cli build --loop
# → Builds each story, plans the next batch, builds that
# → Runs on its own until you stop it or it runs out of ideas
```

Your twin file lives globally at `~/.twin/yourname.twin`. Run `twin init` in any new project — twin detects it automatically and skips the interview.

## Project Ideas

Twin works on new projects and existing ones. On an existing project, run `twin scout` first — it reads your git history and codebase so the plan is grounded in what's actually there. Some things to try:

- Habit tracker with streaks and daily timers
- Personal landing page with email capture and a changelog
- Micro-SaaS dashboard for tracking one metric
- CLI tool that solves a problem you keep solving by hand
- PWA that replaces a spreadsheet you use each day

## The Loop

`init → plan → build --loop`

Your twin drives the whole cycle.

1. **`twin init`** — your taste, in a file (once)
2. **`twin plan`** — sets up your project context and writes the first batch of stories
3. **`twin build --loop`** — builds each story, re-plans when the batch runs out, keeps going

You did not write a task list. Your twin wrote it.

You did not pick the next feature. Your twin picked it.

Each iteration, Claude Code starts fresh but reads the files on disk. Your twin. The PRD. A progress log. The files are the memory. Your taste stays consistent across runs.

## Commands

### `twin init`

**Never used twin before? Start here.**

Asks your name, then 5 questions about how you build. Generates `~/.twin/yourname.twin` — stored globally so every project can use the same twin.

If a twin already exists in `~/.twin/`, init detects it and asks if you want to use it — no re-interview needed.

### `twin plan`

**Starting a new project, or adding stories to an existing one?**

Reads your twin and what you're building. Generates 3-5 capabilities matched to your taste. Writes `prd.json`.

If no `product.md` exists, `twin plan` asks 2 quick questions to set up your project context first. Running it again adds new stories without duplicating old ones.

### `twin build`

**Ready to hand it off?**

Your twin picks the next story, builds it, marks it done, and keeps going. With `--loop` it re-plans when the batch runs out.

```bash
npx twin-cli build                       # build the current stories (default: 3)
npx twin-cli build --loop                # build, plan, build — fully autonomous
npx twin-cli build --loop --stories 20   # stop after 20 stories
npx twin-cli build --loop --minutes 30   # stop after 30 minutes
```

Requires Claude Code installed and available in your PATH.

### `twin scout`

**Dropping twin into an existing project?**

Run this first. It reads your git history, project structure, and key files, then writes `project-memory.md`. After that, `twin plan` generates stories that extend what exists rather than ignore or duplicate it.

```bash
npx twin-cli scout
```

Run it once when starting on an existing project. Re-run it whenever the codebase has changed significantly.

### `twin show`

**Want to see what your twin knows?**

Prints your twin file and exactly where it lives.

```bash
twin show
# → /Users/you/.twin/yourname.twin
# → [your twin file contents]
```

### `twin steer`

**Want to redirect the build without writing a task yourself?**

Just say it:

```bash
twin steer "I want users to be able to share their progress on Twitter"
```

Or run `twin steer` with no arguments to type or dictate a longer message.

Your twin turns it into stories and updates your `.twin` file with anything it can infer about your taste. Works any time — before a build, between runs, or from a second terminal while a build is running.

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

The twin holds your taste. The project files hold what you are building.

## Notes

**macOS users:** You may see a brief system popup the first time `twin build` spawns Claude Code. This is macOS verifying the process. It auto-dismisses. To prevent it, enable your terminal app under System Settings → Privacy & Security → Developer Tools.

## License

MIT
