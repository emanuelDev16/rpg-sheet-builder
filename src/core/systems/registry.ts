import { type CharacterSheetState, detectSystemId } from '../sheetModel.ts';
import { defaultAdapter } from './defaultAdapter.ts';
import { dnd5eAdapter } from './dnd5eAdapter.ts';
import type { SystemAdapter } from './types.ts';
import { wodAdapter } from './wodAdapter.ts';

const adapters = new Map<string, SystemAdapter>();

/** Registers (or replaces) an adapter by id. */
export function registerSystemAdapter(adapter: SystemAdapter): void {
  adapters.set(adapter.id, adapter);
}

/** Resolves the adapter owning a sheet; falls back to `defaultAdapter`. */
export function getSystemAdapter(sheet: CharacterSheetState | null | undefined): SystemAdapter {
  if (!sheet) return defaultAdapter;
  let systemId: string | undefined;
  try {
    systemId = detectSystemId(sheet);
  } catch {
    systemId = sheet.systemId;
  }
  const rulePreset = (sheet.rulePreset ?? sheet.xpRulePreset) as string | undefined;
  for (const adapter of adapters.values()) {
    if (adapter.matches(systemId, rulePreset)) return adapter;
  }
  return defaultAdapter;
}

/** Lists ids of every registered adapter, in registration order. */
export function listRegisteredSystems(): string[] {
  return [...adapters.keys()];
}

registerSystemAdapter(wodAdapter);
registerSystemAdapter(dnd5eAdapter);
registerSystemAdapter(defaultAdapter);
