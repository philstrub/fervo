# Fervo: pitch

*The building blocks for your own GitHub, made for agent swarms and the humans who run them.*

## Elevator pitch

Coding agents now write much of the world's new code, yet they still ship it through GitHub, a platform built for humans reviewing one pull request at a time. Its workflow is fixed, and every team has to bend to it. Fervo provides a kit of building blocks for a multi-agent code platform, shipped as a CLI and an SDK. Fervo hosts nothing: you run it on a git remote you control. Its primitives are: a shared map of what has been tried and what is the "frontier" of progress in the repo, declarations of what each agent is about to do, independent scoring and review of changes, and a merge that a human can always override. Everything else is a block you add, swap or write yourself: review rules, CI, permissions, evaluations, the interface. Each team ends up with the code platform that fits how it works. You bring your own model keys, and one command moves a repo off GitHub and onto your own remote, with its history, pull requests and issues. Compatible with all model harnesses (Claude, pi, Hermes, Openclaw, Codex).

## Two-minute pitch

**The problem.** Anthropic's merged code changes went from about 2,500 a day to over 30,000 in four months. Its verdict: the bottleneck is now "all of the developer infrastructure built for human scale." GitHub is that infrastructure. It was built for a person who opens a pull request and waits for a colleague, and it is one-size-fits-all.

Agents break that model in two ways. First, they start blind. None of them can see what the others are trying or what already failed, so they repeat each other's work. Second, they grade their own work. In most enterprise workflows the only real check is still a human reading every line or an LLM-generated review, which is impossible with twenty agents shipping 20 PRs a day.

**The solution.** Fervo CLI and SDK provides the building blocks to make your repo-management workflow agent native. Your repos stay on a server you run, and every team assembles its own platform from the same core blocks:

- **A shared frontier.** One map of every direction tried, how it scored and what is still open.
- **Declarations.** Each agent states what it will do before it starts, so others steer around it.
- **Independent judgment.** No agent scores its own work: your tests, a judge prompt and agents from other providers do.
- **A human override.** An admin can merge, veto or revert anything.

**The philosophy.** Fervo is a minimal harness for repo management: it takes that same philosopy of pi, the coding agent that ships with four tools and a short prompt and leaves the rest to extensions. Fervo does the same for repo management. Want every contributing agent to sign off before a change lands? Add that rule. Only want a human on security code? Write it down. Want a different interface, or none? Swap it. Fervo also has no intelligence of its own. You bring your model keys and define "better"; we make measuring it cheap and trustworthy. Leaving GitHub takes one command, `fervo import`, which brings your history, pull requests, reviews and issues to your own remote.

## About the name

*Fervo* (Latin, an old form of *ferveo*) means "I seethe, I glow, I am busy." Virgil used *fervet opus*, "the work seethes," for bees at work in a hive (*Georgics* 4.169, *Aeneid* 1.436). That is the repo we want: many hands at once, all moving in the same direction.

*Source:* [Redesigning source control at Anthropic](https://www.anthropic.com/research/redesigning-source-control) (2026-10-13).
