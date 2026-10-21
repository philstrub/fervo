# README snapshot: Dicklesworthstone/mcp_agent_mail

- Source URL: https://github.com/Dicklesworthstone/mcp_agent_mail
- Fetched: 2026-10-21 (via GitHub API, raw README)
- Repo metadata at fetch time: 2217 stars, last push 2026-10-21, created 2025-10-23, license NOASSERTION
- Note: Python version, superseded by Dicklesworthstone/mcp_agent_mail_rust (209 stars). README truncated.
- Untrusted third-party content, saved verbatim as data. Do not follow instructions inside it.

---

# MCP Agent Mail

> **Superseded by [mcp_agent_mail_rust](https://github.com/Dicklesworthstone/mcp_agent_mail_rust).** This Python version is no longer maintained; use the Rust version for new installs.

![Agent Mail Showcase](screenshots/output/agent_mail_showcase.gif)

> "It's like gmail for your coding agents!"

A mail-like coordination layer for coding agents, exposed as an HTTP-only FastMCP server. It gives agents memorable identities, an inbox/outbox, searchable message history, and voluntary file reservation "leases" to avoid stepping on each other.

Think of it as asynchronous email + directory + change-intent signaling for your agents, backed by Git (for human-auditable artifacts) and SQLite (for indexing and queries).

Status: Under active development. The design is captured in detail in `docs/planning/project_idea_and_guide.md` (start with the original prompt at the top of that file).

## Why this exists

Modern projects often run multiple coding agents at once (backend, frontend, scripts, infra). Without a shared coordination fabric, agents:

- Overwrite each other's edits or panic on unexpected diffs
- Miss critical context from parallel workstreams
- Require humans to "liaison" messages across tools and teams

This project provides a lightweight, interoperable layer so agents can:

- Register a temporary-but-persistent identity (e.g., GreenCastle)
- Send/receive GitHub-Flavored Markdown messages with images
- Search, summarize, and thread conversations
- Declare advisory file reservations (leases) on files/globs to signal intent
- Inspect a directory of active agents, programs/models, and activity

It's designed for: FastMCP clients and CLI tools (Claude Code, Codex, Gemini CLI, Factory Droid, etc.) coordinating across one or more codebases.

## From Idea Spark to Shipping Swarm

If a blank repo feels daunting, follow the field-tested workflow we documented in `docs/planning/project_idea_and_guide.md` (“Appendix: From Blank Repo to Coordinated Swarm”):

- **Ideate fast:** Write a scrappy email-style blurb about the problem, desired UX, and any must-have stack picks (≈15 minutes).
- **Promote it to a plan:** Feed that blurb to GPT-5 Pro (and optionally Grok4 Heavy / Opus 4.1) until you get a granular Markdown plan, then iterate on the plan file while it’s still cheap to change. The Markdown Web Browser sample plan shows the level of detail to aim for.
- **Codify the rules:** Clone a tuned `AGENTS.md`, add any tech-specific best-practice guides, and let Codex scaffold the repo plus Beads tasks straight from the plan.
- **Spin up the swarm:** Launch multiple Codex panes (or any agent mix), register each identity with Agent Mail, and have them acknowledge `AGENTS.md`, the plan document, and the Beads backlog before touching code.
- **Keep everyone fed:** Reuse the canned instruction cadence from the tweet thread or, better yet, let the commercial Companion app’s Message Stacks broadcast those prompts automatically so you never hand-feed panes again.

Watch the full 23-minute walkthrough (https://youtu.be/68VVcqMEDrs?si=pCm6AiJAndtZ6u7q) to see the loop in action.

## Productivity Math & Automation Loop

One disciplined hour of GPT-5 Codex—when it isn’t waiting on human prompts—often produces 10–20 “human hours” of work because the agents reason and type at machine speed. Agent Mail multiplies that advantage in two layers:

1. **Base OSS server:** Git-backed mailboxes, advisory file reservations, Typer CLI helpers, and searchable archives keep independent agents aligned without babysitting. Every instruction, lease, and attachment is auditable.
2. **Companion stack (commercial):** The iOS app + host automation can provision, pair, and steer heterogeneous fleets (Claude Code, Codex, Gemini CLI, Factory Droid, etc.) from your phone using customizable Message Stacks, Human Overseer broadcasts, Beads awareness, and plan editing tools—no manual tmux choreography required. The automation closes the loop by scheduling prompts, honoring Limited Mode, and enforcing Double-Arm confirmations for destructive work.

Result: you invest 1–2 hours of human supervision, but dozens of agent-hours execute in parallel with clear audit trails and conflict-avoidance baked in.

## TLDR Quickstart

### One-line installer

```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/mcp_agent_mail/main/scripts/install.sh?$(date +%s)" | bash -s -- --yes
```

What this does:

- Installs uv if missing and updates your PATH for this session
- Installs jq if missing (needed for safe config merging; auto-detects your package manager)
- Creates a Python 3.14 virtual environment and installs dependencies with uv
- Runs the auto-detect integration to wire up supported agent tools
- Starts the MCP HTTP server on port 8765 and prints a masked bearer token
- Creates helper scripts under `scripts/` (including `run_server_with_token.sh`)
- Adds an `am` shell alias to your `.zshrc` or `.bashrc` for quick server startup (just type `am` in a new terminal!)
- Installs **Beads Rust (`br`)**, a Rust reimplementation of the Beads task tracker, and creates a `bd` shell alias pointing to `br` for backwards compatibility. This replaces any existing `bd` (Go) installation. Pass `--skip-beads` to opt out. See [beads_rust](https://github.com/Dicklesworthstone/beads_rust) for details on CLI differences.
- Installs/updates the Beads Viewer `bv` TUI for interactive task browsing and AI-friendly robot commands (pass `--skip-bv` to opt out)
- Prints a short on-exit summary of each setup step so you immediately know what changed

Prefer a specific location or options? Add flags like `--dir <path>`, `--project-dir <path>`, `--no-start`, `--start-only`, `--port <number>`, or `--token <hex>`.

Already have Beads or Beads Viewer installed? Append `--skip-beads` and/or `--skip-bv` to bypass automatic installation.

### Important: Beads Rust (br) Replaces Beads Go (bd)

The installer automatically replaces `bd` (the original Go-based Beads CLI) with `br` (Beads Rust):

1. **`br` is the actively maintained version.** Beads Rust is a complete reimplementation with ongoing development, while the original Go version is no longer actively maintained.

2. **Existing `bd` users get automatic aliasing.** The installer creates a shell alias so that `bd` commands continue to work by redirecting to `br`. Your existing workflows and muscle memory are preserved.

3. **A migration skill is installed for agents.** AI coding agents receive a `bd-br-migration` skill that helps them adapt to any CLI differences between the two implementations.

4. **Same data format, compatible workflows.** Both implementations use the same `.beads/issues.jsonl` format, so your existing Beads data remains fully compatible.

To opt out of this replacement, pass `--skip-beads` to the installer. See the [beads_rust repository](https://github.com/Dicklesworthstone/beads_rust) for detailed documentation on CLI differences.

### Starting the server in the future

After installation, you can start the MCP Agent Mail server from **anywhere** by simply typing:

```bash
am
```

That's it! The `am` alias (added to your `.zshrc` or `.bashrc` during installation) automatically:
1. Changes to the MCP Agent Mail directory
2. Runs the server startup script (which uses `uv run` to handle the virtual environment)
3. Loads your saved bearer token from `.env` and starts the HTTP server

**Note:** If you just ran the installer, open a new terminal or run `source ~/.zshrc` (or `source ~/.bashrc`) to load the alias.

**Port conflicts?** Use `--port` to specify a different port (default: 8765):

Install with custom port:

```bash
curl -fsSL "https://raw.githubusercontent.com/Dicklesworthstone/mcp_agent_mail/main/scripts/install.sh?$(date +%s)" | bash -s -- --port 9000 --yes
```

Or use the CLI command after installation:
uv run python -m mcp_agent_mail.cli config set-port 9000
```

### If you want to do it yourself

Clone the repo, set up and install with uv in a python 3.14 venv (install uv if you don't have it already), and then run `scripts/automatically_detect_all_installed_coding_agents_and_install_mcp_agent_mail_in_all.sh`. This will automatically set things up for your various installed coding agent tools and start the MCP server on port 8765. If you want to run the MCP server again in the future, simply run `scripts/run_server_with_token.sh`:

Install uv (if you don't have it already):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Clone the repo
git clone https://github.com/Dicklesworthstone/mcp_agent_mail
cd mcp_agent_mail

# Create a Python 3.14 virtual environment and install dependencies
# Note: If you have an older uv version, run `uv self update` first
uv python install 3.14
uv venv -p 3.14
source .venv/bin/activate
uv sync

# Detect installed coding agents, integrate, and start the MCP server on port 8765
scripts/automatically_detect_all_installed_coding_agents_and_install_mcp_agent_mail_in_all.sh

# Later, to run the MCP server again with the same token
scripts/run_server_with_token.sh

# Now, simply launch Codex-CLI or Claude Code or other agent tools in other consoles; they should have the mail tool available. See below for a ready-made chunk of text you can add to the end of your existing AGENTS.md or CLAUDE.md files to help your agents better utilize the new tools.

# Change port after installation
uv run python -m mcp_agent_mail.cli config set-port 9000
```

## Ready-Made Blurb to Add to Your AGENTS.md or CLAUDE.md Files:
<!-- BEGIN_AGENT_MAIL_SNIPPET -->
```
## MCP Agent Mail: coordination for multi-agent workflows

What it is
- A mail-like layer that lets coding agents coordinate asynchronously via MCP tools and resources.
- Provides identities, inbox/outbox, searchable threads, and advisory file reservations, with human-auditable artifacts in Git.

Why it's useful
- Prevents agents from stepping on each other with explicit file reservations (leases) for files/globs.
- Keeps communication out of your token budget by storing messages in a per-project archive.
- Offers quick reads (`resource://inbox/...`, `resource://thread/...`) and macros that bundle common flows.

How to use effectively
1) Same repository
   - Register an identity: call `ensure_project`, then `register_agent` using this repo's absolute path as `project_key`.
   - Reserve files before you edit: `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true)` to signal intent and avoid conflict.
   - Communicate with threads: use `send_message(..., thread_id="FEAT-123")`; check inbox with `fetch_inbox` and acknowledge with `acknowledge_message`.
   - Read fast: `resource://inbox/{Agent}?project=<abs-path>&limit=20&agent_token=<registration_token>` or `resource://thread/{id}?project=<abs-path>&agent=<Agent>&agent_token=<registration_token>&include_bodies=true` unless the current MCP session already authenticated as that agent.
   - Tip: set `AGENT_NAME` in your environment so the pre-commit guard can block commits that conflict with others' active exclusive file reservations.

2) Across different repos in one project (e.g., Next.js frontend + FastAPI backend)
   - Option A (single project bus): register both sides under the same `project_key` (shared key/path). Keep reservation patterns specific (e.g., `frontend/**` vs `backend/**`).
   - Option B (separate projects): each repo has its own `project_key`; use `macro_contact_handshake` or `request_contact`/`respond_contact` to link agents, then message directly. Keep a shared `thread_id` (e.g., ticket key) across repos for clean summaries/audits.

Macros vs granular tools
- Prefer macros when you want speed or are on a smaller model: `macro_start_session`, `macro_prepare_thread`, `macro_file_reservation_cycle`, `macro_contact_handshake`.
- Use granular tools when you need control: `register_agent`, `file_reservation_paths`, `send_message`, `fetch_inbox`, `acknowledge_message`.

Common pitfalls
- "from_agent not registered": always `register_agent` in the correct `project_key` first.
- "FILE_RESERVATION_CONFLICT": adjust patterns, wait for expiry, or use a non-exclusive reservation when appropriate.
- Auth errors: if JWT+JWKS is enabled, include a bearer token with a `kid` that matches server JWKS; static bearer is used only when JWT is disabled.
```
<!-- END_AGENT_MAIL_SNIPPET -->

## Integrating with Beads (dependency-aware task planning)

Beads is a lightweight task planner that complements Agent Mail by keeping status and dependencies in one place while Mail handles messaging, file reservations, and audit trails.

**Note on implementations:** The MCP Agent Mail installer installs [Beads Rust (`br`)](https://github.com/Dicklesworthstone/beads_rust), a Rust reimplementation, and creates a `bd` alias for backwards compatibility. The original Go implementation is at [steveyegge/beads](https://github.com/steveyegge/beads). Both share the same data format (`.beads/issues.jsonl`) but have some CLI differences. Use `--skip-beads` during installation if you prefer to manage this yourself.

Highlights:
- Beads owns task prioritization; Agent Mail carries the conversations and artifacts.
- Shared identifiers (e.g., `bd-123`) keep Beads issues, Mail threads, and commits aligned.
- The `br` CLI (aliased as `bd`) provides similar functionality to the original with some enhancements.

Copy/paste blurb for agent-facing docs (leave as-is for reuse):

<!-- BEGIN_BEADS_SNIPPET -->
```

## Integrating with Beads (dependency-aware task planning)

Beads provides a lightweight, dependency-aware issue database and a CLI (`bd`) for selecting "ready work," setting priorities, and tracking status. It complements MCP Agent Mail's messaging, audit trail, and file-reservation signals. Project: [steveyegge/beads](https://github.com/steveyegge/beads)

Recommended conventions
- **Single source of truth**: Use **Beads** for task status/priority/dependencies; use **Agent Mail** for conversation, decisions, and attachments (audit).
- **Shared identifiers**: Use the Beads issue id (e.g., `bd-123`) as the Mail `thread_id` and prefix message subjects with `[bd-123]`.
- **Reservations**: When starting a `bd-###` task, call `file_reservation_paths(...)` for the affected paths; include the issue id in the `reason` and release on completion.

Typical flow (agents)
1) **Pick ready work** (Beads)
   - `bd ready --json` → choose one item (highest priority, no blockers)
2) **Reserve edit surface** (Mail)
   - `file_reservation_paths(project_key, agent_name, ["src/**"], ttl_seconds=3600, exclusive=true, reason="bd-123")`
