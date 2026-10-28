"""
# Git

The one way any Fervo process runs the `git` binary.

## 1. What This Module Does

`git(cwd, *args)` runs `git` in a directory and returns its stdout with the
trailing newline stripped. A non-zero exit raises `CalledProcessError`.

## 2. Why This Module Exists

Fervo drives git through the binary, with no libgit2 or dulwich, so it
gets git's behaviour exactly and every step can be replayed by hand
(plan section 3). Keeping the call in one place keeps that behaviour
uniform: stdout is captured for parsing, and stderr is left on the
caller's terminal so git's own error message is what a human or agent
sees when a fetch or push fails.

## 3. How It Fits in the Architecture

The CLI uses it to clone, read `.git/config`, fetch node refs, branch and
push. The server will use it for the bare repo, hooks and merges.

## 4. Key Concepts

- stdout is data and is returned; stderr is diagnostics and passes
  through. This keeps the CLI's own stdout pure JSON.
"""

import subprocess
from pathlib import Path


def git(cwd: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, check=True, stdout=subprocess.PIPE, text=True
    ).stdout.rstrip("\n")
