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

## Quick Start

```bash
# Set your OpenRouter API key
export OPENROUTER_API_KEY="your-key-here"

# Run the interview
npx twin-cli init

# Your .twin file is generated in the current directory
```

Get an OpenRouter key at [openrouter.ai/keys](https://openrouter.ai/keys).

## How to Use Your Twin

Drop `.twin` into any project root. Then tell your AI tools to read it:

- **Claude Code**: it picks up `.twin` automatically if it's in your project
- **Cursor**: add `.twin` to your project context
- **Any LLM chat**: paste the contents as system context

The twin travels with you, not with the project. Use the same file everywhere.

## Philosophy

This project follows the skateboard-to-car model of iterative delivery. Right now it's a skateboard — `twin init` generates a file. That file is independently valuable today.

What comes next: `twin tweak` for natural language updates, `twin start` for autonomous building, `twin share` for publishing your taste publicly.

But first: the skateboard.

## License

MIT
