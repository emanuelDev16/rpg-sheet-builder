import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustResourceValue,
  AppMode,
  CharacterSheetState,
  createBlankSheet,
  createDefaultSheet,
  createPresetBySystemId,
  detectSystemId,
  evaluateSheet,
  FieldKind,
  removeCardFromSheet,
  removeFieldFromCard,
  removeRepeatableRow,
  RollLogEntry,
  SheetCard,
  SheetField,
  SYSTEM_OPTIONS,
  SystemId,
  TabId,
  updateCardSchema,
  updateFieldSchema,
  updateFieldValue,
  updateRepeatableRow,
  WorkspaceState,
} from './core/sheetModel';
import {
  computeWorkspaceDigest,
  fetchRoomMirrorSnapshot,
  mirrorWorkspaceToRoom,
  reconcileWorkspaceWithMirror,
  ROOM_EDIT_DEBOUNCE_MS,
  ROOM_PERIODIC_SYNC_INTERVAL_MS,
  ROOM_RETRY_INTERVAL_MS,
  ROOM_SYNC_META_KEY,
  RoomSyncIndicatorState,
  RoomSyncLocalMeta,
} from './core/roomSync';
import { rollDiceExpression } from './core/formula';
import { playDiceClatter } from './core/diceAudio';
import { TopBar } from './components/TopBar';
import { TabNav } from './components/TabNav';
import { BentoCard } from './components/BentoCard';
import { CustomCardBuilder } from './components/CustomCardBuilder';
import { RollLogSidebar } from './components/RollLogSidebar';
import { StatusBar } from './components/StatusBar';
import { SheetModal } from './components/SheetModal';
import { XpUpgradeWorkspace } from './components/XpUpgradeWorkspace';
import { PrintSheetHeader } from './components/PrintSheetHeader';
import { printActiveSheetView } from './core/printSheet';
import {
  awardXp,
  getAvailableXp,
  normalizeXpState,
  undoLastUpgrade,
  upgradeTraitWithXp,
} from './core/xpSystem';

const LEGACY_STORAGE_KEY = 'grid_sheet_wod_v1';
const WORKSPACE_STORAGE_KEY = 'grid_sheet_workspace_v2';

interface InitialWorkspaceBootstrap {
  workspace: WorkspaceState;
  hadLocalWorkspace: boolean;
  updatedAtMillis: number;
  lastMirroredDigest: string;
}

function withSafeXpState(parsed: CharacterSheetState): CharacterSheetState {
  const sysId = detectSystemId(parsed);
  if (parsed.xp) {
    return { ...parsed, systemId: sysId, xp: normalizeXpState(parsed.xp) };
  }
  return {
    ...parsed,
    systemId: sysId,
    xp: {
      totalEarned: 14,
      spent: 0,
      ledger: [
        {
          id: 'xp_seed_legacy',
          timestamp: '22:00',
          kind: 'award',
          delta: 14,
          label: 'CHRONICLE SESSION AWARD',
        },
      ],
    },
  };
}

