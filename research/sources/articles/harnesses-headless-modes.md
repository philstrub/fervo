# Agent harnesses named in the PRD: official links and headless/non-interactive mode

- Fetched: 2026-10-21 (curl + pandoc to plain text). Excerpts of the relevant sections only; star counts from the GitHub API on 2026-10-21.
- Note: third-party content, saved as data for reference.

---

## Claude Code (Anthropic)

- Repo: https://github.com/anthropics/claude-code (152,692 stars). Docs: https://code.claude.com/docs/en/overview
- Headless doc fetched: https://code.claude.com/docs/en/headless

```text

[]

Use the Agent SDK to run Claude Code programmatically from the CLI, Python, or TypeScript.

[]Copy pageCopy page

[]

The Agent SDK gives you the same tools, agent loop, and context management that power Claude Code. It’s available as a CLI for scripts and CI/CD, or as Python and TypeScript packages for full programmatic control. To run Claude Code in non-interactive mode, pass -p with your prompt and the CLI options you need:

[]

[]

[]

    claude -p "Find and fix the bug in auth.py" --allowedTools "Read,Edit,Bash"

This page covers using the Agent SDK via the CLI (claude -p). For the Python and TypeScript SDK packages with structured outputs, tool approval callbacks, and native message objects, see the full Agent SDK documentation.

​

[]

Basic usage

Add the -p (or --print) flag to any claude command to run it non-interactively. Not every CLI option combines with -p. Claude Code rejects --bg, and rejects --cloud with a task description, with an error naming the conflict; --cloud with a session ID and -p instead queues a message into that cloud session and exits. Options you’ll combine with -p often include:

- --continue for continuing conversations
- --allowedTools for auto-approving tools
- --output-format for structured output

This example asks Claude a question about your codebase and prints the response:

[]

[]

[]

    claude -p "What does the auth module do?"

Claude Code exits with code 0 on success and a non-zero code when the run fails, so your scripts can branch on the exit status. If you pass an invalid flag, Claude Code reports the error to stderr before the run starts. When a failure happens inside the run, such as missing authentication, Claude Code prints the failure as the result on stdout.

​

[]

Start faster with bare mode

Add --bare to reduce startup time by skipping auto-discovery of hooks, skills, custom commands, subagents, installed plugins, MCP servers, auto memory, and CLAUDE.md. Without it, claude -p discovers and loads them as an interactive session would, including anything configured in the working directory or ~/.claude. Bare mode is useful for CI and scripts where you need the same result on every machine. A hook in a teammate’s ~/.claude or an MCP server in the project’s .mcp.json won’t run, because bare mode never reads them. A directory you name with --add-dir is a partial exception: bare mode loads skills from its .claude/skills/ folder, but still skips its .claude/commands/ and .claude/agents/ folders. Skills from additional directories covers what does and doesn’t load. Without --bare, a -p session runs the hooks in a project’s .claude/settings.json and connects the servers in its .mcp.json, even in a folder you’ve never trusted. A -p session shows no workspace trust dialog and no per-server approval prompt. What runs before you trust a folder covers each kind of repository content under -p and how to keep it out. This example runs a one-off summarize task in bare mode and pre-approves the Read tool so the call completes without a permission prompt. Set ANTHROPIC_API_KEY before running it, because bare mode doesn’t use your subscription login:

[]

[]

[]

    claude --bare -p "Summarize README.md" --allowedTools "Read"

```

## Codex CLI (OpenAI)

- Repo: https://github.com/openai/codex (130,276 stars)
- Doc fetched: https://developers.openai.com/codex/noninteractive (redirected to https://learn.chatgpt.com/docs/non-interactive-mode)

```text
[] [] Copy Page

Non-interactive mode

Use `codex exec` to run Codex in scripts and CI

[] [] Copy Page

Non-interactive mode lets you run Codex from scripts (for example, continuous integration (CI) jobs) without opening the interactive TUI. You invoke it with codex exec.

For flag-level details, see codex exec.

When to use codex exec[]

Use codex exec when you want Codex to:

- Run as part of a pipeline (CI, pre-merge checks, scheduled jobs).
- Produce output you can pipe into other tools (for example, to generate release notes or summaries).
- Fit naturally into CLI workflows that chain command output into Codex and pass Codex output to other tools.
- Run with explicit, pre-set sandbox and approval settings.

Basic usage[]

Pass a task prompt as a single argument:

    codex exec "summarize the repository structure and list the top 5 risky areas"

While codex exec runs, Codex streams progress to stderr and prints only the final agent message to stdout. This makes it straightforward to redirect or pipe the final result:

    codex exec "generate release notes for the last 10 commits" | tee release-notes.md

Use --ephemeral when you don’t want to persist session rollout files to disk:

    codex exec --ephemeral "triage this repository and suggest next steps"

If stdin is piped and you also provide a prompt argument, Codex treats the prompt as the instruction and the piped content as additional context.

This lets you generate input with one command and hand it directly to Codex:

    curl -s https://jsonplaceholder.typicode.com/comments \
      | codex exec "format the top 20 items into a markdown table" \
      > table.md

For more advanced stdin piping patterns, see Advanced stdin piping.

```

