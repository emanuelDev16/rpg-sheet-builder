import { type CharacterSheetState, detectSystemId } from '../sheetModel.ts';
import { defaultAdapter } from './defaultAdapter.ts';
import { dnd5eAdapter } from './dnd5eAdapter.ts';
import type { SystemAdapter } from './types.ts';
import { wodAdapter } from './wodAdapter.ts';

const adapters = new Map<string, SystemAdapter>();

/** Registers (or replaces) an adapter by id. */
export function registerSystemAdapter(adapter: SystemAdapter): void {
  const id = adapter.id.trim();
  if (!id) {
    throw new Error('SystemAdapter id must be a non-empty string.');
  }
  adapters.set(id, adapter);
}

/** Removes a registered custom adapter by id (built-in `default` is preserved). */
export function unregisterSystemAdapter(id: string): boolean {
  const normalized = id.trim();
  if (!normalized || normalized === defaultAdapter.id) return false;
  return adapters.delete(normalized);
}

/** Resolves the adapter owning a sheet; falls back to `defaultAdapter`. */
export function getSystemAdapter(sheet: CharacterSheetState | null | undefined): SystemAdapter {
  const fallback = adapters.get(defaultAdapter.id) ?? defaultAdapter;
  if (!sheet) return fallback;
  let systemId: string | undefined;
  try {
    systemId = detectSystemId(sheet);
  } catch {
    systemId = sheet.systemId;
  }
  const rulePreset = (sheet.rulePreset ?? sheet.xpRulePreset) as string | undefined;
  for (const [id, adapter] of adapters.entries()) {
    if (id === defaultAdapter.id) continue;
    if (adapter.matches(systemId, rulePreset)) return adapter;
  }
  return fallback;
}

/** Lists ids of every registered adapter, in registration order. */
export function listRegisteredSystems(): string[] {
  return [...adapters.keys()];
}

registerSystemAdapter(wodAdapter);
registerSystemAdapter(dnd5eAdapter);
registerSystemAdapter(defaultAdapter);