function readRoomSyncLocalMeta(): RoomSyncLocalMeta | null {
  try {
    const raw = localStorage.getItem(ROOM_SYNC_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSyncLocalMeta>;
    if (typeof parsed.updatedAtMillis === 'number' && Number.isFinite(parsed.updatedAtMillis)) {
      return {
        updatedAtMillis: parsed.updatedAtMillis,
        lastMirroredDigest: typeof parsed.lastMirroredDigest === 'string' ? parsed.lastMirroredDigest : '',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

function writeRoomSyncLocalMeta(meta: RoomSyncLocalMeta): void {
  try {
    localStorage.setItem(ROOM_SYNC_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

function loadInitialWorkspaceBootstrap(): InitialWorkspaceBootstrap {
  const existingMeta = readRoomSyncLocalMeta();
  const now = Date.now();

  try {
    const rawWorkspace = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (rawWorkspace) {
      const parsed = JSON.parse(rawWorkspace) as WorkspaceState;
      if (parsed && parsed.activeSystemId && parsed.sheetsBySystem) {
        const activeSheet = parsed.sheetsBySystem[parsed.activeSystemId];
        if (activeSheet && Array.isArray(activeSheet.cards)) {
          return {
            workspace: {
              activeSystemId: parsed.activeSystemId,
              sheetsBySystem: {
                ...parsed.sheetsBySystem,
                [parsed.activeSystemId]: withSafeXpState(activeSheet),
              },
            },
            hadLocalWorkspace: true,
            updatedAtMillis: existingMeta?.updatedAtMillis ?? now,
            lastMirroredDigest: existingMeta?.lastMirroredDigest ?? '',
          };
        }
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw) as CharacterSheetState;
      if (parsed && Array.isArray(parsed.cards)) {
        const normalized = withSafeXpState(parsed);
        const sysId = detectSystemId(normalized);
        return {
          workspace: {
            activeSystemId: sysId,
            sheetsBySystem: { [sysId]: normalized },
          },
          hadLocalWorkspace: true,
          updatedAtMillis: existingMeta?.updatedAtMillis ?? now,
          lastMirroredDigest: '',
        };
      }
    }

    const bridgeRaw =
      typeof window !== 'undefined' ? window.AndroidRoomBridge?.loadWorkspace?.() : null;
    if (bridgeRaw) {
      const parsed = JSON.parse(bridgeRaw) as WorkspaceState;
      if (parsed && parsed.activeSystemId && parsed.sheetsBySystem) {
        return {
          workspace: parsed,
          hadLocalWorkspace: false,
          updatedAtMillis: now,
          lastMirroredDigest: computeWorkspaceDigest(parsed),
        };
      }
    }
  } catch {
    // Fallback to default seed sheet
  }

  const defaultSheet = createDefaultSheet();
  return {
    workspace: {
      activeSystemId: 'wod',
      sheetsBySystem: { wod: defaultSheet },
    },
    hadLocalWorkspace: false,
    updatedAtMillis: now,
    lastMirroredDigest: '',
  };
}

function nowTimeString(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function App() {
  const [bootstrap] = useState<InitialWorkspaceBootstrap>(loadInitialWorkspaceBootstrap);
  const [workspace, setWorkspace] = useState<WorkspaceState>(bootstrap.workspace);
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [mode, setMode] = useState<AppMode>('jogo');
  const [modalMode, setModalMode] = useState<'open' | 'save' | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [roomSyncState, setRoomSyncState] = useState<RoomSyncIndicatorState>(() => ({
    phase: 'synced',
    nextSyncAtMillis: Date.now() + ROOM_PERIODIC_SYNC_INTERVAL_MS,
    lastSyncedAtMillis: bootstrap.lastMirroredDigest ? bootstrap.updatedAtMillis : null,
  }));

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const updatedAtRef = useRef(bootstrap.updatedAtMillis);
  const lastMirroredDigestRef = useRef(bootstrap.lastMirroredDigest);
  const hydratedRemoteRef = useRef(false);
  const editDebounceTimerRef = useRef<number | null>(null);
  const syncRunIdRef = useRef(0);

  const activeSystemId = workspace.activeSystemId;
  const sheet = useMemo(
    () =>
      workspace.sheetsBySystem[activeSystemId] ?? createPresetBySystemId(activeSystemId),
    [workspace, activeSystemId],
  );

  const setSheet = (
    updater: CharacterSheetState | ((prev: CharacterSheetState) => CharacterSheetState),
  ) => {
    setWorkspace((prevWs) => {
      const currentSheet =
        prevWs.sheetsBySystem[prevWs.activeSystemId] ??
        createPresetBySystemId(prevWs.activeSystemId);
      const nextSheet =
        typeof updater === 'function' ? updater(currentSheet) : updater;
      return {
        ...prevWs,
        sheetsBySystem: {
          ...prevWs.sheetsBySystem,
          [prevWs.activeSystemId]: nextSheet,
        },
      };
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // Ignore storage quota errors
    }
  }, [workspace]);

  const executeRoomSync = async (
    targetWorkspace: WorkspaceState,
    timestamp: number,
    options: { flashOnSuccess?: boolean } = {},
  ) => {
    const runId = ++syncRunIdRef.current;
    setRoomSyncState((prev) => ({
      phase: 'syncing',
      nextSyncAtMillis: null,
      lastSyncedAtMillis: prev.lastSyncedAtMillis,
    }));

    const outcome = await mirrorWorkspaceToRoom(targetWorkspace, { updatedAtMillis: timestamp });
    if (runId !== syncRunIdRef.current) {
      return;
    }

    const latestDigest = computeWorkspaceDigest(workspaceRef.current);
    if (outcome.ok) {
      lastMirroredDigestRef.current = outcome.digest;
      writeRoomSyncLocalMeta({
        updatedAtMillis: outcome.updatedAtMillis,
        lastMirroredDigest: outcome.digest,
      });
      if (latestDigest === outcome.digest) {
        const completedAt = Date.now();
        setRoomSyncState({
          phase: 'synced',
          nextSyncAtMillis: completedAt + ROOM_PERIODIC_SYNC_INTERVAL_MS,
          lastSyncedAtMillis: completedAt,
        });
      }
      if (options.flashOnSuccess) {
        triggerFlash('// ROOM DB: SINCRONIZADO AGORA');
      }
    } else if (latestDigest === outcome.digest) {
      setRoomSyncState((prev) => ({
        phase: 'error',
        nextSyncAtMillis: Date.now() + ROOM_RETRY_INTERVAL_MS,
        lastSyncedAtMillis: prev.lastSyncedAtMillis,
        lastError: outcome.error ?? 'Falha na sincronização Room.',
      }));
    }
  };

  // Hydrate from Android Room mirror on mount if Android has newer offline edits
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remoteMirror = await fetchRoomMirrorSnapshot();
      if (cancelled) return;
      hydratedRemoteRef.current = true;
      const reconciled = reconcileWorkspaceWithMirror(
        workspaceRef.current,
        updatedAtRef.current,
        remoteMirror,
        { hadLocalWorkspace: bootstrap.hadLocalWorkspace },
      );
      if (reconciled.adoptedRemote) {
        const adoptedDigest = computeWorkspaceDigest(reconciled.workspace);
        updatedAtRef.current = reconciled.updatedAtMillis;
        lastMirroredDigestRef.current = adoptedDigest;
        writeRoomSyncLocalMeta({
          updatedAtMillis: reconciled.updatedAtMillis,
          lastMirroredDigest: adoptedDigest,
        });
        setWorkspace(reconciled.workspace);
        const syncedAt = Date.now();
        setRoomSyncState({
          phase: 'synced',
          nextSyncAtMillis: syncedAt + ROOM_PERIODIC_SYNC_INTERVAL_MS,
          lastSyncedAtMillis: syncedAt,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap.hadLocalWorkspace]);

  // Automatically mirror every workspace change into Android Room database (WebView bridge + /api/workspace-sync)
  useEffect(() => {
    const digest = computeWorkspaceDigest(workspace);
    if (digest === lastMirroredDigestRef.current) {
      return;
    }

    const nextTimestamp = Math.max(Date.now(), updatedAtRef.current + 1);
    updatedAtRef.current = nextTimestamp;

    if (editDebounceTimerRef.current !== null) {
      window.clearTimeout(editDebounceTimerRef.current);
      editDebounceTimerRef.current = null;
    }

    setRoomSyncState((prev) => ({
      phase: 'scheduled',
      nextSyncAtMillis: Date.now() + ROOM_EDIT_DEBOUNCE_MS,
      lastSyncedAtMillis: prev.lastSyncedAtMillis,
    }));

    const timerId = window.setTimeout(() => {
      editDebounceTimerRef.current = null;
      void executeRoomSync(workspace, nextTimestamp);
    }, ROOM_EDIT_DEBOUNCE_MS);
    editDebounceTimerRef.current = timerId;

    return () => {
      window.clearTimeout(timerId);
      if (editDebounceTimerRef.current === timerId) {
        editDebounceTimerRef.current = null;
      }
    };
  }, [workspace]);

  // Periodic Room Database checkpoint & automatic retry scheduler
  useEffect(() => {
    if (
      (roomSyncState.phase !== 'synced' && roomSyncState.phase !== 'error') ||
      roomSyncState.nextSyncAtMillis === null
    ) {
      return;
    }

    const delayMs = Math.max(100, roomSyncState.nextSyncAtMillis - Date.now());
    const timerId = window.setTimeout(() => {
      const currentDigest = computeWorkspaceDigest(workspaceRef.current);
      if (currentDigest !== lastMirroredDigestRef.current || roomSyncState.phase === 'error') {
        const nextTs = Math.max(Date.now(), updatedAtRef.current + 1);
        updatedAtRef.current = nextTs;
        void executeRoomSync(workspaceRef.current, nextTs);
        return;
      }

      void (async () => {
        const runId = ++syncRunIdRef.current;
        setRoomSyncState((prev) => ({
          phase: 'syncing',
          nextSyncAtMillis: null,
          lastSyncedAtMillis: prev.lastSyncedAtMillis,
        }));

        const remoteMirror = await fetchRoomMirrorSnapshot();
        if (runId !== syncRunIdRef.current) return;

        const reconciled = reconcileWorkspaceWithMirror(
          workspaceRef.current,
          updatedAtRef.current,
          remoteMirror,
          { hadLocalWorkspace: true },
        );
        if (reconciled.adoptedRemote) {
          const adoptedDigest = computeWorkspaceDigest(reconciled.workspace);
          updatedAtRef.current = reconciled.updatedAtMillis;
          lastMirroredDigestRef.current = adoptedDigest;
          writeRoomSyncLocalMeta({
            updatedAtMillis: reconciled.updatedAtMillis,
            lastMirroredDigest: adoptedDigest,
          });
          setWorkspace(reconciled.workspace);
          const syncedAt = Date.now();
          setRoomSyncState({
            phase: 'synced',
            nextSyncAtMillis: syncedAt + ROOM_PERIODIC_SYNC_INTERVAL_MS,
            lastSyncedAtMillis: syncedAt,
          });
          return;
        }

        const outcome = await mirrorWorkspaceToRoom(workspaceRef.current, {
          updatedAtMillis: updatedAtRef.current,
        });
        if (runId !== syncRunIdRef.current) return;

        if (outcome.ok) {
          const syncedAt = Date.now();
          setRoomSyncState({
            phase: 'synced',
            nextSyncAtMillis: syncedAt + ROOM_PERIODIC_SYNC_INTERVAL_MS,
            lastSyncedAtMillis: syncedAt,
          });
        } else {
          setRoomSyncState((prev) => ({
            phase: 'error',
            nextSyncAtMillis: Date.now() + ROOM_RETRY_INTERVAL_MS,
            lastSyncedAtMillis: prev.lastSyncedAtMillis,
            lastError: outcome.error ?? 'Falha na verificação periódica Room.',
          }));
        }
      })();
    }, delayMs);

    return () => window.clearTimeout(timerId);
  }, [roomSyncState.phase, roomSyncState.nextSyncAtMillis]);

  // Flush pending workspace mirror cleanly when page hides or closes
  useEffect(() => {
    const flushPendingMirror = () => {
      const currentDigest = computeWorkspaceDigest(workspaceRef.current);
      if (currentDigest === lastMirroredDigestRef.current) return;
      const flushTimestamp = Math.max(Date.now(), updatedAtRef.current + 1);
      updatedAtRef.current = flushTimestamp;
      lastMirroredDigestRef.current = currentDigest;
      writeRoomSyncLocalMeta({
        updatedAtMillis: flushTimestamp,
        lastMirroredDigest: currentDigest,
      });
      void mirrorWorkspaceToRoom(workspaceRef.current, {
        updatedAtMillis: flushTimestamp,
        keepalive: true,
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushPendingMirror();
      }
    };

    window.addEventListener('pagehide', flushPendingMirror);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flushPendingMirror);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [lastMirroredDigestRef, updatedAtRef, workspaceRef]);

  const triggerFlash = (msg: string) => {
    setFlashMessage(msg);
    window.setTimeout(() => {
      setFlashMessage((curr) => (curr === msg ? null : curr));
    }, 2400);
  };

  const evaluation = useMemo(() => evaluateSheet(sheet), [sheet]);

  const visibleCards = useMemo(
    () => sheet.cards.filter((card) => card.tab === activeTab),
    [sheet.cards, activeTab],
  );

  const appendRollLog = (label: string, expression: string) => {
    const result = rollDiceExpression(expression, evaluation.variables);
    if (!result.ok) {
      triggerFlash(`ERRO NA ROLAGEM: ${result.error}`);
      return;
    }
    const entry: RollLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeString(),
      label,
      total: result.total,
      formula: result.resolvedExpression,
      breakdown: result.breakdown,
      isCritical: result.isCritical,
      isFumble: result.isFumble,
      isPoolRoll: result.isPoolRoll,
    };
    playDiceClatter({
      diceCount: result.rolls.length || 1,
      isCritical: result.isCritical,
      isFumble: result.isFumble,
    });
    setSheet((prev) => ({
      ...prev,
      rollLogs: [entry, ...prev.rollLogs].slice(0, 30),
    }));
  };

  const handleFieldRoll = (field: SheetField) => {
    appendRollLog(field.rollLabel ?? field.label, field.rollExpr ?? '2d6');
  };

  const handleAddField = (cardId: string, kind: FieldKind, customLabel?: string) => {
    const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const cleanLabel = customLabel?.trim().toUpperCase();
    const derivedKey = cleanLabel
      ? cleanLabel
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
      : '';
    const shortUid = uid.slice(0, 4);
    const defaults: Record<FieldKind, SheetField> = {
      number: {
        id: `f_${uid}`,
        key: derivedKey || `attr_${shortUid}`,
        label: cleanLabel || 'NOVO ATRIBUTO',
        kind: 'number',
        value: 0,
      },
      text: {
        id: `f_${uid}`,
        key: derivedKey || `txt_${shortUid}`,
        label: cleanLabel || 'CAMPO TEXTO',
        kind: 'text',
        value: '',
      },
      calculated: {
        id: `f_${uid}`,
        key: derivedKey || `calc_${shortUid}`,
        label: cleanLabel || 'CALC_CUSTOM',
        kind: 'calculated',
        formula: '0',
        showPlus: true,
      },
      resource: {
        id: `f_${uid}`,
        key: derivedKey || `res_${shortUid}`,
        label: cleanLabel || 'NOVO RECURSO',
        kind: 'resource',
        value: 4,
        max: 6,
      },
      boolean: {
        id: `f_${uid}`,
        key: derivedKey || `flag_${shortUid}`,
        label: cleanLabel || 'MARCADOR',
        kind: 'boolean',
        value: false,
      },
      roll: {
        id: `f_${uid}`,
        key: derivedKey || `roll_${shortUid}`,
        label: cleanLabel || 'ROLAGEM CUSTOM',
        kind: 'roll',
        rollLabel: cleanLabel || 'ROLAR TESTE',
        rollExpr: '2d6',
      },
      repeatable: {
        id: `f_${uid}`,
        key: derivedKey || `list_${shortUid}`,
        label: cleanLabel || 'LISTA',
        kind: 'repeatable',
        columns: ['ITEM', 'VALOR'],
        col2Type: 'text',
        rows: [],
      },
    };
    setSheet((prev) => addFieldToCard(prev, cardId, defaults[kind]));
  };

  const handleCreateCard = (newCard: SheetCard) => {
    setSheet((prev) => addCardToSheet(prev, newCard));
    triggerFlash(`// BLOCO CRIADO: ${newCard.title}`);
  };

  const handleNewSheet = () => {
    const blank = createBlankSheet();
    setWorkspace((prevWs) => ({
      activeSystemId: 'blank',
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        blank,
      },
    }));
    setActiveTab('geral');
    setMode('edicao');
    triggerFlash('// STATUS: FICHA EM BRANCO · CRIE SEUS BLOCOS');
  };

  const handleSwitchSystem = (nextSystemId: SystemId) => {
    const existing = workspace.sheetsBySystem[nextSystemId];
    const nextSheet = existing ? withSafeXpState(existing) : createPresetBySystemId(nextSystemId);
    setWorkspace((prevWs) => ({
      activeSystemId: nextSystemId,
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        [nextSystemId]: nextSheet,
      },
    }));
    if (nextSystemId === 'blank' && nextSheet.cards.length === 0) {
      if (activeTab === 'xp') setActiveTab('geral');
      setMode('edicao');
    }
    const sysLabel = SYSTEM_OPTIONS.find((s) => s.id === nextSystemId)?.shortLabel ?? nextSystemId;
    triggerFlash(`// SISTEMA ATIVO: ${sysLabel}`);
  };

  const handleLoadPreset = (presetId: SystemId) => {
    const fresh = createPresetBySystemId(presetId);
    setWorkspace((prevWs) => ({
      activeSystemId: presetId,
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        [presetId]: fresh,
      },
    }));
    setActiveTab('geral');
    if (presetId === 'blank' && fresh.cards.length === 0) {
      setMode('edicao');
    }
    triggerFlash('// STATUS: MODELO CARREGADO');
  };

  const handleAwardXp = (delta: number, reason: string): { ok: boolean; error?: string } => {
    const entryId = `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let outcome: { ok: boolean; error?: string } = { ok: true };
    setSheet((prev) => {
      const res = awardXp(prev, delta, reason, nowTimeString(), entryId);
      outcome = { ok: res.ok, error: res.error };
      return res.ok ? res.sheet : prev;
    });
    if (outcome.ok) {
      triggerFlash(`// XP: ${delta > 0 ? `+${delta}` : delta} XP REGISTRADO`);
    }
    return outcome;
  };

  const handleUpgradeTrait = (fieldId: string) => {
    const entryId = `xp_upg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let flashText: string | null = null;
    setSheet((prev) => {
      const res = upgradeTraitWithXp(prev, fieldId, nowTimeString(), entryId);
      if (!res.ok || !res.trait) {
        flashText = `// XP ERRO: ${res.error ?? 'FALHA NO UPGRADE'}`;
        return prev;
      }
      flashText = `// XP: ${res.trait.label} ${res.trait.currentValue} → ${res.trait.nextValue} (-${res.trait.cost} XP)`;
      return res.sheet;
    });
    if (flashText) triggerFlash(flashText);
  };

  const handleUndoLastUpgrade = () => {
    let flashText: string | null = null;
    setSheet((prev) => {
      const res = undoLastUpgrade(prev);
      if (!res.ok) {
        flashText = `// XP: ${res.error ?? 'NADA PARA DESFAZER'}`;
        return prev;
      }
      flashText = `// XP: REVERTIDO ${res.revertedLabel}`;
      return res.sheet;
    });
    if (flashText) triggerFlash(flashText);
  };

  const availableXp = useMemo(() => getAvailableXp(sheet.xp), [sheet.xp]);

  const handlePrintPdf = () => {
    const res = printActiveSheetView(sheet, activeTab);
    if (!res.ok && res.error) {
      triggerFlash(`// PDF ERRO: ${res.error}`);
    } else {
      triggerFlash(`// PDF PRONTO: ${res.documentTitle}`);
    }
  };

  return (
    <div className="print-shell min-h-screen lg:h-screen print:h-auto flex flex-col bg-[var(--bg-canvas)] text-[var(--ink-primary)] overflow-x-hidden lg:overflow-hidden print:overflow-visible">
      <TopBar
        systemCode={sheet.systemCode}
        activeSystemId={activeSystemId}
        mode={mode}
        onChangeSystemCode={(systemCode) => setSheet((prev) => ({ ...prev, systemCode }))}
        onSwitchSystem={handleSwitchSystem}
        onModeChange={setMode}
        onNewSheet={handleNewSheet}
        onOpenModal={() => setModalMode('open')}
        onSaveModal={() => setModalMode('save')}
        onPrintPdf={handlePrintPdf}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="print-main cyber-grid-canvas flex-1 p-4 sm:p-6 print:p-0 overflow-y-auto print:overflow-visible min-h-0">
          <div className="max-w-[1140px] mx-auto">
            <PrintSheetHeader
              sheet={sheet}
              systemId={activeSystemId}
              activeTab={activeTab}
              availableXp={availableXp}
              totalCargoWeight={evaluation.totalCargoWeight}
            />

            <TabNav
              activeTab={activeTab}
              systemId={activeSystemId}
              onSelectTab={setActiveTab}
              characterName={sheet.characterName}
              mode={mode}
              onChangeCharacterName={(characterName) =>
                setSheet((prev) => ({ ...prev, characterName }))
              }
            />

            {activeTab === 'xp' ? (
              <XpUpgradeWorkspace
                sheet={sheet}
                onAwardXp={handleAwardXp}
                onUpgradeTrait={handleUpgradeTrait}
                onUndoLastUpgrade={handleUndoLastUpgrade}
              />
            ) : (
              <div className="bento-print-grid grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {visibleCards.map((card) => (
                  <BentoCard
                    key={card.id}
                    card={card}
                    mode={mode}
                    evaluation={evaluation}
                    onChangeValue={(fid, val) => setSheet((prev) => updateFieldValue(prev, fid, val))}
                    onAdjustResource={(fid, delta) =>
                      setSheet((prev) => adjustResourceValue(prev, fid, delta))
                    }
                    onRoll={handleFieldRoll}
                    onAddRow={(fid) =>
                      setSheet((prev) =>
                        addRepeatableRow(
                          prev,
                          fid,
                          `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 4)}`,
                        ),
                      )
                    }
                    onUpdateRow={(fid, rid, col, val) =>
                      setSheet((prev) => updateRepeatableRow(prev, fid, rid, col, val))
                    }
                    onRemoveRow={(fid, rid) =>
                      setSheet((prev) => removeRepeatableRow(prev, fid, rid))
                    }
                    onUpdateSchema={(fid, patch) =>
                      setSheet((prev) => updateFieldSchema(prev, fid, patch))
                    }
                    onRemoveField={(cid, fid) =>
                      setSheet((prev) => removeFieldFromCard(prev, cid, fid))
                    }
                    onAddField={handleAddField}
                    onUpdateCard={(cid, patch) =>
                      setSheet((prev) => updateCardSchema(prev, cid, patch))
                    }
                    onRemoveCard={(cid) => {
                      setSheet((prev) => removeCardFromSheet(prev, cid));
                      triggerFlash('// BLOCO REMOVIDO');
                    }}
                  />
                ))}
                {(visibleCards.length === 0 || mode === 'edicao') && (
                  <CustomCardBuilder
                    activeTab={activeTab}
                    isEmptySheet={visibleCards.length === 0}
                    onCreateCard={handleCreateCard}
                  />
                )}
              </div>
            )}
          </div>
        </main>

        <RollLogSidebar
          logs={sheet.rollLogs}
          systemId={activeSystemId}
          systemName={sheet.systemName}
          onQuickRoll={(expr) => appendRollLog(`ROLAGEM · ${expr.toUpperCase()}`, expr)}
          onClearLogs={() => setSheet((prev) => ({ ...prev, rollLogs: [] }))}
        />
      </div>

      <StatusBar
        mode={mode}
        errorCount={evaluation.formulaErrors.length}
        firstError={evaluation.formulaErrors[0]?.error}
        totalCargoWeight={evaluation.totalCargoWeight}
        availableXp={availableXp}
        rollCount={sheet.rollLogs.length}
        flashMessage={flashMessage}
        roomSyncState={roomSyncState}
        onForceRoomSync={() => {
          if (editDebounceTimerRef.current !== null) {
            window.clearTimeout(editDebounceTimerRef.current);
            editDebounceTimerRef.current = null;
          }
          const nextTs = Math.max(Date.now(), updatedAtRef.current + 1);
          updatedAtRef.current = nextTs;
          void executeRoomSync(workspaceRef.current, nextTs, { flashOnSuccess: true });
        }}
      />

      <SheetModal
        mode={modalMode}
        sheet={sheet}
        activeSystemId={activeSystemId}
        onClose={() => setModalMode(null)}
        onLoadPreset={handleLoadPreset}
        onPrintPdf={handlePrintPdf}
        onImportJson={(next) => {
          const normalized = withSafeXpState(next);
          const nextId = detectSystemId(normalized);
          setWorkspace((prevWs) => ({
            activeSystemId: nextId,
            sheetsBySystem: {
              ...prevWs.sheetsBySystem,
              [nextId]: normalized,
            },
          }));
          triggerFlash('// STATUS: JSON IMPORTADO COM SUCESSO');
        }}
        onSaveLocal={() => {
          try {
            localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
            triggerFlash('// STATUS: FICHA SALVA LOCALMENTE');
          } catch {
            triggerFlash('// STATUS: ERRO AO SALVAR NO NAVEGADOR');
          }
        }}
      />
    </div>
  );
}