## OpenClaw

- Repo: https://github.com/openclaw/openclaw (392,658 stars). Site: https://openclaw.ai. Docs: https://docs.openclaw.ai
- Doc fetched: https://docs.openclaw.ai/cli/agent

```text
openclaw agent[][]

Run one agent turn through the Gateway. The explicit --local flag and agent exec are the embedded execution paths.

Gateway-backed turns are operator input. An agent's exec subprocess carrying OPENCLAW_SHELL=exec cannot use this command to report back to another session; use its attributed session tool or normal subagent completion instead. This does not change operator terminal use or the separate embedded execution paths.

Pass at least one session selector: --to, --session-key, --session-id, or --agent. Explicitly blank or whitespace-only selector values are rejected before local or Gateway dispatch, even when another selector supplies a valid target. Omit an unused selector instead of passing an empty value.

When --session-id finds an existing session in an agent's storage partition, it retains that agent even if session.store uses one fixed JSON locator and the stored key is global or unknown.

For Gateway-backed turns, the Gateway resolves --session-id, including when it runs on the same machine as the CLI. The CLI does not read session metadata before sending the request. If the ID does not exist, the Gateway creates a resumable session under the selected agent. This requires a Gateway advertising named-session creation support; update and restart an older Gateway before using this CLI's --session-id. The CLI checks support before sending the turn.

A completed turn exits 0. Error, timeout, and cancellation outcomes exit 1, after any text or JSON result is written. A received SIGINT or SIGTERM instead preserves the signal-specific exit status described below.

Related: Agent send tool

agent exec[][]

openclaw agent exec runs one embedded agent turn without connecting to a Gateway. It is the recommended headless entry point for CI and coding automation because it owns setup, cleanup, output projection, and process status.

    openclaw agent exec "Run the focused tests and fix failures"openclaw agent exec --message-file task.md --cwd ./repocat task.md | openclaw agent exec --message-file - --json

By default, the command creates a temporary state directory and removes it after confirmed cleanup, including accepted database work and the run's database resources. It runs against your ordinary OpenClaw config, so configured providers, credentials, and agentRuntime harness selection apply exactly as they do elsewhere. --cwd defaults to the process working directory and is passed as both the agent workspace and tool working directory.

Config is layered entirely in memory: exec composes the run config and publishes it as this process's runtime config rather than writing a copy to disk. Exec defaults apply only where your config leaves a setting unset: the agent sandbox is off, the coding tool profile is selected, filesystem tools are restricted to --cwd, and exec runs under the full execution policy a headless turn needs. Anything your config sets wins over those defaults, so a configured sandbox, shell env, or tool profile is never downgraded, and exec host routing stays with the sandbox when your config enables one. The invocation itself always wins last: the run is scoped to --cwd and sets skipBootstrap: true to prevent creating workspace bootstrap files.

With the Codex runtime, agent exec uses OpenClaw's shell and filesystem tools instead of Codex-native execution, keeping tool cleanup under the one-shot run's owner. Ordinary Gateway-backed Codex turns keep their native tool surface.

Existing workspace files such as AGENTS.md are still injected by default. For embedded-runtime runs that must omit this automatic context, set agents.defaults.contextInjection: "never" in the pinned config, unless overridden per agent. This controls injection, not file access through tools; see Workspace and bootstrap.

When your tool policy enables browser, local browser control works without a Gateway. Explicit Gateway or node routing and sandbox restrictions still apply; see Node browser proxy.

Use --state-dir <dir> to retain sessions and other run state. The directory must already exist and is never created or deleted by the command. A retained state directory requires exclusive ownership: exec refuses to start while a Gateway or another embedded writer owns it, then holds the state lock for the complete run. Omit --state-dir for isolated temporary state, or stop the Gateway first with openclaw gateway stop.

When exec uses the ambient or a pinned config, installed plugins continue to resolve from the operator's ordinary plugin roots while sessions and other run state use the ephemeral directory. In those modes, --state-dir controls run state only; it is not required for configured providers, channels, or harnesses supplied by installed plugins.

For reproducible runs, pin the config instead of inheriting it. --config <path> runs against exactly that config file, read through the normal loader so JSON5 syntax and $include resolve relative to it; a missing or invalid file fails the run rather than falling back to defaults, as does an ambient config that exists but cannot be parsed. --isolated ignores the ambient config entirely and uses only the exec defaults above. Both are the right choice for CI, where inheriting operator state would make runs machine-dependent.

Use --config-override '<JSON object>' to change selected settings for one run while inheriting everything else:

    openclaw agent exec "Inspect this repository" \  --config-override '{"tools":{"deny":["exec"]}}'

Overrides apply after loading the ordinary, --config, or --isolated base. Nested objects merge; arrays and scalar values replace the previous value, including empty arrays. Repeat the flag to apply overrides in order. The resulting config is validated and never saved. Per-agent settings retain their normal precedence over agent defaults; target agents.entries.<id> to change one agent's settings. Explicit run flags such as --model, --thinking, and --code-mode, and the command's workspace/state binding, still win over config values. --config keeps its alternative-file meaning.

Overrides use JSON syntax and normal runtime normalization, including ~ paths. File includes and login-shell imports belong to the selected base's loader. Overridden env variables apply for the run, preserve existing process-environment precedence, and are restored during cleanup.

Stored credentials are used by default, so a folder-scoped run reaches the same logins as the rest of the CLI. Pass --auth-env-only to restrict the run to provider keys already present in the process environment. That mode loads no config at all, and pairing it with --config or --config-override is rejected rather than silently ignored, because a config supplies provider credentials through several surfaces at once: inline keys and secret headers, an env block, and login-shell import. It also skips OpenClaw auth profiles and external Codex, Claude, or other CLI credential stores. Provider auth variables remain available to model authentication but are omitted from agent-launched host commands.

On a clean installation without the Codex plugin, OpenAI API-key runs use the built-in OpenClaw runtime. The implicit Codex preference does not require installing a native harness before --auth-env-only can run. An explicitly configured Codex runtime or an existing Codex session pin still requires that harness.

Select a primary and ordered fallback chain with repeatable flags:

    openclaw agent exec "Implement the change" \  --model openai/gpt-6-astra \  --fallback anthropic/claude-sonnet-4-6 \  --fallback google/gemini-3.1-pro-preview

For this command only, explicit --fallback values remain active with explicit --model. Other agent entry points keep their existing rule that a user-selected model disables configured fallbacks.

Select the one-shot tool surface explicitly when comparing local or smaller models:

    openclaw agent exec "Inspect this repository" \  --model ollama/qwen3.5:9b \  --code-mode code \  --local-model-lean \  --json

--code-mode direct disables Code Mode, auto uses model capability metadata, and code forces the generic Code Mode surface for tool-capable runs. --local-model-lean removes high-latency and channel-dependent tools and enables the bounded Tool Search defaults for the isolated run. Its Tool Search directory lists names and owners without descriptions; full descriptions remain searchable. The flag keeps ordinary system instructions, skills, and workspace context.
```

