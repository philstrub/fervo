/**
# Merge Requirements

The deterministic rules for deciding whether a measured node may land.

## 1. What This Module Does
Resolves path requirements and checks evidence from tests, gain, review, and humans.
## 2. Why This Module Exists
Merging must be explainable from committed policy and recorded verdicts.
## 3. How It Fits in the Architecture
The server invokes these pure rules before a compare-and-swap of main.
## 4. Key Concepts
Each changed path contributes requirements; the node needs their union. A pinned path contributes its
own `[[merge.rules]]`, or `tests`, plus `human`.
*/
import { minimatch } from 'minimatch';
import type { Config } from './config.js';

export function matches(path: string, pattern: string): boolean {
  return path === pattern.replace(/\/$/, '') || path.startsWith(`${pattern.replace(/\/$/, '')}/`) || minimatch(path, pattern, { dot: true });
}

// A pinned path is policy: a gain measured under the old policy says nothing about it, so it falls back to
// `tests` rather than main's requirements, and always needs a human verdict.
export function requirements(config: Config, paths: string[]): Set<string> {
  const required = new Set<string>();
  for (const path of paths) {
    const pinned = config.pinned.paths.some(pattern => matches(path, pattern));
    const matching = config.merge.rules.filter(rule => rule.paths.some(pattern => matches(path, pattern)));
    for (const requirement of (matching.length ? matching.flatMap(rule => rule.require) : pinned ? ['tests'] : config.merge.main.require)) required.add(requirement);
    if (pinned) required.add('human');
  }
  return required;
}

export function scopesOverlap(left: string[], right: string[], files: string[]): boolean {
  return left.some(a => right.some(b => {
    const x=a.replace(/\/$/,'');const y=b.replace(/\/$/,'');
    return x===y || x.startsWith(`${y}/`) || y.startsWith(`${x}/`) || files.some(file => matches(file,a) && matches(file,b));
  }));
}
