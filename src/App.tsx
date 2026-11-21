import { Suspense, use, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, X } from 'lucide-react';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustHealthDamage,
  adjustResourceValue,
  adjustSheetBloodPool,
  adjustV20HealthDamage,
  adjustV5HealthDamage,
  AppMode,
  applyRouseCheckHunger,
  applyV5SuperficialHalving,
  applyV5WillpowerSuperficialDamage,
  CharacterSheetState,
  computeWoundPenalty,
  consumeWillpowerForRoll,
  createDefaultSheet,
  createNewSheetForSystem,
  createPresetBySystemId,
  cycleV20HealthCell,
  detectSystemId,
  evaluateSheet,
  FieldKind,
  getSheetBloodPool,
  getSheetVirtues,
  NewSheetIdentityInput,
  nowIsoUtc,
  removeCardFromSheet,
  removeFieldFromCard,
  removeRepeatableRow,
  resolveRulePreset,
  RollLogEntry,
  RulePreset,
  setSheetRulePreset,
  SheetCard,
  SheetField,
  SystemId,
  TabId,
  toggleSheetBloodSurge,
  touchSheetMetadata,
  updateCardSchema,
  updateFieldSchema,
  updateFieldValue,
  updateRepeatableRow,
  updateSheetVirtue,
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
  RoomSyncIndicatorState,
} from './core/roomSync';
import {
  type DiceRollResult,
  executeRouseCheck,
  getV5BloodSurgeBonus,
  isWodPoolExpression,
  rerollV5PoolDice,
  rollDiceExpression,
  WodPoolOptions,
} from './core/formula';
import { isDiceAudioMuted, playDiceClatter, setDiceAudioMuted } from './core/diceAudio';
import {
  AppLanguage,
  getLocalizedSystemOptions,
  getTranslations,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  readStoredLanguage,
} from './core/i18n';
import {
  AUTOSAVE_DEBOUNCE_MS,
  createDebouncedSheetSaver,
  CustomSheetTemplate,
  DebouncedSheetSaver,
  deleteCustomTemplate,
  getDefaultSheetsStore,
  PersistenceSnapshot,
  resolveSheetRecordId,
  saveCustomTemplate,
  SheetsStore,
} from './core/sheetsStore';
import {
  createSuspenseResource,
  HydratedWorkspacePayload,
  hydrateWorkspaceFromStore,
  loadInitialWorkspaceBootstrap,
  SuspenseResource,
  withSafeXpState,
  writeRoomSyncLocalMeta,
} from './core/workspaceHydration';
import { filterCardsByQuery } from './core/sheetSearch';
import { isOfficialVampireSheet } from './core/wodSkillsCatalog';
import { type WodComposedRollRequest } from './utils/wodPoolComposer';
import { TopBar } from './components/TopBar';
import { TabNav } from './components/TabNav';
import { SheetSearchBar } from './components/SheetSearchBar';
import { BentoCard } from './components/BentoCard';
import { BentoGridSkeleton } from './components/BentoGridSkeleton';
import { CustomCardBuilder } from './components/CustomCardBuilder';
import { RollDiceChips, RollLogSidebar } from './components/RollLogSidebar';
import { StatusBar } from './components/StatusBar';
import { SheetModal } from './components/SheetModal';
import { XpUpgradeWorkspace } from './components/XpUpgradeWorkspace';
import { PrintSheetHeader } from './components/PrintSheetHeader';
import { HomeSheetItem, HomeSystemItem, HomeView } from './components/HomeView';
import { RulesSearchPanel } from './components/RulesSearchPanel';
import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  ThemeMode,
} from './utils/theme';
import { useFocusTrap } from './utils/useFocusTrap';
import { printActiveSheetView } from './core/printSheet';
import {
  awardXp,
  buyBackgroundWithXp,
  buyCatalogAdvantageWithXp,
  buyCatalogDisciplineWithXp,
  buyCatalogSkillWithXp,
  buySpecialtyWithXp,
  getAvailableXp,
  getSheetClanName,
  setXpRulePresetConfig,
  undoLastUpgrade,
  upgradeTraitWithXp,
} from './core/xpSystem';