## Hermes Agent (Nous Research)

- Repo: https://github.com/NousResearch/hermes-agent (255,784 stars). Site: https://hermes-agent.nousresearch.com
- Doc fetched: https://hermes-agent.nousresearch.com/docs/reference/cli-commands

```text
  --dev                              With --tui: run the TypeScript sources directly via tsx instead of the prebuilt bundle (for TUI contributors).

hermes-agent (legacy single-query runner)​

The install also ships hermes-agent, a minimal runner that sends one query and exits: hermes-agent --query "summarize README.md" (or hermes-agent "summarize README.md"). hermes-agent --help lists its options (--model, --base-url, --max-turns, --enabled-toolsets, --disabled-toolsets, --list-tools, --save-trajectories, …) and hermes-agent --version prints the version; neither starts the agent. Run with no query, it prints the same help and exits. For anything else use hermes (hermes -z <prompt> is the scripted one-shot).

Top-level commands​

  Command                                           Purpose
  ------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  hermes chat                                       Interactive or one-shot chat with the agent.
  hermes model                                      Interactively choose the default provider and model.
  hermes moa                                        Configure named Mixture of Agents presets selectable from the model picker.
  hermes fallback                                   Manage fallback providers tried when the primary model errors.
  hermes gateway                                    Run or manage the messaging gateway service.
...
  hermes serve                                      Start the Hermes backend server (headless; powers the desktop app and remote backends).
  hermes desktop (alias gui)                        Build and launch the native Electron desktop app.
...
hermes chat​

    hermes chat [options]

Common options:

  Option                                   Description
  ---------------------------------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  -q, --query "..."                        Seed the session with a prompt. On a real TTY the prompt is submitted literally as the first turn of a normal interactive session (it is never parsed as a slash command or ! shell escape) and the session stays open — ideal for OS launchers and desktop integrations. With --oneshot, -Q, or non-TTY stdio it answers and exits.
  --query-file PATH                        Read the query from a file (- = stdin). Nothing is shell-interpreted, so quotes, $(...), and backticks arrive verbatim — use this for programmatic or untrusted message bodies (Bot Mode teammate DMs use it). Mutually exclusive with -q.
  --oneshot                                With -q/--query-file: answer the query and exit (the pre-0.21 single-query behavior) instead of seeding an interactive session. Implied on non-TTY stdio and by -Q.
  -m, --model <model>                      Override the model for this run.
  -t, --toolsets <csv>                     Enable a comma-separated set of toolsets.
  --provider <provider>                    Force a provider: auto, openrouter, nous, openai-codex (aliases chatgpt, chatgpt-codex), copilot-acp, copilot, anthropic, gemini, huggingface, novita (aliases novita-ai, novitaai), openai-api, zai, kimi-coding, kimi-coding-cn, minimax, minimax-cn, minimax-oauth, kilocode, xiaomi, arcee, gmi, upstage (alias solar), alibaba, alibaba-cn, alibaba-coding-plan (alias alibaba_coding), alibaba-coding-plan-cn, alibaba-token-plan, alibaba-token-plan-cn, deepseek, nvidia, ollama-cloud, xai (alias grok), xai-oauth (alias grok-oauth), qwen-oauth, bedrock, opencode-zen, opencode-go, commandcode, commandcode-anthropic, ai-gateway, azure-foundry, lmstudio, stepfun, tencent-tokenhub (alias tencent, tokenhub), router (aliases ramp-router, ramp), nebius-token-factory (aliases nebius, nebius-tf, tokenfactory), tencent-tokenplan (aliases tokenplan, tencent-lkeap).
  -s, --skills <name>                      Preload one or more skills for the session (can be repeated or comma-separated).
  -v, --verbose                            Verbose output.
  -Q, --quiet                              Programmatic mode: suppress banner/spinner/tool previews.
  --format stream-json                     Emit structured JSONL for a -q / --query invocation. Implies --quiet; cannot be combined with --tui.
```