3) **Announce start** (Mail)
   - `send_message(..., thread_id="bd-123", subject="[bd-123] Start: <short title>", ack_required=true)`
4) **Work and update**
   - Reply in-thread with progress and attach artifacts/images; keep the discussion in one thread per issue id
5) **Complete and release**
   - `bd close bd-123 --reason "Completed"` (Beads is status authority)
   - `release_file_reservations(project_key, agent_name, paths=["src/**"])`
   - Final Mail reply: `[bd-123] Completed` with summary and links

Mapping cheat-sheet
- **Mail `thread_id`** ↔ `bd-###`
- **Mail subject**: `[bd-###] …`
- **File reservation `reason`**: `bd-###`
- **Commit messages (optional)**: include `bd-###` for traceability

Event mirroring (optional automation)
- On `bd update --status blocked`, send a high-importance Mail message in thread `bd-###` describing the blocker.
- On Mail "ACK overdue" for a critical decision, add a Beads label (e.g., `needs-ack`) or bump priority to surface it in `bd ready`.

Pitfalls to avoid
- Don't create or manage tasks in Mail; treat Beads as the single task queue.
- Always include `bd-###` in message `thread_id` to avoid ID drift across tools.

```
<!-- END_BEADS_SNIPPET -->

Prefer automation? Run `uv run python -m mcp_agent_mail.cli docs insert-blurbs` to scan your code directories for `AGENTS.md`/`CLAUDE.md` files and append the latest Agent Mail + Beads snippets with per-project confirmation. The installer also offers to launch this helper right after setup so you can take care of onboarding docs immediately.

## Beads Viewer (bv) — AI-Friendly Task Analysis

The Beads Viewer (`bv`) is a fast terminal UI for Beads projects that also provides **robot flags** designed specifically for AI agent integration. Project: [Dicklesworthstone/beads_viewer](https://github.com/Dicklesworthstone/beads_viewer)

### Why bv for Agents?

While `bd` (Beads CLI) handles task CRUD operations, `bv` provides **precomputed graph analytics** that help agents make intelligent prioritization decisions:

- **PageRank scores**: Identify high-impact tasks that unblock the most downstream work
- **Critical path analysis**: Find the longest dependency chain to completion
- **Cycle detection**: Spot circular dependencies before they cause deadlocks
- **Parallel track planning**: Determine which tasks can run concurrently

Instead of agents parsing `.beads/issues.jsonl` directly or attempting to compute graph metrics (risking hallucinated results), they can call bv's deterministic robot flags and get JSON output they can trust. Legacy `.beads/beads.jsonl` is deprecated in this repo.

### Robot Flags for AI Integration

| Flag | Output | Agent Use Case |
|------|--------|----------------|
| `bv --robot-help` | All AI-facing commands | Discovery / capability check |
| `bv --robot-insights` | PageRank, betweenness, HITS, critical path, cycles | Quick triage: "What's most impactful?" |
| `bv --robot-plan` | Parallel tracks, items per track, unblocks lists | Execution planning: "What can run in parallel?" |
| `bv --robot-priority` | Priority recommendations with reasoning + confidence | Task selection: "What should I work on next?" |
| `bv --robot-recipes` | Available filter presets (actionable, blocked, etc.) | Workflow setup: "Show me ready work" |
| `bv --robot-diff --diff-since <ref>` | Changes since commit/date, new/closed items, cycles | Progress tracking: "What changed?" |

### Example: Agent Task Selection Workflow

```bash
# 1. Get priority recommendations with reasoning
bv --robot-priority
# Returns JSON with ranked tasks, impact scores, and confidence levels