function nowTimeString(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

interface HydratedAppWorkspaceProps {
  hydrationResource: SuspenseResource<HydratedWorkspacePayload>;
  sheetsStore: SheetsStore;
  language: AppLanguage;
  theme: ThemeMode;
  onChangeLanguage: (language: AppLanguage) => void;
  onChangeTheme: (theme: ThemeMode) => void;
}

export default function App() {
  const [language, setLanguage] = useState<AppLanguage>(readStoredLanguage);
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [sheetsStore] = useState<SheetsStore>(() => getDefaultSheetsStore());
  const [hydrationResource] = useState<SuspenseResource<HydratedWorkspacePayload>>(() => {
    const initialLang = readStoredLanguage();
    return createSuspenseResource(
      hydrateWorkspaceFromStore(sheetsStore, loadInitialWorkspaceBootstrap(), {
        idbInitErrorMessage: getTranslations(initialLang).t('app.idbInitFailed'),
      }),
    );
  });

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

  useEffect(() => {
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme]);

  return (
    <Suspense fallback={<BentoGridSkeleton language={language} />}>
      <HydratedAppWorkspace
        hydrationResource={hydrationResource}
        sheetsStore={sheetsStore}
        language={language}
        theme={theme}
        onChangeLanguage={setLanguage}
        onChangeTheme={setTheme}
      />
    </Suspense>
  );
}

function HydratedAppWorkspace({
  hydrationResource,
  sheetsStore,
  language,
  theme,
  onChangeLanguage,
  onChangeTheme,
}: HydratedAppWorkspaceProps) {
  const hydrated = use(hydrationResource.promise);
  const [workspace, setWorkspace] = useState<WorkspaceState>(hydrated.workspace);
  const [activeView, setActiveView] = useState<'home' | 'sheet'>('home');
  const [homeRulesOpen, setHomeRulesOpen] = useState(false);
  const homeRulesDrawerRef = useRef<HTMLElement>(null);
  const homeRulesCloseBtnRef = useRef<HTMLButtonElement>(null);
  const [persistedSheets, setPersistedSheets] = useState<CharacterSheetState[]>(
    hydrated.persistedSheets,
  );
  const [activeTab, setActiveTab] = useState<TabId>('geral');
  const [mode, setMode] = useState<AppMode>('jogo');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalMode, setModalMode] = useState<'new' | 'open' | 'save' | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileSidebarTab, setMobileSidebarTab] = useState<'logs' | 'rules'>('logs');
  const [mobileSidebarTabSeq, setMobileSidebarTabSeq] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(isDiceAudioMuted);
  const [mobileRollToast, setMobileRollToast] = useState<RollLogEntry | null>(null);
  const mobileRollToastTimerRef = useRef<number | null>(null);
  const [rerollArmedLogId, setRerollArmedLogId] = useState<string | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [customTemplates, setCustomTemplates] = useState<CustomSheetTemplate[]>(
    hydrated.customTemplates,
  );
  const [persistenceState, setPersistenceState] = useState<PersistenceSnapshot>(() =>
    hydrated.idbError
      ? {
          status: 'error',
          lastSavedAtMillis: null,
          errorMessage: hydrated.idbError,
          pendingCount: 0,
        }
      : {
          status: 'idle',
          lastSavedAtMillis: null,
          errorMessage: null,
          pendingCount: 0,
        },
  );
  const [roomSyncState, setRoomSyncState] = useState<RoomSyncIndicatorState>(() => ({
    phase: 'synced',
    nextSyncAtMillis: Date.now() + ROOM_PERIODIC_SYNC_INTERVAL_MS,
    lastSyncedAtMillis: hydrated.bootstrap.lastMirroredDigest
      ? hydrated.bootstrap.updatedAtMillis
      : null,
  }));

  const t = useMemo(() => getTranslations(language), [language]);

  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const persistedSheetsRef = useRef<CharacterSheetState[]>(persistedSheets);
  persistedSheetsRef.current = persistedSheets;
  const updatedAtRef = useRef(hydrated.bootstrap.updatedAtMillis);
  const lastMirroredDigestRef = useRef(hydrated.bootstrap.lastMirroredDigest);
  const baseRevisionsRef = useRef<Partial<Record<SystemId, number>>>(
    hydrated.bootstrap.baseRevisions,
  );
  const dirtySystemsRef = useRef<Partial<Record<SystemId, boolean>>>(
    hydrated.bootstrap.dirtySystems,
  );
  const hydratedRemoteRef = useRef(false);
  const hadPersistedLocalRef = useRef(hydrated.hadPersistedLocal);
  const skipNextIdbScheduleRef = useRef(true);
  const sheetsStoreRef = useRef(sheetsStore);
  sheetsStoreRef.current = sheetsStore;
  const debouncedSaverRef = useRef<DebouncedSheetSaver | null>(null);
  const editDebounceTimerRef = useRef<number | null>(null);
  const syncRunIdRef = useRef(0);

  const activeSystemId = workspace.activeSystemId;
  const sheet = useMemo(
    () =>
      workspace.sheetsBySystem[activeSystemId] ?? createPresetBySystemId(activeSystemId),
    [workspace, activeSystemId],
  );
  const rulePreset = useMemo(() => resolveRulePreset(sheet), [sheet]);
  const woundPenalty = useMemo(
    () => computeWoundPenalty(sheet, rulePreset),
    [sheet, rulePreset],
  );
  const bloodPool = useMemo(() => getSheetBloodPool(sheet), [sheet]);
  const virtues = useMemo(() => getSheetVirtues(sheet), [sheet]);
  const sheetClan = useMemo(() => getSheetClanName(sheet), [sheet]);
  const bloodSurge = Boolean(sheet.bloodSurge);
  const lastSoakTotal = useMemo(
    () => sheet.rollLogs.find((l) => l.isSoak)?.total ?? null,
    [sheet.rollLogs],
  );
  const latestEligibleV5Roll = useMemo(
    () =>
      sheet.rollLogs.find(
        (l) =>
          l.isPoolRoll &&
          l.rulePreset === 'vampire-v5' &&
          !l.isRouseCheck &&
          !l.isWillpowerReroll &&
          (l.rolls?.length ?? 0) > (l.hungerDice ?? 0),
      ) ?? null,
    [sheet.rollLogs],
  );

  const refreshPersistedSheets = async () => {
    try {
      const items = await sheetsStoreRef.current.listSheets();
      setPersistedSheets(items);
    } catch {
      // Ignore IndexedDB listing errors
    }
  };

  const flushLocalPersistence = async () => {
    const saver = debouncedSaverRef.current;
    if (!saver) return;
    await saver.flush();
  };

  useEffect(() => {
    const saver = createDebouncedSheetSaver({
      store: sheetsStoreRef.current,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
      onStatusChange: (nextStatus) => {
        setPersistenceState(nextStatus);
      },
    });
    debouncedSaverRef.current = saver;

    const flushBeforeLeaving = () => {
      void saver.flush();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void saver.flush();
      }
    };

    window.addEventListener('beforeunload', flushBeforeLeaving);
    window.addEventListener('pagehide', flushBeforeLeaving);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', flushBeforeLeaving);
      window.removeEventListener('pagehide', flushBeforeLeaving);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      saver.dispose();
      if (debouncedSaverRef.current === saver) {
        debouncedSaverRef.current = null;
      }
    };
  }, []);

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
    if (skipNextIdbScheduleRef.current) {
      skipNextIdbScheduleRef.current = false;
      return;
    }
    const sysId = workspace.activeSystemId;
    const activeSheet =
      workspace.sheetsBySystem[sysId] ?? createPresetBySystemId(sysId);
    debouncedSaverRef.current?.scheduleSave(activeSheet, {
      activeSheetId: resolveSheetRecordId(activeSheet),
      activeSystemId: sysId,
    });
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
        t.t('app.roomConflictFlash', {
          local: outcome.conflict.baseRevision,
          server: outcome.conflict.serverSheet.revision,
        }),
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
        lastError: outcome.error ?? t.t('app.roomSyncFailed'),
        conflict: null,
      }));
    }
  };

  // Reconcile Room mirror asynchronously after Suspense IndexedDB hydration completes
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
        { hadLocalWorkspace: hadPersistedLocalRef.current },
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
  }, []);

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
            lastError: outcome.error ?? t.t('app.roomPeriodicFailed'),
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

  useEffect(() => {
    if (!homeRulesOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setHomeRulesOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [homeRulesOpen]);

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
  const currentWillpower =
    typeof evaluation.variables.willpower === 'number' ? evaluation.variables.willpower : 0;
  const bloodSurgeBonus = useMemo(
    () => getV5BloodSurgeBonus(evaluation.variables.blood_potency),
    [evaluation.variables.blood_potency],
  );

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

  const allAvailableSheets = useMemo(() => {
    const byId = new Map<string, CharacterSheetState>();
    for (const item of persistedSheets) {
      byId.set(resolveSheetRecordId(item), item);
    }
    for (const wsItem of Object.values(workspace.sheetsBySystem)) {
      if (!wsItem) continue;
      byId.set(resolveSheetRecordId(wsItem), wsItem);
    }
    return Array.from(byId.values()).sort((a, b) =>
      String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')),
    );
  }, [persistedSheets, workspace.sheetsBySystem]);

  const homeSheets = useMemo<HomeSheetItem[]>(
    () =>
      allAvailableSheets.map((item) => ({
        id: resolveSheetRecordId(item),
        name: item.characterName?.trim() || t.t('home.unnamedCharacter'),
        systemId: detectSystemId(item),
        updatedAt: item.updatedAt,
      })),
    [allAvailableSheets, t],
  );

  const activeHomeSheet = useMemo<HomeSheetItem | undefined>(() => {
    if (!sheet) return undefined;
    return {
      id: resolveSheetRecordId(sheet),
      name: sheet.characterName?.trim() || t.t('home.unnamedCharacter'),
      systemId: detectSystemId(sheet),
      updatedAt: sheet.updatedAt,
    };
  }, [sheet, t]);

  const homeSystems = useMemo<HomeSystemItem[]>(
    () =>
      getLocalizedSystemOptions(language)
        .filter((opt) => opt.id !== 'blank')
        .map((opt) => ({
          id: opt.id,
          name: opt.shortLabel,
          description: opt.description,
        })),
    [language],
  );

  const showMobileToastWithTimeout = (entry: RollLogEntry) => {
    setMobileRollToast(entry);
    if (mobileRollToastTimerRef.current !== null) {
      window.clearTimeout(mobileRollToastTimerRef.current);
    }
    const timeoutMs =
      entry.rulePreset === 'vampire-v5' && entry.isPoolRoll && !entry.isRouseCheck ? 6500 : 4000;
    mobileRollToastTimerRef.current = window.setTimeout(() => {
      mobileRollToastTimerRef.current = null;
      setMobileRollToast((curr) => (curr?.id === entry.id ? null : curr));
    }, timeoutMs);
  };

  const handleSelectRulePreset = (preset: RulePreset) => {
    setRerollArmedLogId(null);
    setXpRulePresetConfig(sheet, preset);
    setSheet((prev) => setSheetRulePreset(prev, preset));
  };

  const handleRouseCheck = (options?: { label?: string; count?: number }) => {
    const count =
      typeof options?.count === 'number' && Number.isFinite(options.count)
        ? Math.max(1, Math.min(5, Math.round(options.count)))
        : 1;
    const checks = Array.from({ length: count }, () => executeRouseCheck(Math.random));
    const rolls = checks.flatMap((res) => res.rolls);
    const passedCount = checks.filter((res) => (res.hungerDelta ?? 0) === 0).length;
    const totalHungerDelta = checks.reduce((sum, res) => sum + (res.hungerDelta ?? 0), 0);
    const cleanPowerLabel = options?.label?.trim();
    const entryLabel = cleanPowerLabel
      ? `${t.t('cards.powers.rouseLogPrefix')} · ${cleanPowerLabel}`.slice(0, 120)
      : t.t('cards.vital.rouseCheckBtn');
    const formula =
      count === 1
        ? checks[0].resolvedExpression
        : `${count}d10 (ROUSE CHECK ×${count} · DIFF 6)`;
    const breakdown =
      count === 1
        ? checks[0].breakdown
        : `${count}d10[${rolls.join(', ')}] ≥6 → ${passedCount}/${count} OK (+${totalHungerDelta} HUNGER)`;

    const entry: RollLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeString(),
      label: entryLabel,
      total: passedCount,
      formula,
      breakdown,
      rolls,
      difficulty: 6,
      outcome: totalHungerDelta === 0 ? 'success' : 'failure',
      isPoolRoll: true,
      rulePreset: 'vampire-v5',
      isRouseCheck: true,
    };
    playDiceClatter({ diceCount: rolls.length, isCritical: false, isFumble: false });
    showMobileToastWithTimeout(entry);
    setSheet((prev) => {
      const nextWithHunger = applyRouseCheckHunger(prev, totalHungerDelta);
      return {
        ...nextWithHunger,
        rollLogs: [entry, ...nextWithHunger.rollLogs].slice(0, 30),
      };
    });
  };

  const handleSpendPowerBlood = (cost: number, powerName: string) => {
    const spendAmount = Math.max(1, Math.min(10, Math.round(cost)));
    const cleanPower = powerName.trim() || t.t('cards.powers.bloodLogPrefix');
    const { current } = getSheetBloodPool(sheet);
    if (current < spendAmount) {
      triggerFlash(
        t.t('cards.powers.insufficientBloodFlash', {
          power: cleanPower,
          current,
          cost: spendAmount,
        }),
      );
      return;
    }
    const after = Math.max(0, current - spendAmount);
    const formula = t.t('cards.powers.bloodLogFormula', {
      cost: spendAmount,
      before: current,
      after,
    });
    const breakdown = t.t('cards.powers.bloodLogBreakdown', {
      power: cleanPower,
      cost: spendAmount,
      before: current,
      after,
    });
    const entry: RollLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeString(),
      label: `${t.t('cards.powers.bloodLogPrefix')} · ${cleanPower}`.slice(0, 120),
      total: -spendAmount,
      formula: formula.slice(0, 256),
      breakdown: breakdown.slice(0, 512),
      isPoolRoll: false,
      rulePreset: 'storyteller-v20',
    };
    showMobileToastWithTimeout(entry);
    triggerFlash(`${entry.label} (${formula})`);
    setSheet((prev) => {
      const currentPool = getSheetBloodPool(prev).current;
      if (currentPool < spendAmount) return prev;
      const nextWithBlood = adjustSheetBloodPool(prev, -spendAmount);
      return {
        ...nextWithBlood,
        rollLogs: [entry, ...nextWithBlood.rollLogs].slice(0, 30),
      };
    });
  };

  const handleArmWillpowerReroll = (logId: string) => {
    const target = sheet.rollLogs.find(
      (l) =>
        l.id === logId &&
        l.isPoolRoll &&
        l.rulePreset === 'vampire-v5' &&
        !l.isRouseCheck &&
        !l.isWillpowerReroll &&
        (l.rolls?.length ?? 0) > (l.hungerDice ?? 0),
    );
    if (!target || rerollArmedLogId === logId) return;
    if (!rerollArmedLogId) {
      if (currentWillpower <= 0) {
        triggerFlash(t.t('sidebar.roll.noWillpowerLeft'));
        return;
      }
      setSheet((prev) => applyV5WillpowerSuperficialDamage(prev, 1));
    }
    setRerollArmedLogId(logId);
    dismissMobileRollToast();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileSidebarOpen(true);
    }
    triggerFlash(t.t('sidebar.roll.rerollPrompt'));
  };

  const handleTriggerWillpowerSurge = () => {
    if (!latestEligibleV5Roll) return;
    handleArmWillpowerReroll(latestEligibleV5Roll.id);
  };

  const handleConfirmWillpowerReroll = (logId: string, indices: number[]) => {
    const target = sheet.rollLogs.find((l) => l.id === logId);
    if (!target || !target.rolls || target.rolls.length === 0 || indices.length === 0) {
      setRerollArmedLogId(null);
      return;
    }
    const rerolled = rerollV5PoolDice(
      target.rolls,
      target.hungerDice ?? 0,
      indices,
      Math.random,
      {
        difficulty: target.difficulty ?? 2,
        woundPenalty: target.woundPenalty,
        isBloodSurge: target.isBloodSurge,
      },
    );
    const updatedEntry: RollLogEntry = {
      ...target,
      total: rerolled.total,
      formula: rerolled.resolvedExpression,
      breakdown: rerolled.breakdown,
      rolls: rerolled.rolls,
      difficulty: rerolled.difficulty,
      onesCount: rerolled.onesCount,
      outcome: rerolled.outcome,
      status: rerolled.status,
      margin: rerolled.margin,
      isCritical: rerolled.isCritical,
      isFumble: rerolled.isFumble,
      hungerRolls: rerolled.hungerRolls,
      messyCritical: rerolled.messyCritical,
      bestialFailure: rerolled.bestialFailure,
      critPairsCount: rerolled.critPairsCount,
      willpowerUsed: true,
      isWillpowerReroll: true,
      rerolledIndices: rerolled.rerolledIndices,
    };
    playDiceClatter({
      diceCount: rerolled.rerolledIndices?.length || 1,
      isCritical: rerolled.isCritical,
      isFumble: Boolean(rerolled.isFumble || rerolled.bestialFailure),
    });
    showMobileToastWithTimeout(updatedEntry);
    setSheet((prev) => ({
      ...prev,
      rollLogs: prev.rollLogs.map((l) => (l.id === logId ? updatedEntry : l)),
    }));
    setRerollArmedLogId(null);
    triggerFlash(`${t.t('sidebar.roll.wpRerollChip')}: ${rerolled.total}`);
  };

  const buildRollLogEntry = (
    entryLabel: string,
    res: DiceRollResult,
    idPrefix = 'log',
  ): RollLogEntry => ({
    id: `${idPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: nowTimeString(),
    label: entryLabel,
    total: res.total,
    formula: res.resolvedExpression,
    breakdown: res.breakdown,
    rolls: res.rolls,
    difficulty: res.difficulty,
    specialty: res.specialty,
    willpowerUsed: res.willpowerUsed,
    isSoak: res.isSoak,
    soakDamageType: res.soakDamageType,
    onesCount: res.onesCount,
    canceledOnes: res.canceledOnes,
    doubledTensCount: res.doubledTensCount,
    outcome: res.outcome,
    status: res.status,
    margin: res.margin,
    isCritical: res.isCritical,
    isFumble: res.isFumble,
    isPoolRoll: res.isPoolRoll,
    rulePreset: res.rulePreset,
    woundPenalty: res.woundPenalty,
    hungerDice: res.hungerDice,
    hungerRolls: res.hungerRolls,
    messyCritical: res.messyCritical,
    bestialFailure: res.bestialFailure,
    critPairsCount: res.critPairsCount,
    isBloodSurge: res.isBloodSurge,
    isRouseCheck: res.isRouseCheck,
  });

  const appendRollLog = (
    label: string,
    expression: string,
    poolOptions?: WodPoolOptions,
  ) => {
    const isPool = isWodPoolExpression(expression);
    const effectiveRulePreset = poolOptions?.rulePreset ?? rulePreset;
    const isSoak = Boolean(poolOptions?.isSoak);
    const isV5 = effectiveRulePreset === 'vampire-v5';

    const allFields = sheet.cards.flatMap((c) => c.fields);
    const willpowerField = allFields.find((f) => f.id === 'f_willpower' || f.key === 'willpower');
    const wpBoostField = allFields.find((f) => f.id === 'f_wp_boost' || f.key === 'wp_boost');
    const currentWillpower =
      typeof willpowerField?.value === 'number'
        ? willpowerField.value
        : evaluation.variables.willpower ?? 0;
    const wpBlocked = isV5 || (isSoak && poolOptions?.soakDamageType === 'aggravated');
    const wpAutoSuccess =
      isPool && !wpBlocked && Boolean(wpBoostField?.value) && currentWillpower > 0;

    const result = rollDiceExpression(
      expression,
      evaluation.variables,
      Math.random,
      isPool
        ? {
            ...poolOptions,
            rulePreset: effectiveRulePreset,
            woundPenalty: poolOptions?.woundPenalty ?? woundPenalty,
            hungerDice: evaluation.variables.hunger ?? 0,
            bloodSurge: isV5 && !isSoak && Boolean(sheet.bloodSurge),
            bloodSurgeDice: bloodSurgeBonus,
            willpowerAutoSuccess: wpAutoSuccess,
          }
        : undefined,
    );
    if (!result.ok) {
      triggerFlash(t.t('app.rollError', { error: result.error ?? '' }));
      return;
    }

    const entry = buildRollLogEntry(label, result);
    playDiceClatter({
      diceCount: result.rolls.length || 1,
      isCritical: result.isCritical,
      isFumble: Boolean(result.isFumble || result.bestialFailure),
    });
    showMobileToastWithTimeout(entry);
    setSheet((prev) => {
      const updatedSheet = wpAutoSuccess ? consumeWillpowerForRoll(prev) : prev;
      const clearedSurgeSheet =
        result.isBloodSurge && updatedSheet.bloodSurge
          ? { ...updatedSheet, bloodSurge: false }
          : updatedSheet;
      return {
        ...clearedSurgeSheet,
        rollLogs: [entry, ...clearedSurgeSheet.rollLogs].slice(0, 30),
      };
    });
  };

  const handleFieldRoll = (field: SheetField) => {
    const expr = field.rollExpr ?? '2d6';
    const isPool = isWodPoolExpression(expr);
    const isSoak = Boolean(field.isSoak || field.id === 'f_soak' || field.key === 'soak_roll');
    const effectiveFieldDiff =
      rulePreset === 'vampire-v5' && !isSoak
        ? (field.rollDifficultyV5 ?? field.rollDifficulty ?? 2)
        : field.rollDifficulty;
    appendRollLog(
      field.rollLabel ?? field.label,
      expr,
      isPool
        ? {
            difficulty: effectiveFieldDiff,
            specialty: field.rollSpecialty,
            modifier: field.rollMod,
            isSoak,
            soakDamageType: field.soakDamageType ?? 'lethal',
            rulePreset,
            woundPenalty,
          }
        : undefined,
    );
  };

  const handleComposedPoolRoll = (request: WodComposedRollRequest) => {
    if (!isOfficialVampireSheet(activeSystemId, rulePreset)) return;
    const isV5 = request.rulePreset === 'vampire-v5';
    const surgeActive = isV5 && Boolean(request.bloodSurge);
    const wpAutoSuccess = !isV5 && Boolean(request.useWillpower) && currentWillpower > 0;
    const currentHunger = Math.max(0, Math.min(5, Math.round(evaluation.variables.hunger ?? 0)));
    const expression = `pool(${Math.max(0, Math.round(request.basePool))}, ${request.difficulty})`;

    const result = rollDiceExpression(expression, evaluation.variables, Math.random, {
      rulePreset: request.rulePreset,
      difficulty: request.difficulty,
      modifier: request.modifier,
      specialty: !isV5 && request.specialty,
      woundPenalty: request.ignoreWoundPenalty ? 0 : woundPenalty,
      isWoundExempt: request.ignoreWoundPenalty,
      hungerDice: isV5 ? currentHunger : 0,
      bloodSurge: surgeActive,
      bloodSurgeDice: request.bloodSurgeBonus,
      willpowerAutoSuccess: wpAutoSuccess,
    });
    if (!result.ok) {
      triggerFlash(t.t('app.rollError', { error: result.error ?? '' }));
      return;
    }

    const poolEntry = buildRollLogEntry(request.label, result);
    const rouseResult = surgeActive ? executeRouseCheck(Math.random) : null;
    const rouseHungerDelta = rouseResult?.hungerDelta ?? 0;
    const rouseEntry = rouseResult
      ? buildRollLogEntry(
          `${t.t('cards.powers.rouseLogPrefix')} · BLOOD SURGE`,
          rouseResult,
          'log_rouse',
        )
      : null;

    playDiceClatter({
      diceCount: result.rolls.length || 1,
      isCritical: result.isCritical,
      isFumble: Boolean(result.isFumble || result.bestialFailure),
    });
    showMobileToastWithTimeout(poolEntry);

    setSheet((prev) => {
      let nextSheet = prev;
      if (wpAutoSuccess) {
        const wpField = nextSheet.cards
          .flatMap((c) => c.fields)
          .find((f) => f.id === 'f_willpower' || f.key === 'willpower');
        if (wpField && typeof wpField.value === 'number' && wpField.value > 0) {
          nextSheet = adjustResourceValue(nextSheet, wpField.id, -1);
        }
        nextSheet = {
          ...nextSheet,
          cards: nextSheet.cards.map((card) => ({
            ...card,
            fields: card.fields.map((f) =>
              (f.id === 'f_wp_boost' || f.key === 'wp_boost') && f.kind === 'boolean'
                ? { ...f, value: false }
                : f,
            ),
          })),
        };
      }

      if (surgeActive) {
        if (rouseHungerDelta > 0) {
          nextSheet = applyRouseCheckHunger(nextSheet, rouseHungerDelta);
        }
        if (nextSheet.bloodSurge) {
          nextSheet = { ...nextSheet, bloodSurge: false };
        }
      }

      const appendedEntries = rouseEntry ? [poolEntry, rouseEntry] : [poolEntry];
      return {
        ...nextSheet,
        rollLogs: [...appendedEntries, ...nextSheet.rollLogs].slice(0, 30),
      };
    });
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
        label: cleanLabel || t.t('app.fieldDefault.number'),
        kind: 'number',
        value: 0,
      },
      text: {
        id: `f_${uid}`,
        key: derivedKey || `txt_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.text'),
        kind: 'text',
        value: '',
      },
      calculated: {
        id: `f_${uid}`,
        key: derivedKey || `calc_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.calculated'),
        kind: 'calculated',
        formula: '0',
        showPlus: true,
      },
      resource: {
        id: `f_${uid}`,
        key: derivedKey || `res_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.resource'),
        kind: 'resource',
        value: 4,
        max: 6,
      },
      boolean: {
        id: `f_${uid}`,
        key: derivedKey || `flag_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.boolean'),
        kind: 'boolean',
        value: false,
      },
      roll: {
        id: `f_${uid}`,
        key: derivedKey || `roll_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.roll'),
        kind: 'roll',
        rollLabel: cleanLabel || t.t('app.fieldDefault.rollLabel'),
        rollExpr: '2d6',
      },
      repeatable: {
        id: `f_${uid}`,
        key: derivedKey || `list_${shortUid}`,
        label: cleanLabel || t.t('app.fieldDefault.repeatable'),
        kind: 'repeatable',
        columns: [t.t('cards.defaultItemCol'), t.t('cards.defaultValueCol')],
        col2Type: 'text',
        rows: [],
      },
    };
    setSheet((prev) => addFieldToCard(prev, cardId, defaults[kind]));
  };

  const handleCreateCard = (newCard: SheetCard) => {
    setSheet((prev) => addCardToSheet(prev, newCard));
    triggerFlash(t.t('app.cardCreated', { title: newCard.title }));
  };

  const handleNewSheet = () => {
    setMobileSidebarOpen(false);
    setModalMode('new');
  };

  const buildUniqueSheetId = (sysId: SystemId): string =>
    `sheet_${sysId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const handleCreateNewSheet = (
    targetSystemId: SystemId,
    identity?: NewSheetIdentityInput,
  ) => {
    void flushLocalPersistence();
    const existingTarget = workspaceRef.current.sheetsBySystem[targetSystemId];
    const baseRev = baseRevisionsRef.current[targetSystemId] ?? existingTarget?.revision ?? 1;
    baseRevisionsRef.current[targetSystemId] = baseRev;
    dirtySystemsRef.current[targetSystemId] = true;

    const customName = identity?.characterName?.trim() || identity?.name?.trim() || '';
    const baseFresh = createNewSheetForSystem(targetSystemId, {
      ...identity,
      language: identity?.language ?? language,
      localeOptions: {
        newCharacterName: t.modal.newCharacterName,
        customSystemName: t.t('system.blank.systemName'),
        customSystemCode: t.t('system.blank.systemCode'),
      },
    });
    const defaultId = resolveSheetRecordId(baseFresh);
    const hasCollision =
      persistedSheetsRef.current.some((s) => resolveSheetRecordId(s) === defaultId) ||
      Boolean(existingTarget);
    const nextRecordId = hasCollision ? buildUniqueSheetId(targetSystemId) : defaultId;

    if (targetSystemId === 'blank') {
      const blank: CharacterSheetState = {
        ...baseFresh,
        id: nextRecordId,
        characterName: customName ? customName.toUpperCase() : t.modal.newCharacterName,
        revision: baseRev,
      };
      setWorkspace((prevWs) => ({
        activeSystemId: 'blank',
        sheetsBySystem: {
          ...prevWs.sheetsBySystem,
          blank,
        },
      }));
      setPersistedSheets((prev) => [
        blank,
        ...prev.filter((item) => resolveSheetRecordId(item) !== nextRecordId),
      ]);
      void sheetsStoreRef.current.saveSheet(blank).then(() => refreshPersistedSheets());
      setActiveTab('geral');
      setMode('edicao');
      setSearchQuery('');
      setMobileSidebarOpen(false);
      setHomeRulesOpen(false);
      setActiveView('sheet');
      dismissMobileRollToast();
      triggerFlash(t.t('app.blankSheetCreated'));
      return;
    }

    const fresh: CharacterSheetState = {
      ...baseFresh,
      id: nextRecordId,
      characterName: customName ? customName.toUpperCase() : t.modal.newCharacterName,
      revision: baseRev,
    };
    setWorkspace((prevWs) => ({
      activeSystemId: targetSystemId,
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        [targetSystemId]: fresh,
      },
    }));
    setPersistedSheets((prev) => [
      fresh,
      ...prev.filter((item) => resolveSheetRecordId(item) !== nextRecordId),
    ]);
    void sheetsStoreRef.current.saveSheet(fresh).then(() => refreshPersistedSheets());
    setActiveTab('geral');
    setMode('jogo');
    setSearchQuery('');
    setMobileSidebarOpen(false);
    setHomeRulesOpen(false);
    setActiveView('sheet');
    dismissMobileRollToast();
    const sysLabel =
      getLocalizedSystemOptions(language).find((s) => s.id === targetSystemId)?.shortLabel ??
      targetSystemId;
    triggerFlash(t.t('app.newSheetCreated', { system: sysLabel }));
  };

  const handleSelectHomeSheet = async (sheetId: string) => {
    await flushLocalPersistence();
    const localMatch = allAvailableSheets.find(
      (item) => resolveSheetRecordId(item) === sheetId,
    );
    const rawTarget = localMatch ?? (await sheetsStoreRef.current.getSheet(sheetId));
    if (!rawTarget) {
      triggerFlash(t.t('app.sheetNotFound'));
      return;
    }
    const normalized = withSafeXpState({ ...rawTarget, id: sheetId });
    const sysId = detectSystemId(normalized);
    setWorkspace((prevWs) => ({
      activeSystemId: sysId,
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        [sysId]: normalized,
      },
    }));
    await Promise.all([
      sheetsStoreRef.current.setActiveSheetId(sheetId),
      sheetsStoreRef.current.setActiveSystemId(sysId),
    ]);
    setActiveTab('geral');
    setSearchQuery('');
    setMobileSidebarOpen(false);
    setHomeRulesOpen(false);
    setActiveView('sheet');
    if (sysId === 'blank' && normalized.cards.length === 0) {
      setMode('edicao');
    } else {
      setMode('jogo');
    }
    triggerFlash(t.t('app.sheetOpened', { name: normalized.characterName }));
  };

  const handleDuplicateHomeSheet = async (sheetId: string) => {
    await flushLocalPersistence();
    const localMatch = allAvailableSheets.find(
      (item) => resolveSheetRecordId(item) === sheetId,
    );
    const source = localMatch ?? (await sheetsStoreRef.current.getSheet(sheetId));
    if (!source) {
      triggerFlash(t.t('app.sheetNotFound'));
      return;
    }
    const sysId = detectSystemId(source);
    const clonedBase = structuredClone(source);
    const nextId = buildUniqueSheetId(sysId);
    const baseName = source.characterName?.trim() || t.t('app.unnamedPerson');
    const duplicated: CharacterSheetState = {
      ...clonedBase,
      id: nextId,
      systemId: sysId,
      characterName: `${baseName} (${t.t('app.copySuffix')})`,
      revision: 1,
      updatedAt: nowIsoUtc(),
    };
    const saved = await sheetsStoreRef.current.saveSheet(duplicated);
    await refreshPersistedSheets();
    triggerFlash(t.t('app.sheetDuplicated', { name: saved.characterName }));
  };

  const handleDeleteHomeSheet = async (sheetId: string) => {
    debouncedSaverRef.current?.cancelPending(sheetId);
    await sheetsStoreRef.current.deleteSheet(sheetId);
    const remaining = (await sheetsStoreRef.current.listSheets()).filter(
      (item) => resolveSheetRecordId(item) !== sheetId,
    );
    setPersistedSheets(remaining);

    setWorkspace((prevWs) => {
      const nextMap: Partial<Record<SystemId, CharacterSheetState>> = {
        ...prevWs.sheetsBySystem,
      };
      let changed = false;
      for (const [key, value] of Object.entries(nextMap) as Array<
        [SystemId, CharacterSheetState | undefined]
      >) {
        if (!value || resolveSheetRecordId(value) !== sheetId) continue;
        changed = true;
        const replacement = remaining.find((item) => detectSystemId(item) === key);
        if (replacement) {
          nextMap[key] = withSafeXpState(replacement);
        } else {
          delete nextMap[key];
        }
      }
      if (!changed) return prevWs;

      skipNextIdbScheduleRef.current = true;
      let nextActiveSys = prevWs.activeSystemId;
      if (!nextMap[nextActiveSys]) {
        if (remaining[0]) {
          const fallbackSys = detectSystemId(remaining[0]);
          nextMap[fallbackSys] = withSafeXpState(remaining[0]);
          nextActiveSys = fallbackSys;
        } else {
          nextMap.wod = createDefaultSheet();
          nextActiveSys = 'wod';
        }
      }
      return {
        activeSystemId: nextActiveSys,
        sheetsBySystem: nextMap,
      };
    });
    triggerFlash(t.t('app.sheetDeleted'));
  };

  const handleSwitchSystem = (nextSystemId: SystemId) => {
    void flushLocalPersistence();
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
    } else if (activeSystemId === 'blank' && nextSystemId !== 'blank') {
      setMode('jogo');
    }
    const sysLabel =
      getLocalizedSystemOptions(language).find((s) => s.id === nextSystemId)?.shortLabel ??
      nextSystemId;
    triggerFlash(t.t('app.systemSwitched', { system: sysLabel }));
  };

  const handleLoadPreset = (presetId: SystemId) => {
    void flushLocalPersistence();
    const existingTarget = workspaceRef.current.sheetsBySystem[presetId];
    const baseRev = baseRevisionsRef.current[presetId] ?? existingTarget?.revision ?? 1;
    baseRevisionsRef.current[presetId] = baseRev;
    dirtySystemsRef.current[presetId] = true;

    const fresh: CharacterSheetState = {
      ...createPresetBySystemId(presetId),
      revision: baseRev,
    };
    setWorkspace((prevWs) => ({
      activeSystemId: presetId,
      sheetsBySystem: {
        ...prevWs.sheetsBySystem,
        [presetId]: fresh,
      },
    }));
    setActiveTab('geral');
    setSearchQuery('');
    setMobileSidebarOpen(false);
    setHomeRulesOpen(false);
    setActiveView('sheet');
    dismissMobileRollToast();
    if (presetId === 'blank' && fresh.cards.length === 0) {
      setMode('edicao');
    } else {
      setMode('jogo');
    }
    triggerFlash(t.t('app.presetLoaded'));
  };

  const handleAwardXp = (delta: number, reason: string): { ok: boolean; error?: string } => {
    const entryId = `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let outcome: { ok: boolean; error?: string } = { ok: true };
    setSheet((prev) => {
      const res = awardXp(prev, delta, reason, nowTimeString(), entryId, language);
      outcome = { ok: res.ok, error: res.error };
      return res.ok ? res.sheet : prev;
    });
    if (outcome.ok) {
      triggerFlash(
        t.t('app.xpAwarded', { delta: delta > 0 ? `+${delta}` : String(delta) }),
      );
    }
    return outcome;
  };

  const handleUpgradeTrait = (fieldId: string) => {
    const entryId = `xp_upg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let flashText: string | null = null;
    setSheet((prev) => {
      const res = upgradeTraitWithXp(prev, fieldId, nowTimeString(), entryId, language);
      if (!res.ok || !res.trait) {
        flashText = t.t('app.xpError', {
          error: res.error ?? t.t('app.xpUpgradeFailed'),
        });
        return prev;
      }
      flashText = `// XP: ${res.trait.label} ${res.trait.currentValue} → ${res.trait.nextValue} (-${res.trait.cost} XP)`;
      return res.sheet;
    });
    if (flashText) triggerFlash(flashText);
  };

  const handleBuySpecialty = (
    skillFieldId: string,
    focus: string,
  ): { ok: boolean; error?: string } => {
    const entryId = `xp_spec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let result: { ok: boolean; error?: string } = { ok: true };
    setSheet((prev) => {
      const res = buySpecialtyWithXp(prev, skillFieldId, focus, nowTimeString(), entryId, language);
      if (!res.ok) {
        result = { ok: false, error: res.error };
        return prev;
      }
      return res.sheet;
    });
    if (result.ok) {
      triggerFlash(`// XP: SPEC (${focus}) (-3 XP)`);
    }
    return result;
  };

  const handleBuyBackground = (
    label: string,
    customCost?: number,
  ): { ok: boolean; error?: string } => {
    const entryId = `xp_bg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    let result: { ok: boolean; error?: string } = { ok: true };
    setSheet((prev) => {
      const res = buyBackgroundWithXp(prev, label, nowTimeString(), entryId, customCost, language);
      if (!res.ok) {
        result = { ok: false, error: res.error };
        return prev;
      }
      return res.sheet;
    });
    if (result.ok) {
      triggerFlash(`// XP: +${label.toUpperCase()} (-${customCost ?? 3} XP)`);
    }
    return result;
  };

  const runCatalogPurchase = (
    prefix: string,
    executor: (
      prev: CharacterSheetState,
      timestamp: string,
      entryId: string,
    ) => { ok: boolean; sheet: CharacterSheetState; cost?: number; label?: string; error?: string },
  ): { ok: boolean; error?: string } => {
    const entryId = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const res = executor(sheet, nowTimeString(), entryId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    setSheet(() => res.sheet);
    triggerFlash(
      t.t('app.xpAcquired', {
        label: res.label ?? '',
        cost: res.cost ?? 0,
      }),
    );
    return { ok: true };
  };

  const handleBuyCatalogSkill = (skillIdOrVar: string): { ok: boolean; error?: string } =>
    runCatalogPurchase('xp_skill', (prev, ts, id) =>
      buyCatalogSkillWithXp(prev, skillIdOrVar, ts, id, language),
    );

  const handleBuyCatalogDiscipline = (discIdOrName: string): { ok: boolean; error?: string } =>
    runCatalogPurchase('xp_disc', (prev, ts, id) =>
      buyCatalogDisciplineWithXp(prev, discIdOrName, ts, id, language),
    );

  const handleBuyCatalogAdvantage = (
    advIdOrName: string,
    customCost?: number,
  ): { ok: boolean; error?: string } =>
    runCatalogPurchase('xp_adv', (prev, ts, id) =>
      buyCatalogAdvantageWithXp(prev, advIdOrName, ts, id, language, customCost),
    );

  const handleUndoLastUpgrade = () => {
    let flashText: string | null = null;
    setSheet((prev) => {
      const res = undoLastUpgrade(prev, language);
      if (!res.ok) {
        flashText = `// XP: ${res.error ?? t.t('app.xpNothingToUndo')}`;
        return prev;
      }
      flashText = t.t('app.xpReverted', { label: res.revertedLabel ?? '' });
      return res.sheet;
    });
    if (flashText) triggerFlash(flashText);
  };

  const availableXp = useMemo(() => getAvailableXp(sheet.xp), [sheet.xp]);

  const handlePrintPdf = () => {
    void flushLocalPersistence();
    const res = printActiveSheetView(sheet, activeTab, { lang: language });
    if (!res.ok && res.error) {
      triggerFlash(t.t('app.pdfError', { error: res.error }));
    } else {
      triggerFlash(t.t('app.pdfReady', { title: res.documentTitle }));
    }
  };

  useFocusTrap(
    homeRulesOpen,
    homeRulesDrawerRef,
    () => setHomeRulesOpen(false),
    homeRulesCloseBtnRef,
  );

  const openMobileSidebarTab = (tab: 'logs' | 'rules') => {
    setMobileSidebarTab(tab);
    setMobileSidebarTabSeq((n) => n + 1);
    setMobileSidebarOpen(true);
  };

  return (
    <div className="print-shell h-[100dvh] lg:h-screen print:h-auto flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)] overflow-hidden print:overflow-visible">
      <TopBar
        systemCode={sheet.systemCode}
        activeSystemId={activeSystemId}
        mode={mode}
        language={language}
        theme={theme}
        isAudioMuted={isAudioMuted}
        activeView={activeView}
        t={t.topBar}
        onGoHome={() => {
          setMobileSidebarOpen(false);
          setHomeRulesOpen(false);
          setActiveView('home');
        }}
        onChangeSystemCode={(systemCode) => setSheet((prev) => ({ ...prev, systemCode }))}
        onSwitchSystem={handleSwitchSystem}
        onChangeLanguage={onChangeLanguage}
        onChangeTheme={onChangeTheme}
        onToggleAudioMute={handleToggleAudioMute}
        onModeChange={setMode}
        onNewSheet={handleNewSheet}
        onOpenModal={() => setModalMode('open')}
        onSaveModal={() => setModalMode('save')}
        onPrintPdf={handlePrintPdf}
      />

      {activeView === 'home' ? (
        <>
          <main className="print-main cyber-grid-canvas flex-1 p-3 sm:p-6 overflow-y-auto min-h-0">
            <HomeView
              sheets={homeSheets}
              activeSheet={activeHomeSheet}
              systems={homeSystems}
              language={language}
              theme={theme}
              onChangeTheme={onChangeTheme}
              onContinueSheet={() => {
                setHomeRulesOpen(false);
                setActiveView('sheet');
              }}
              onSelectSheet={(id) => void handleSelectHomeSheet(id)}
              onCreateSheet={(systemId, customName, rulePreset, clan) => {
                const validIds: SystemId[] = ['wod', 'dnd5e', 'cyberpunk', 'default', 'blank'];
                const resolvedSys = (
                  validIds.includes(systemId as SystemId) ? systemId : 'blank'
                ) as SystemId;
                const wodEdition =
                  resolvedSys === 'wod' &&
                  (rulePreset === 'vampire-v5' || rulePreset === 'storyteller-v20')
                    ? rulePreset
                    : undefined;
                const identityInput =
                  customName || rulePreset || clan
                    ? {
                        ...(customName ? { characterName: customName } : {}),
                        ...(rulePreset ? { rulePreset } : {}),
                        ...(wodEdition ? { edition: wodEdition } : {}),
                        ...(clan ? { clan, secondaryTrait: clan } : {}),
                      }
                    : undefined;
                handleCreateNewSheet(resolvedSys, identityInput);
              }}
              onDuplicateSheet={(id) => void handleDuplicateHomeSheet(id)}
              onDeleteSheet={(id) => void handleDeleteHomeSheet(id)}
              onOpenImportExport={() => setModalMode('open')}
              onOpenRules={() => setHomeRulesOpen(true)}
            />
          </main>

          {homeRulesOpen && (
            <div
              className="no-print print:hidden fixed inset-0 z-40 flex justify-end bg-[var(--overlay-backdrop)]"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setHomeRulesOpen(false);
                }
              }}
            >
              <aside
                ref={homeRulesDrawerRef}
                role="dialog"
                aria-modal="true"
                aria-label={t.sidebar.rulesTab}
                data-testid="home-rules-drawer"
                className="mobile-drawer-panel overscroll-contain w-[min(94vw,400px)] bg-[var(--bg-card)] border-l-[length:var(--border-width)] border-[var(--border-color)] shadow-[var(--shadow-drawer)] flex flex-col min-h-0"
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-strip)] border-b-[length:var(--border-width)] border-[var(--border-color)] shrink-0">
                  <span className="font-mono-tech text-[11px] font-bold tracking-wider uppercase text-[var(--accent-wine)]">
                    {t.t('sidebar.rulesDrawerTitle')}
                  </span>
                  <button
                    ref={homeRulesCloseBtnRef}
                    type="button"
                    aria-label={t.t('sidebar.closeRulesAria')}
                    onClick={() => setHomeRulesOpen(false)}
                    className="cyber-btn-outline mobile-touch-stepper w-8 h-8 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <RulesSearchPanel
                  systemId={activeSystemId}
                  systemName={sheet.systemName}
                  language={language}
                  t={t.sidebar}
                />
              </aside>
            </div>
          )}
        </>
      ) : (
        <>
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
              rulePreset={rulePreset}
              language={language}
              t={t.tabNav}
              onSelectTab={setActiveTab}
              onSelectRulePreset={handleSelectRulePreset}
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
                language={language}
                t={t.xp}
                onAwardXp={handleAwardXp}
                onUpgradeTrait={handleUpgradeTrait}
                onBuySpecialty={handleBuySpecialty}
                onBuyBackground={handleBuyBackground}
                onBuyCatalogSkill={handleBuyCatalogSkill}
                onBuyCatalogDiscipline={handleBuyCatalogDiscipline}
                onBuyCatalogAdvantage={handleBuyCatalogAdvantage}
                onUndoLastUpgrade={handleUndoLastUpgrade}
                onSelectRulePreset={handleSelectRulePreset}
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
                      systemId={activeSystemId}
                      rulePreset={rulePreset}
                      clan={sheetClan}
                      woundPenalty={woundPenalty}
                      bloodPool={bloodPool}
                      virtues={virtues}
                      bloodSurge={bloodSurge}
                      bloodSurgeBonus={bloodSurgeBonus}
                      lastSoakTotal={lastSoakTotal}
                      canWillpowerSurge={Boolean(latestEligibleV5Roll)}
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
                      onCycleV20HealthCell={(fid, idx) =>
                        setSheet((prev) => cycleV20HealthCell(prev, fid, idx))
                      }
                      onAdjustV20HealthDamage={(fid, dmgType, delta) =>
                        setSheet((prev) => adjustV20HealthDamage(prev, fid, dmgType, delta))
                      }
                      onAdjustV5HealthDamage={(fid, dmgType, delta) =>
                        setSheet((prev) => adjustV5HealthDamage(prev, fid, dmgType, delta))
                      }
                      onApplyV5SuperficialHalving={(fid, rawDmg) =>
                        setSheet((prev) => applyV5SuperficialHalving(prev, fid, rawDmg).sheet)
                      }
                      onAdjustBloodPool={(delta) =>
                        setSheet((prev) => adjustSheetBloodPool(prev, delta))
                      }
                      onSetBloodPool={(nextVal) =>
                        setSheet((prev) => adjustSheetBloodPool(prev, nextVal, true))
                      }
                      onUpdateVirtue={(virtueKey, nextVal) =>
                        setSheet((prev) => updateSheetVirtue(prev, virtueKey, nextVal))
                      }
                      onRouseCheck={handleRouseCheck}
                      onSpendPowerBlood={handleSpendPowerBlood}
                      onToggleBloodSurge={() =>
                        setSheet((prev) => toggleSheetBloodSurge(prev))
                      }
                      onTriggerWillpowerSurge={handleTriggerWillpowerSurge}
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
                        triggerFlash(t.t('app.cardRemoved'));
                      }}
                    />
                  ))
                )}
                {(visibleCards.length === 0 || mode === 'edicao') && (
                  <CustomCardBuilder
                    activeTab={activeTab}
                    isEmptySheet={visibleCards.length === 0}
                    systemId={activeSystemId}
                    rulePreset={rulePreset}
                    existingFieldKeys={Object.keys(evaluation.variables)}
                    availableVariables={evaluation.variables}
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
          sheet={sheet}
          systemId={activeSystemId}
          rulePreset={rulePreset}
          systemName={sheet.systemName}
          language={language}
          woundPenalty={woundPenalty}
          bloodSurge={bloodSurge}
          bloodSurgeBonus={bloodSurgeBonus}
          currentWillpower={currentWillpower}
          currentHunger={Math.max(0, Math.min(5, Math.round(evaluation.variables.hunger ?? 0)))}
          t={t.sidebar}
          rerollArmedLogId={rerollArmedLogId}
          canWillpowerReroll={currentWillpower > 0 || Boolean(rerollArmedLogId)}
          onArmWillpowerReroll={handleArmWillpowerReroll}
          onWillpowerReroll={handleConfirmWillpowerReroll}
          onCancelReroll={() => {
            if (rerollArmedLogId) {
              setSheet((prev) => applyV5WillpowerSuperficialDamage(prev, -1));
            }
            setRerollArmedLogId(null);
            setFlashMessage(null);
          }}
          onRollComposedPool={handleComposedPoolRoll}
          requestedTab={mobileSidebarTab}
          requestedTabSeq={mobileSidebarTabSeq}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onQuickRoll={(expr) =>
            appendRollLog(t.t('app.quickRollLabel', { expr: expr.toUpperCase() }), expr)
          }
          onClearLogs={() => {
            setRerollArmedLogId(null);
            setSheet((prev) => ({ ...prev, rollLogs: [] }));
          }}
        />
      </div>

      <div className="no-print print:hidden relative shrink-0 mobile-bottom-dock bg-[var(--bg-card)] border-t-[length:var(--border-width)] border-[var(--border-color)] lg:border-t-0 lg:bg-transparent">
        {mobileRollToast && (
          <div
            role="status"
            aria-live="polite"
            data-testid="mobile-roll-toast"
            className="mobile-roll-toast lg:hidden absolute bottom-full mb-2 z-30 flex flex-col gap-2 px-3 py-2.5 max-h-[70dvh] overflow-y-auto bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  data-testid="mobile-roll-toast-total"
                  className="font-display text-2xl font-extrabold leading-none text-[var(--ink-primary)] tabular-nums shrink-0"
                >
                  {mobileRollToast.total}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)] truncate">
                      {mobileRollToast.label}
                    </span>
                    {(() => {
                      if (mobileRollToast.isPoolRoll) {
                        const isV5Toast =
                          mobileRollToast.rulePreset === 'vampire-v5' &&
                          !mobileRollToast.isRouseCheck;
                        const v5ToastTarget = Math.max(
                          1,
                          Math.min(10, Math.round(mobileRollToast.difficulty ?? 2)),
                        );
                        const v5ToastSucceeded = mobileRollToast.total >= v5ToastTarget;
                        const v5ToastBestial =
                          isV5Toast &&
                          (Boolean(mobileRollToast.bestialFailure) ||
                            (!v5ToastSucceeded &&
                              (mobileRollToast.hungerRolls ?? []).includes(1) &&
                              (mobileRollToast.rolls?.length ?? 0) > 0));
                        const v5ToastMessy =
                          isV5Toast && Boolean(mobileRollToast.messyCritical) && v5ToastSucceeded;
                        const outcome = isV5Toast
                          ? v5ToastBestial
                            ? 'botch'
                            : v5ToastSucceeded
                              ? 'success'
                              : 'failure'
                          : mobileRollToast.outcome ??
                            (mobileRollToast.isFumble
                              ? 'botch'
                              : mobileRollToast.total > 0
                                ? 'success'
                                : 'failure');
                        if (mobileRollToast.isRouseCheck) {
                          return (
                            <span
                              data-testid="mobile-roll-toast-status"
                              className={`font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 border rounded-[var(--radius-pill)] uppercase shrink-0 ${
                                outcome === 'success'
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                  : 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                              }`}
                            >
                              {outcome === 'success'
                                ? t.t('sidebar.roll.rousePass')
                                : t.t('sidebar.roll.rouseFail')}
                            </span>
                          );
                        }
                        if (v5ToastMessy) {
                          return (
                            <span
                              data-testid="mobile-roll-toast-status"
                              className="v5-status-badge--messy text-[9px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] uppercase tracking-wider shrink-0"
                            >
                              {t.t('sidebar.roll.messyCritical')}
                            </span>
                          );
                        }
                        if (v5ToastBestial) {
                          return (
                            <span
                              data-testid="mobile-roll-toast-status"
                              className="v5-status-badge--bestial text-[9px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] uppercase tracking-wider shrink-0"
                            >
                              {t.t('sidebar.roll.bestialFailure')}
                            </span>
                          );
                        }
                        if (outcome === 'botch') {
                          return (
                            <span
                              data-testid="mobile-roll-toast-status"
                              className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.botch')}
                            </span>
                          );
                        }
                        if (outcome === 'failure') {
                          return (
                            <span
                              data-testid="mobile-roll-toast-status"
                              className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.failure')}
                            </span>
                          );
                        }
                        return (
                          <span
                            data-testid="mobile-roll-toast-status"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                          >
                            {t.t('sidebar.roll.success')}
                          </span>
                        );
                      }
                      if (mobileRollToast.isCritical) {
                        return (
                          <span
                            data-testid="mobile-roll-toast-status"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                          >
                            {t.t('sidebar.roll.critShort')}
                          </span>
                        );
                      }
                      if (mobileRollToast.isFumble) {
                        return (
                          <span
                            data-testid="mobile-roll-toast-status"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase shrink-0"
                          >
                            {t.t('sidebar.roll.fumble1')}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)] truncate">
                    {mobileRollToast.isPoolRoll
                      ? mobileRollToast.rulePreset === 'vampire-v5' && !mobileRollToast.isRouseCheck
                        ? (() => {
                            const v5T = Math.max(
                              1,
                              Math.min(10, Math.round(mobileRollToast.difficulty ?? 2)),
                            );
                            const v5M =
                              typeof mobileRollToast.margin === 'number'
                                ? mobileRollToast.margin
                                : mobileRollToast.total - v5T;
                            const score = t.t('sidebar.roll.v5Score', {
                              total: mobileRollToast.total,
                              target: v5T,
                            });
                            return `${score}${
                              v5M >= 0
                                ? ` · ${t.t('sidebar.roll.margin', { margin: v5M })}`
                                : ` · ${t.t('sidebar.roll.failure')}`
                            } · ${mobileRollToast.rolls?.length ?? 0}d10 (${t.t('cards.pool.diffMeta')} ${v5T})`;
                          })()
                        : `${mobileRollToast.total} ${
                            mobileRollToast.isSoak
                              ? t.t('sidebar.roll.soaked')
                              : mobileRollToast.total === 1
                                ? t.t('sidebar.roll.sucSingular')
                                : t.t('sidebar.roll.sucPlural')
                          } · ${
                            mobileRollToast.rolls && mobileRollToast.rolls.length > 0
                              ? `${mobileRollToast.rolls.length}d10 (${t.t('cards.pool.diffTn')} ${mobileRollToast.difficulty ?? 6})`
                              : mobileRollToast.formula
                          }`
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
                    openMobileSidebarTab('logs');
                  }}
                  className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                >
                  {t.t('statusBar.mobileLogsBtn')}
                </button>
                <button
                  type="button"
                  data-testid="mobile-roll-toast-close"
                  aria-label={t.t('sidebar.closeToastAria')}
                  onClick={dismissMobileRollToast}
                  className="cyber-btn-outline min-h-[36px] min-w-[36px] w-9 h-9 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {mobileRollToast.isPoolRoll &&
              mobileRollToast.rolls &&
              mobileRollToast.rolls.length > 0 && (
                <div className="border-t border-[var(--border-subtle)] pt-1.5">
                  <RollDiceChips
                    entry={mobileRollToast}
                    t={t.sidebar}
                    testIdPrefix="mobile-toast"
                  />
                </div>
              )}

            {mobileRollToast.isPoolRoll &&
              mobileRollToast.rulePreset === 'vampire-v5' &&
              !mobileRollToast.isRouseCheck &&
              !mobileRollToast.isWillpowerReroll &&
              (mobileRollToast.rolls?.length ?? 0) > (mobileRollToast.hungerDice ?? 0) && (
                <button
                  type="button"
                  data-testid="mobile-toast-reroll-wp-btn"
                  disabled={currentWillpower <= 0 && !rerollArmedLogId}
                  title={
                    currentWillpower > 0 || rerollArmedLogId
                      ? t.t('sidebar.roll.rerollWillpower')
                      : t.t('sidebar.roll.noWillpowerLeft')
                  }
                  onClick={() => handleArmWillpowerReroll(mobileRollToast.id)}
                  className="cyber-btn-outline min-h-[36px] w-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {t.t('sidebar.roll.rerollWillpower')}
                </button>
              )}
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
              persistenceState={persistenceState}
              language={language}
              t={t.statusBar}
              onFlushSave={() => {
                void (async () => {
                  await flushLocalPersistence();
                  await debouncedSaverRef.current?.saveNow(sheet, {
                    activeSheetId: resolveSheetRecordId(sheet),
                    activeSystemId,
                  });
                })();
              }}
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

          <div className="lg:hidden flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid="mobile-dock-rules-btn"
              aria-label={t.sidebar.rulesTab}
              aria-expanded={mobileSidebarOpen && mobileSidebarTab === 'rules'}
              onClick={() => {
                if (mobileSidebarOpen && mobileSidebarTab === 'rules') {
                  setMobileSidebarOpen(false);
                } else {
                  openMobileSidebarTab('rules');
                }
              }}
              className="cyber-btn-outline min-h-[44px] px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <span>{t.t('statusBar.mobileRulesBtn')}</span>
            </button>

            <button
              type="button"
              data-testid="mobile-drawer-fab"
              aria-label={`${t.sidebar.rollLogsTab} / ${t.sidebar.rulesTab}`}
              aria-expanded={mobileSidebarOpen && mobileSidebarTab === 'logs'}
              onClick={() => {
                if (mobileSidebarOpen && mobileSidebarTab === 'logs') {
                  setMobileSidebarOpen(false);
                } else {
                  openMobileSidebarTab('logs');
                }
              }}
              className="mobile-drawer-fab cyber-roll-btn min-h-[44px] px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Dices className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{t.t('statusBar.mobileLogsBtn')}</span>
              <span className="px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--accent-contrast)]/45 rounded-[var(--radius-pill)] tabular-nums leading-none">
                {sheet.rollLogs.length}
              </span>
            </button>
          </div>
        </div>
      </div>
        </>
      )}

      <SheetModal
        mode={modalMode}
        sheet={sheet}
        activeSystemId={activeSystemId}
        workspaceSheets={allAvailableSheets}
        customTemplates={customTemplates}
        language={language}
        t={t.modal}
        onClose={() => setModalMode(null)}
        onCreateNewSheet={handleCreateNewSheet}
        onLoadPreset={handleLoadPreset}
        onPrintPdf={handlePrintPdf}
        onFlushSave={flushLocalPersistence}
        onCreateSnapshot={(sheetsToSnap, reason) =>
          sheetsStoreRef.current.createWorkspaceSnapshot(sheetsToSnap, reason)
        }
        onListSnapshots={() => sheetsStoreRef.current.listWorkspaceSnapshots()}
        onImportSheets={async (importedSheets, importMode) => {
          await flushLocalPersistence();
          const nextMap: Partial<Record<SystemId, CharacterSheetState>> = {
            ...workspaceRef.current.sheetsBySystem,
          };
          let lastSystemId: SystemId = workspaceRef.current.activeSystemId;

          for (const rawNext of importedSheets) {
            const normalized = withSafeXpState(rawNext);
            const nextSys = detectSystemId(normalized);
            const baseId = resolveSheetRecordId(normalized);
            const hasExisting = Boolean(nextMap[nextSys]);
            const resolvedId =
              importMode === 'keep' && hasExisting
                ? `${baseId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
                : baseId;
            const sheetToPersist: CharacterSheetState = {
              ...normalized,
              id: resolvedId,
            };
            await sheetsStoreRef.current.saveSheet(sheetToPersist);
            if (importMode === 'overwrite' || !hasExisting) {
              nextMap[nextSys] = sheetToPersist;
            }
            lastSystemId = nextSys;
          }

          setWorkspace({
            activeSystemId: lastSystemId,
            sheetsBySystem: nextMap,
          });
          await refreshPersistedSheets();
          setSearchQuery('');
          setHomeRulesOpen(false);
          setActiveView('sheet');
          triggerFlash(t.t('app.jsonImported'));
        }}
        onRestoreSnapshot={async (snapshotId) => {
          debouncedSaverRef.current?.cancelPending();
          const restored = await sheetsStoreRef.current.restoreWorkspaceSnapshot(snapshotId);
          const restoredMap: Partial<Record<SystemId, CharacterSheetState>> = {};
          for (const item of restored) {
            const normalized = withSafeXpState(item);
            const sysId = detectSystemId(normalized);
            if (!restoredMap[sysId]) {
              restoredMap[sysId] = normalized;
            }
          }
          const nextActiveSys = restoredMap[workspaceRef.current.activeSystemId]
            ? workspaceRef.current.activeSystemId
            : (Object.keys(restoredMap)[0] as SystemId | undefined) ?? 'wod';
          if (!restoredMap[nextActiveSys]) {
            restoredMap[nextActiveSys] = createDefaultSheet();
          }
          setWorkspace({
            activeSystemId: nextActiveSys,
            sheetsBySystem: restoredMap,
          });
          await refreshPersistedSheets();
          setSearchQuery('');
          setHomeRulesOpen(false);
          setActiveView('sheet');
          triggerFlash(t.t('app.snapshotRestored'));
          return restored;
        }}
        onImportJson={(next) => {
          void flushLocalPersistence();
          const normalized = withSafeXpState(next);
          const nextId = detectSystemId(normalized);
          setWorkspace((prevWs) => ({
            activeSystemId: nextId,
            sheetsBySystem: {
              ...prevWs.sheetsBySystem,
              [nextId]: normalized,
            },
          }));
          void sheetsStoreRef.current.saveSheet(normalized).then(() => refreshPersistedSheets());
          setSearchQuery('');
          setHomeRulesOpen(false);
          setActiveView('sheet');
          triggerFlash(t.t('app.jsonImported'));
        }}
        onSaveLocal={async () => {
          try {
            await flushLocalPersistence();
            await debouncedSaverRef.current?.saveNow(sheet, {
              activeSheetId: resolveSheetRecordId(sheet),
              activeSystemId,
            });
            await refreshPersistedSheets();
            triggerFlash(t.t('app.savedLocal'));
          } catch {
            triggerFlash(t.t('app.saveLocalError'));
          }
        }}
        onSaveCustomTemplate={async (templateName) => {
          try {
            await flushLocalPersistence();
            const saved = await saveCustomTemplate({
              name: templateName,
              sheet,
            });
            setCustomTemplates((prev) => [
              saved,
              ...prev.filter((item) => item.id !== saved.id),
            ]);
            triggerFlash(t.t('app.templateSaved', { name: saved.name }));
          } catch {
            triggerFlash(t.t('app.saveTemplateError'));
          }
        }}
        onLoadCustomTemplate={(template) => {
          void flushLocalPersistence();
          const normalized = withSafeXpState(template.sheet);
          const nextSys = detectSystemId(normalized);
          setWorkspace((prevWs) => ({
            activeSystemId: nextSys,
            sheetsBySystem: {
              ...prevWs.sheetsBySystem,
              [nextSys]: normalized,
            },
          }));
          setActiveTab('geral');
          setSearchQuery('');
          setHomeRulesOpen(false);
          setActiveView('sheet');
          triggerFlash(t.t('app.templateLoaded', { name: template.name }));
        }}
        onDeleteCustomTemplate={async (templateId) => {
          await deleteCustomTemplate(templateId);
          setCustomTemplates((prev) => prev.filter((item) => item.id !== templateId));
        }}
      />
    </div>
  );
}
