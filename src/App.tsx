import { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, X } from 'lucide-react';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustHealthDamage,
  adjustResourceValue,
  AppMode,
  CharacterSheetState,
  consumeWillpowerForRoll,
  createBlankSheet,
  createDefaultSheet,
  createPresetBySystemId,
  detectSystemId,
  evaluateSheet,
  FieldKind,
  migrateLegacyWodSheet,
  migrateWorkspaceSheets,
  removeCardFromSheet,
  removeFieldFromCard,
  removeRepeatableRow,
  RollLogEntry,
  SheetCard,
  SheetField,
  SYSTEM_OPTIONS,
  SystemId,
  TabId,
  touchSheetMetadata,
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
import {
  isWodPoolExpression,
  rollDiceExpression,
  WodPoolOptions,
} from './core/formula';
import { isDiceAudioMuted, playDiceClatter, setDiceAudioMuted } from './core/diceAudio';
import {
  AppLanguage,
  getTranslations,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
} from './core/i18n';
import { filterCardsByQuery } from './core/sheetSearch';
import { TopBar } from './components/TopBar';
import { TabNav } from './components/TabNav';
import { SheetSearchBar } from './components/SheetSearchBar';
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
  const migrated = migrateLegacyWodSheet({ ...parsed, systemId: sysId });
  if (migrated.xp) {
    return { ...migrated, systemId: sysId, xp: normalizeXpState(migrated.xp) };
  }
  return {
    ...migrated,
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
        baseRevisions: parsed.baseRevisions,
        dirtySystems: parsed.dirtySystems,
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
        const migratedWs = migrateWorkspaceSheets(parsed);
        const activeSheet = migratedWs.sheetsBySystem[migratedWs.activeSystemId];
        if (activeSheet && Array.isArray(activeSheet.cards)) {
          return {
            workspace: {
              activeSystemId: migratedWs.activeSystemId,
              sheetsBySystem: {
                ...migratedWs.sheetsBySystem,
                [migratedWs.activeSystemId]: withSafeXpState(activeSheet),
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
        const migratedBridge = migrateWorkspaceSheets(parsed);
        return {
          workspace: migratedBridge,
          hadLocalWorkspace: false,
          updatedAtMillis: now,
          lastMirroredDigest: computeWorkspaceDigest(migratedBridge),
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
  const [language, setLanguage] = useState<AppLanguage>(readStoredLanguage);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'open' | 'save' | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(isDiceAudioMuted);
  const [mobileRollToast, setMobileRollToast] = useState<RollLogEntry | null>(null);
  const mobileRollToastTimerRef = useRef<number | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [roomSyncState, setRoomSyncState] = useState<RoomSyncIndicatorState>(() => ({
    phase: 'synced',
    nextSyncAtMillis: Date.now() + ROOM_PERIODIC_SYNC_INTERVAL_MS,
    lastSyncedAtMillis: bootstrap.lastMirroredDigest ? bootstrap.updatedAtMillis : null,
  }));

  const t = useMemo(() => getTranslations(language), [language]);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage errors
    }
    const langMeta = LANGUAGE_OPTIONS.find((opt) => opt.id === language);
    if (langMeta && typeof document !== 'undefined') {
      document.documentElement.lang = langMeta.htmlLang;
    }
  }, [language]);

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const updatedAtRef = useRef(bootstrap.updatedAtMillis);
  const lastMirroredDigestRef = useRef(bootstrap.lastMirroredDigest);
  const baseRevisionsRef = useRef<Partial<Record<SystemId, number>>>(
    readRoomSyncLocalMeta()?.baseRevisions ?? {},
  );
  const dirtySystemsRef = useRef<Partial<Record<SystemId, boolean>>>(
    readRoomSyncLocalMeta()?.dirtySystems ?? {},
  );
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
      const sysId = prevWs.activeSystemId;
      const currentSheet =
        prevWs.sheetsBySystem[sysId] ??
        createPresetBySystemId(sysId);
      const rawNext =
        typeof updater === 'function' ? updater(currentSheet) : updater;
      const baseRev = baseRevisionsRef.current[sysId] ?? currentSheet.revision ?? 1;
      baseRevisionsRef.current[sysId] = baseRev;
      dirtySystemsRef.current[sysId] = true;
      const nextSheet = {
        ...touchSheetMetadata(rawNext),
        revision: baseRev,
      };
      return {
        ...prevWs,
        sheetsBySystem: {
          ...prevWs.sheetsBySystem,
          [sysId]: nextSheet,
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
    const sysId = targetWorkspace.activeSystemId;
    const targetSheet = targetWorkspace.sheetsBySystem[sysId];
    const baseRevision = baseRevisionsRef.current[sysId] ?? targetSheet?.revision ?? 1;

    setRoomSyncState((prev) => ({
      phase: 'syncing',
      nextSyncAtMillis: null,
      lastSyncedAtMillis: prev.lastSyncedAtMillis,
      conflict: prev.conflict,
    }));

    const outcome = await mirrorWorkspaceToRoom(targetWorkspace, {
      updatedAtMillis: timestamp,
      baseRevision,
    });
    if (runId !== syncRunIdRef.current) {
      return;
    }

    if (outcome.status === 409 && outcome.conflict) {
      dirtySystemsRef.current[sysId] = true;
      setRoomSyncState((prev) => ({
        phase: 'conflict',
        nextSyncAtMillis: null,
        lastSyncedAtMillis: prev.lastSyncedAtMillis,
        lastError: 'REVISION_CONFLICT',
        conflict: outcome.conflict,
      }));
      triggerFlash(
        `// CONFLITO DE REVISÃO (409): LOCAL R${outcome.conflict.baseRevision} vs SERVIDOR R${outcome.conflict.serverSheet.revision}`,
      );
      return;
    }

    const latestDigest = computeWorkspaceDigest(workspaceRef.current);
    if (outcome.ok) {
      const confirmedRevision = outcome.confirmedRevision ?? baseRevision + 1;
      baseRevisionsRef.current[sysId] = confirmedRevision;
      dirtySystemsRef.current[sysId] = latestDigest !== outcome.digest;
      lastMirroredDigestRef.current = outcome.digest;
      writeRoomSyncLocalMeta({
        updatedAtMillis: outcome.updatedAtMillis,
        lastMirroredDigest: outcome.digest,
        baseRevisions: baseRevisionsRef.current,
        dirtySystems: dirtySystemsRef.current,
      });
      if (latestDigest === outcome.digest) {
        const completedAt = Date.now();
        setRoomSyncState({
          phase: 'synced',
          nextSyncAtMillis: completedAt + ROOM_PERIODIC_SYNC_INTERVAL_MS,
          lastSyncedAtMillis: completedAt,
          conflict: null,
        });
      }
      if (options.flashOnSuccess) {
        triggerFlash(t.statusBar.roomSyncedFlash);
      }
    } else if (latestDigest === outcome.digest) {
      setRoomSyncState((prev) => ({
        phase: 'error',
        nextSyncAtMillis: Date.now() + ROOM_RETRY_INTERVAL_MS,
        lastSyncedAtMillis: prev.lastSyncedAtMillis,
        lastError: outcome.error ?? 'Falha na sincronização Room.',
        conflict: null,
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
        const adoptedActive = reconciled.workspace.sheetsBySystem[reconciled.workspace.activeSystemId];
        const migratedWorkspace: WorkspaceState = adoptedActive
          ? {
              ...reconciled.workspace,
              sheetsBySystem: {
                ...reconciled.workspace.sheetsBySystem,
                [reconciled.workspace.activeSystemId]: withSafeXpState(adoptedActive),
              },
            }
          : reconciled.workspace;
        const adoptedDigest = computeWorkspaceDigest(migratedWorkspace);
        updatedAtRef.current = reconciled.updatedAtMillis;
        lastMirroredDigestRef.current = adoptedDigest;
        writeRoomSyncLocalMeta({
          updatedAtMillis: reconciled.updatedAtMillis,
          lastMirroredDigest: adoptedDigest,
        });
        setWorkspace(migratedWorkspace);
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
    writeRoomSyncLocalMeta({
      updatedAtMillis: nextTimestamp,
      lastMirroredDigest: lastMirroredDigestRef.current,
    });

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

  useEffect(() => {
    return () => {
      if (mobileRollToastTimerRef.current !== null) {
        window.clearTimeout(mobileRollToastTimerRef.current);
      }
    };
  }, []);

  const dismissMobileRollToast = () => {
    if (mobileRollToastTimerRef.current !== null) {
      window.clearTimeout(mobileRollToastTimerRef.current);
      mobileRollToastTimerRef.current = null;
    }
    setMobileRollToast(null);
  };

  const handleToggleAudioMute = () => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      setDiceAudioMuted(next);
      return next;
    });
  };

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

  const filteredCards = useMemo(
    () => filterCardsByQuery(visibleCards, searchQuery),
    [visibleCards, searchQuery],
  );

  const matchedFieldCount = useMemo(
    () => filteredCards.reduce((sum, entry) => sum + entry.matchedFields.length, 0),
    [filteredCards],
  );

  const appendRollLog = (
    label: string,
    expression: string,
    poolOptions?: WodPoolOptions,
  ) => {
    const isPool = isWodPoolExpression(expression);
    const allFields = sheet.cards.flatMap((c) => c.fields);
    const willpowerField = allFields.find((f) => f.id === 'f_willpower' || f.key === 'willpower');
    const wpBoostField = allFields.find((f) => f.id === 'f_wp_boost' || f.key === 'wp_boost');
    const currentWillpower =
      typeof willpowerField?.value === 'number'
        ? willpowerField.value
        : evaluation.variables.willpower ?? 0;
    const wpAutoSuccess = isPool && Boolean(wpBoostField?.value) && currentWillpower > 0;

    const result = rollDiceExpression(
      expression,
      evaluation.variables,
      Math.random,
      isPool ? { ...poolOptions, willpowerAutoSuccess: wpAutoSuccess } : undefined,
    );
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
      rolls: result.rolls,
      difficulty: result.difficulty,
      specialty: result.specialty,
      willpowerUsed: result.willpowerUsed,
      isSoak: result.isSoak,
      onesCount: result.onesCount,
      canceledOnes: result.canceledOnes,
      doubledTensCount: result.doubledTensCount,
      outcome: result.outcome,
      isCritical: result.isCritical,
      isFumble: result.isFumble,
      isPoolRoll: result.isPoolRoll,
    };
    playDiceClatter({
      diceCount: result.rolls.length || 1,
      isCritical: result.isCritical,
      isFumble: result.isFumble,
    });
    setMobileRollToast(entry);
    if (mobileRollToastTimerRef.current !== null) {
      window.clearTimeout(mobileRollToastTimerRef.current);
    }
    mobileRollToastTimerRef.current = window.setTimeout(() => {
      mobileRollToastTimerRef.current = null;
      setMobileRollToast((curr) => (curr?.id === entry.id ? null : curr));
    }, 4000);
    setSheet((prev) => {
      const updatedSheet = wpAutoSuccess ? consumeWillpowerForRoll(prev) : prev;
      return {
        ...updatedSheet,
        rollLogs: [entry, ...updatedSheet.rollLogs].slice(0, 30),
      };
    });
  };

  const handleFieldRoll = (field: SheetField) => {
    const expr = field.rollExpr ?? '2d6';
    const isPool = isWodPoolExpression(expr);
    const isSoak = Boolean(field.isSoak || field.id === 'f_soak' || field.key === 'soak_roll');
    appendRollLog(
      field.rollLabel ?? field.label,
      expr,
      isPool
        ? {
            difficulty: field.rollDifficulty,
            specialty: field.rollSpecialty,
            modifier: field.rollMod,
            isSoak,
          }
        : undefined,
    );
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
    setSearchQuery('');
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
    setSearchQuery('');
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
    setSearchQuery('');
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
    <div className="print-shell h-[100dvh] lg:h-screen print:h-auto flex flex-col bg-[var(--bg-canvas)] text-[var(--ink-primary)] overflow-hidden print:overflow-visible">
      <TopBar
        systemCode={sheet.systemCode}
        activeSystemId={activeSystemId}
        mode={mode}
        language={language}
        isAudioMuted={isAudioMuted}
        t={t.topBar}
        onChangeSystemCode={(systemCode) => setSheet((prev) => ({ ...prev, systemCode }))}
        onSwitchSystem={handleSwitchSystem}
        onChangeLanguage={setLanguage}
        onToggleAudioMute={handleToggleAudioMute}
        onModeChange={setMode}
        onNewSheet={handleNewSheet}
        onOpenModal={() => setModalMode('open')}
        onSaveModal={() => setModalMode('save')}
        onPrintPdf={handlePrintPdf}
      />

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <main className="print-main cyber-grid-canvas flex-1 p-3 sm:p-6 print:p-0 overflow-y-auto print:overflow-visible min-h-0">
          <div className="max-w-[1140px] mx-auto">
            <PrintSheetHeader
              sheet={sheet}
              systemId={activeSystemId}
              activeTab={activeTab}
              language={language}
              availableXp={availableXp}
              totalCargoWeight={evaluation.totalCargoWeight}
            />

            <TabNav
              activeTab={activeTab}
              systemId={activeSystemId}
              language={language}
              t={t.tabNav}
              onSelectTab={setActiveTab}
              characterName={sheet.characterName}
              mode={mode}
              onChangeCharacterName={(characterName) =>
                setSheet((prev) => ({ ...prev, characterName }))
              }
            />

            <div
              role="tabpanel"
              id={`sheet-tabpanel-${activeTab}`}
              aria-labelledby={`sheet-tab-${activeTab}`}
            >
              {activeTab !== 'xp' && (
                <SheetSearchBar
                  query={searchQuery}
                  onChangeQuery={setSearchQuery}
                  matchedFieldCount={matchedFieldCount}
                  matchedCardCount={filteredCards.length}
                  t={t.searchBar}
                />
              )}

              {activeTab === 'xp' ? (
              <XpUpgradeWorkspace
                sheet={sheet}
                t={t.xp}
                onAwardXp={handleAwardXp}
                onUpgradeTrait={handleUpgradeTrait}
                onUndoLastUpgrade={handleUndoLastUpgrade}
              />
            ) : (
              <div className="bento-print-grid grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {searchQuery.trim() && filteredCards.length === 0 ? (
                  <section
                    data-testid="sheet-search-empty"
                    className="bento-card lg:col-span-2 p-6 text-center flex flex-col items-center gap-2 border-dashed"
                  >
                    <p className="font-mono-tech text-xs font-bold uppercase text-[var(--ink-primary)]">
                      {t.searchBar.emptyTitle(searchQuery.trim())}
                    </p>
                    <p className="font-mono-tech text-[11px] text-[var(--ink-muted)]">
                      {t.searchBar.emptyHint}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="cyber-btn-outline mt-1 px-3 py-1 text-[11px] font-bold uppercase cursor-pointer"
                    >
                      {t.searchBar.clearText}
                    </button>
                  </section>
                ) : (
                  filteredCards.map((entry) => (
                    <BentoCard
                      key={entry.card.id}
                      card={entry.card}
                      displayFields={entry.matchedFields}
                      filteredInfo={
                        entry.isFiltered
                          ? { shown: entry.matchedFields.length, total: entry.totalFieldCount }
                          : undefined
                      }
                      mode={mode}
                      evaluation={evaluation}
                      t={t.cards}
                      onChangeValue={(fid, val) =>
                        setSheet((prev) => updateFieldValue(prev, fid, val))
                      }
                      onAdjustResource={(fid, delta) =>
                        setSheet((prev) => adjustResourceValue(prev, fid, delta))
                      }
                      onAdjustHealthDamage={(fid, dmgType, delta) =>
                        setSheet((prev) => adjustHealthDamage(prev, fid, dmgType, delta))
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
                  ))
                )}
                {(visibleCards.length === 0 || mode === 'edicao') && (
                  <CustomCardBuilder
                    activeTab={activeTab}
                    isEmptySheet={visibleCards.length === 0}
                    t={t.customBuilder}
                    onCreateCard={handleCreateCard}
                  />
                )}
              </div>
            )}
            </div>
          </div>
        </main>

        <RollLogSidebar
          logs={sheet.rollLogs}
          systemId={activeSystemId}
          systemName={sheet.systemName}
          t={t.sidebar}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onQuickRoll={(expr) => appendRollLog(`ROLAGEM · ${expr.toUpperCase()}`, expr)}
          onClearLogs={() => setSheet((prev) => ({ ...prev, rollLogs: [] }))}
        />
      </div>

      <div className="no-print print:hidden relative shrink-0 mobile-bottom-dock bg-[var(--bg-card)] border-t-2 border-[var(--border-ink)] lg:border-t-0 lg:bg-transparent">
        {mobileRollToast && (
          <div
            role="status"
            aria-live="polite"
            data-testid="mobile-roll-toast"
            className="mobile-roll-toast lg:hidden absolute bottom-full mb-2 z-30 flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-card)] border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] shadow-[3px_3px_0_#0B0B0B]"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                data-testid="mobile-roll-toast-total"
                className="font-display text-2xl font-extrabold leading-none text-[var(--ink-primary)] tabular-nums shrink-0"
              >
                {mobileRollToast.total}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)] truncate">
                    {mobileRollToast.label}
                  </span>
                  {(() => {
                    if (mobileRollToast.isPoolRoll) {
                      const outcome =
                        mobileRollToast.outcome ??
                        (mobileRollToast.isFumble
                          ? 'botch'
                          : mobileRollToast.total > 0
                            ? 'success'
                            : 'failure');
                      if (outcome === 'botch') {
                        return (
                          <span
                            data-testid="mobile-roll-toast-status"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[#991B1B] border border-[var(--accent-danger)] rounded-[3px] uppercase shrink-0"
                          >
                            BOTCH!
                          </span>
                        );
                      }
                      if (outcome === 'failure') {
                        return (
                          <span
                            data-testid="mobile-roll-toast-status"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-header-strip)] text-[var(--ink-secondary)] border border-[var(--border-ink)] rounded-[3px] uppercase shrink-0"
                          >
                            FAILURE
                          </span>
                        );
                      }
                      return (
                        <span
                          data-testid="mobile-roll-toast-status"
                          className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px] uppercase shrink-0"
                        >
                          SUCCESS
                        </span>
                      );
                    }
                    if (mobileRollToast.isCritical) {
                      return (
                        <span
                          data-testid="mobile-roll-toast-status"
                          className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px] uppercase shrink-0"
                        >
                          CRÍTICO
                        </span>
                      );
                    }
                    if (mobileRollToast.isFumble) {
                      return (
                        <span
                          data-testid="mobile-roll-toast-status"
                          className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[#991B1B] border border-[var(--accent-danger)] rounded-[3px] uppercase shrink-0"
                        >
                          FALHA 1
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)] truncate">
                  {mobileRollToast.isPoolRoll
                    ? `${mobileRollToast.total} ${
                        mobileRollToast.isSoak ? 'SOAKED' : mobileRollToast.total === 1 ? 'SUC' : 'SUCS'
                      } · ${mobileRollToast.formula}`
                    : mobileRollToast.breakdown}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="mobile-roll-toast-open-log"
                onClick={() => {
                  dismissMobileRollToast();
                  setMobileSidebarOpen(true);
                }}
                className="cyber-btn-outline px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
              >
                LOG
              </button>
              <button
                type="button"
                data-testid="mobile-roll-toast-close"
                aria-label="Fechar aviso de rolagem"
                onClick={dismissMobileRollToast}
                className="cyber-btn-outline w-7 h-7 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 lg:block">
          <div className="flex-1 min-w-0">
            <StatusBar
              mode={mode}
              errorCount={evaluation.formulaErrors.length}
              firstError={evaluation.formulaErrors[0]?.error}
              totalCargoWeight={evaluation.totalCargoWeight}
              availableXp={availableXp}
              rollCount={sheet.rollLogs.length}
              flashMessage={flashMessage}
              roomSyncState={roomSyncState}
              t={t.statusBar}
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
          </div>

          <button
            type="button"
            data-testid="mobile-drawer-fab"
            aria-label={`${t.sidebar.rollLogsTab} / ${t.sidebar.rulesTab}`}
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            className="lg:hidden mobile-drawer-fab cyber-roll-btn px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>LOGS</span>
            <span className="px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] rounded-[3px] tabular-nums leading-none">
              {sheet.rollLogs.length}
            </span>
          </button>
        </div>
      </div>

      <SheetModal
        mode={modalMode}
        sheet={sheet}
        activeSystemId={activeSystemId}
        t={t.modal}
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
          setSearchQuery('');
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