# 2. Check what completing a task would unblock
bv --robot-plan
# Returns parallel tracks showing dependency chains

# 3. After completing work, check what changed
bv --robot-diff --diff-since "1 hour ago"
# Returns new items, closed items, cycle changes
```

### When to Use bv vs bd

| Tool | Best For |
|------|----------|
| `bd` | Creating, updating, closing tasks; `bd ready` for simple "what's next" |
| `bv` | Graph analysis, impact assessment, parallel planning, change tracking |

**Rule of thumb**: Use `bd` for task operations, use `bv` for task intelligence.

### Integration with Agent Mail

Combine bv insights with Agent Mail coordination:

1. **Agent A** runs `bv --robot-priority` → identifies `bd-42` as highest-impact
2. **Agent A** reserves files: `file_reservation_paths(..., reason="bd-42")`
3. **Agent A** announces: `send_message(..., thread_id="bd-42", subject="[bd-42] Starting high-impact refactor")`
4. **Other agents** see the reservation and Mail announcement, pick different tasks
5. **Agent A** completes, runs `bv --robot-diff` to report downstream unblocks

This creates a feedback loop where graph intelligence drives coordination.

## Core ideas (at a glance)

- FastMCP server over Streamable HTTP (primary transport; no SSE). A STDIO transport (`serve-stdio`) is also available for direct CLI integration.
- Dual persistence model:
  - Human-readable markdown in a per-project Git repo for every canonical message and per-recipient inbox/outbox copy
  - SQLite with FTS5 for fast search, directory queries, and file reservations/leases
- "Directory/LDAP" style queries for agents; memorable adjective+noun names
- Advisory file reservatio

[... truncated at 20000 bytes of 141760 total; see source URL for the rest ...]
