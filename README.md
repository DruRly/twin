# Twin-Driven Development

> **Old TDD**: write the tests first. **New TDD**: write the twin first.

A `.twin` file encodes your decision-making DNA — your taste, your biases, your heuristics. Drop it into any project and your AI tools make decisions the way you would.

The twin is not a PRD. It's not a project spec. It's **you**.

## The Problem

AI agents have velocity but no vector. They'll do whatever you tell them — but when you stop telling them, they stop. You're not writing code, but you're always on call. Checking at 2am. Writing the next batch. Going back to sleep.

**We call this Vampire Coding.** Technically hands-off. Practically consumed.

The root cause: agents don't know what you *would* build next. They don't have your taste.

## The Solution

Answer 5 questions. Get a `.twin` file. Now every AI tool you use knows how you think.

```
npx twin-cli init
```

That's it. No accounts. No config files. No setup. Just you, answering questions about how you build things.

## Quick Start

```bash
# 1. Set your OpenRouter API key
export OPENROUTER_API_KEY="your-key-here"

# 2. Create your twin
npx twin-cli init

# 3. Generate your first plan
npx twin-cli plan

# 4. Run plan again to extend — your twin keeps prioritizing
npx twin-cli plan
```

Get an OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys).

## The Loop: init → plan → build → plan

This is the core workflow. Your twin drives the cycle:

1. **`twin init`** — create your taste profile (once)
2. **`twin plan`** — your twin generates tasks that match how you'd prioritize
3. **Build** — hand `prd.json` to your agent, or paste `tasks.md` into any AI chat
4. **`twin plan`** again — your twin sees what exists and plans what's next

Each time you run `plan`, it reads your `.twin`, your `product.md`, and any existing `tasks.md` to avoid duplicates and keep building forward. Your taste stays consistent across every iteration.

## Commands

### `twin init`
Answer 5 questions about how you build things. Generates your `.twin` file — your decision-making DNA.

### `twin plan`
Reads your `.twin` file + project context, generates 3-5 atomic tasks that match your taste.

Outputs two files:
- **`prd.json`** — structured JSON for agent tools and dev loops
- **`tasks.md`** — human-readable Markdown, paste-able into any AI chat

If no `product.md` exists, `twin plan` asks 2 quick questions to set up your project context first. Running it again appends new tasks without duplicating existing ones.

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

This project follows the skateboard-to-car model of iterative delivery. Right now it's a skateboard — `twin init` generates a file. That file is independently valuable today.

What comes next: `twin tweak` for natural language updates, `twin start` for autonomous building, `twin share` for publishing your taste publicly.

## License

MIT
