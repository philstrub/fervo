/**
# Extension Loader

Loads the operator's extension modules and the built-ins through one registration API.

## 1. What This Module Does
Reads `<root>/.fervo/settings.json`, writing the packaged default there when it is missing, and calls
each extension's default export with a host API: the built-ins first, then the listed extensions in order.
## 2. Why This Module Exists
Operators add rules (and later gates, producers, providers) without forking Fervo, and every built-in is
registered the same way, so any one of them can be disabled or replaced.
## 3. How It Fits in the Architecture
The server and the runner each build their own host API and registry and pass it here; this module knows
nothing about what is registered.
## 4. Key Concepts
An extension is a module whose default export is `(fervo) => void`, sync or async. A spec is a Node module
specifier resolved from `<root>/.fervo/`: a path (`./ext/limits.ts`) or a package installed there with
`npm i`. `.ts` files load through Node's type stripping, which does not apply inside `node_modules`.
Extensions never come from the managed repository, which agents write.
Any failure stops startup with the extension's spec: a missing rule would silently relax merging.
## 5. Settings
`{ "extensions": [specs], "disable": [built-in names] }`; unknown keys and unknown built-in names are
errors, so a typo cannot drop a rule. `fervo init` writes the packaged `settings.default.json`.
*/
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

export type Extension<API> = (fervo: API) => void | Promise<void>;
export const Settings = z.object({ extensions: z.array(z.string()).default([]), disable: z.array(z.string()).default([]) }).strict();
export type Settings = z.output<typeof Settings>;
export const defaultSettings = fileURLToPath(new URL('../../settings.default.json', import.meta.url));

export function writeDefaultSettings(root: string): string {
  const file = join(root, '.fervo', 'settings.json');
  copyFileSync(defaultSettings, file);
  return file;
}

export function serverSettings(root: string): Settings {
  const file = join(root, '.fervo', 'settings.json');
  if (!existsSync(file)) { writeDefaultSettings(root); process.stderr.write(`[serverSettings] wrote the default settings to ${file}\n`); }
  try { return Settings.parse(JSON.parse(readFileSync(file, 'utf8'))); }
  catch (error) { throw new Error(`${file}: ${(error as Error).message}`, { cause: error }); }
}

// Only specifiers carrying this prefix are re-resolved, so imports inside an extension resolve as usual.
const prefix = 'fervo-extension:';

export async function loadExtensions<API>(host: (source: string) => API, builtins: Record<string, Extension<API>>, settings: Settings, base: string): Promise<string[]> {
  const unknown = settings.disable.filter(name => !(name in builtins));
  if (unknown.length) throw new Error(`disable names unknown built-ins: ${unknown.join(', ')} (built-ins: ${Object.keys(builtins).join(', ')})`);
  const loaded: string[] = [];
  for (const [name, factory] of Object.entries(builtins)) if (!settings.disable.includes(name)) { await factory(host(name)); loaded.push(name); }
  const parentURL = pathToFileURL(join(base, '/')).href;
  const hooks = registerHooks({ resolve: (specifier, context, next) => specifier.startsWith(prefix) ? next(specifier.slice(prefix.length), { ...context, parentURL }) : next(specifier, context) });
  try {
    for (const spec of settings.extensions) {
      try {
        const module = await import(prefix + spec) as { default?: unknown };
        if (typeof module.default !== 'function') throw new Error('the default export must be a function (fervo) => { ... }');
        await (module.default as Extension<API>)(host(spec));
      } catch (error) { throw new Error(`extension ${spec}: ${(error as Error).message}`, { cause: error }); }
      loaded.push(spec);
    }
  } finally { hooks.deregister(); }
  return loaded;
}