## pi (see pi-readme.md)

- Repo: https://github.com/earendil-works/pi (formerly badlogic/pi-mono; 116,910 stars). CLI doc: https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/cli.md

```text

## Invocation and output

```sh
pi
pi --print "Summarize this repository"
git diff | pi --print "Review this change"
pi --mode json "Inspect this repository" > events.jsonl
```

With terminal stdin and stdout, Pi opens the terminal UI unless `--print`, `--mode json`, or `--mode rpc` selects another interface. When either stream is redirected and neither JSON nor RPC mode is selected, Pi uses print mode. See [CLI Integration](cli-integration.md) for choosing between interactive, print, JSON, RPC, and SDK integration.

| Input | Behavior |
|---|---|
| `message` | Provide an initial prompt |
| `@path` | Include a text file or image in the first prompt |
| Piped stdin | Prepend its contents to the first prompt |
| `--` | Stop option parsing so a prompt can begin with `-` |

Pi resolves `@path` from the current working directory. The working directory also controls project configuration, resource discovery, and session grouping.

`--print` controls whether Pi runs once and exits. `--mode` selects the output interface. `--mode text` does not force one-shot execution when stdin and stdout are terminals; use `--print` for that behavior.

| Option | Behavior |
|---|---|
| `-p`, `--print` | Run the supplied prompts, write the final assistant text to stdout, then exit |
| `--mode text` | Select text output; still open the terminal UI when stdin and stdout are terminals |
| `--mode json` | Run the supplied prompts, write JSONL events to stdout, then exit |
| `--mode rpc` | Read JSONL commands from stdin and write responses and events to stdout until shutdown |
| `--export <input> [output]` | Export a session file to HTML and exit; derive the destination when `output` is omitted |

RPC mode rejects `@file` arguments. JSON and RPC modes reserve stdout for protocol records. See [JSON Event Stream](json.md) and [RPC Protocol](rpc.md).

```
