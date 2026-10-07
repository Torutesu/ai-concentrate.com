"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Change,
  Production,
  ProductionSummary,
  Source,
  SourceSummary,
  VersionedProduction,
  Workspace,
} from "../../lib/domain/models";
import type { WorkspaceSettings } from "../../lib/domain/settings";
import { api, ApiError, json, operation } from "../../lib/studio-client";
import { errorMessage } from "./errors";
import { newProduction, shogunExample } from "../../lib/domain/seed";
import type { Locale, View, Tab } from "./i18n";
/**
 * List entries carry a preview; text is loaded in pages when a source is
 * opened (`nextOffset` is null once the whole body is present).
 */
export type LoadedSource = SourceSummary & {
  body?: string;
  nextOffset?: number | null;
  /** Kinds of secrets/contact data detected on import (redacted before AI use). */
  sensitive?: string[];
};
export type LoadedSettings = { settings: WorkspaceSettings; revision: number };
export function useStudio() {
  const [sourceDrafts, setSourceDrafts] = useState<
    Record<
      string,
      {
        name: string;
        kind: "markdown" | "url" | "repository";
        reference: string;
        body: string;
      }
    >
  >({});
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [productions, setProductions] = useState<ProductionSummary[]>([]),
    [nextCursor, setNextCursor] = useState<string | null>(null),
    [selected, setSelected] = useState<VersionedProduction | undefined>(),
    [sources, setSources] = useState<LoadedSource[]>([]),
    [sourceCursor, setSourceCursor] = useState<string | null>(null),
    [settings, setSettings] = useState<LoadedSettings | null>(null),
    [aiProviders, setAiProviders] = useState<string[]>([]),
    [changes, setChanges] = useState<Change[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [draft, setDraft] = useState<Production | null>(null),
    [locale, setLocale] = useState<Locale>("ja"),
    [view, setView] = useState<View>("home"),
    [tab, setTab] = useState<Tab>("draft"),
    [loadedWorkspaceId, setLoadedWorkspaceId] = useState(""),
    [workspaceFailed, setWorkspaceFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [caps, setCaps] = useState<Record<string, boolean>>({});
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const message = (e: unknown) => errorMessage(e, localeRef.current);
  const dirty = Boolean(
    draft && selected && json(draft) !== json(selected.data),
  );
  const pendingSave = useRef<{ payload: string; key: string } | null>(null),
    inFlight = useRef(false);
  const confirmLeave = () =>
    !dirty ||
    window.confirm(
      locale === "ja"
        ? "未保存の変更があります。破棄して移動しますか？"
        : "Discard unsaved changes?",
    );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    const fn = (e: BeforeUnloadEvent) => {
      if (
        dirty ||
        busy ||
        Object.values(sourceDrafts).some((d) => d.name || d.reference || d.body)
      )
        e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty, busy, sourceDrafts]);
  const init = useCallback(async () => {
    try {
      try {
        const stored = localStorage.getItem("concentrate.locale");
        if (stored === "en" || stored === "ja") setLocale(stored);
      } catch {}
      const [w, c] = await Promise.all([
        api<{ workspaces: Workspace[] }>("/workspaces"),
        api<{ capabilities: Record<string, boolean>; aiProviders?: string[] }>(
          "/capabilities",
        ),
      ]);
      setWorkspaces(w.workspaces);
      setCaps(c.capabilities);
      setAiProviders(c.aiProviders ?? []);
      let remembered = "";
      try {
        remembered = localStorage.getItem("concentrate.workspace") ?? "";
      } catch {}
      setWorkspaceId(
        (id) =>
          [id, remembered].find((candidate) =>
            w.workspaces.some((ws) => ws.id === candidate),
          ) ||
          w.workspaces[0]?.id ||
          "",
      );
      setError("");
    } catch (e) {
      setError(message(e));
    } finally {
      setLoading(false);
    }
  }, []);
  // Bootstrap reads external state; every update in init occurs after the network settles.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void init();
  }, [init]);
  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    Promise.all([
      api<{ items: ProductionSummary[]; nextCursor: string | null }>(
        `/workspaces/${workspaceId}/productions`,
        { signal: controller.signal },
      ),
      operation(
        "context_list",
        { workspaceId, limit: SOURCE_PAGE },
        { signal: controller.signal },
      ),
      api<{ changes: Change[] }>(`/workspaces/${workspaceId}/changes`, {
        signal: controller.signal,
      }),
      operation(
        "workspace_settings_get",
        { workspaceId },
        { signal: controller.signal },
      ),
    ])
      .then(async ([p, s, c, settingsResult]) => {
        const first = p.items[0];
        const detail = first
          ? await api<{ production: VersionedProduction }>(
              `/workspaces/${workspaceId}/productions/${first.id}`,
              { signal: controller.signal },
            )
          : null;
        if (controller.signal.aborted) return;
        setProductions(p.items);
        setNextCursor(p.nextCursor);
        setSources(s.items);
        setSourceCursor(s.nextCursor);
        setSettings({
          settings: settingsResult.settings,
          revision: settingsResult.revision,
        });
        setChanges(c.changes);
        setSelectedId(first?.id ?? "");
        setSelected(detail?.production);
        setDraft(detail?.production.data ?? null);
        setWorkspaceFailed(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(message(e));
          setWorkspaceFailed(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedWorkspaceId(workspaceId);
      });
    return () => controller.abort();
  }, [workspaceId]);
  async function run<T>(fn: () => Promise<T>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function replace(p: VersionedProduction) {
    setProductions((ps) => [
      {
        id: p.id,
        workspaceId: p.workspaceId,
        revision: p.revision,
        updatedAt: p.updatedAt,
        title: p.data.title,
        plannedDate: p.data.plannedDate,
        itemCount: p.data.items.length,
      },
      ...ps.filter((x) => x.id !== p.id),
    ]);
    setSelected(p);
    setSelectedId(p.id);
    setDraft(p.data);
  }
  async function save() {
    if (!draft || !selected) return;
    const payload = json({ data: draft, baseRevision: selected.revision });
    if (pendingSave.current?.payload !== payload)
      pendingSave.current = { payload, key: crypto.randomUUID() };
    const key = pendingSave.current.key;
    return run(async () => {
      const r = await api<{ production: VersionedProduction }>(
        `/workspaces/${workspaceId}/productions/${selectedId}`,
        {
          method: "PUT",
          body: json({ ...JSON.parse(payload), idempotencyKey: key }),
        },
      );
      replace(r.production);
      pendingSave.current = null;
      setNotice(locale === "ja" ? "保存しました" : "Saved");
      return true;
    });
  }
  async function createWorkspace(name: string, decision?: "save" | "discard") {
    if (inFlight.current) return;
    if (dirty && decision === "save" && !(await save())) return;
    if (dirty && !decision && !confirmLeave()) return;
    return run(async () => {
      const r = await api<{ workspace: Workspace }>("/workspaces", {
        method: "POST",
        body: json({ name }),
      });
      setWorkspaces((ws) => [...ws, r.workspace]);
      activateWorkspace(r.workspace.id);
      setView("context");
      return true;
    });
  }
  async function createProduction(example = false, imported?: Production) {
    if (workspace?.role === "viewer" || !confirmLeave()) return;
    return run(async () => {
      const id = crypto.randomUUID(),
        data =
          imported ??
          (example
            ? shogunExample()
            : newProduction(locale === "ja" ? "新しい企画" : "New idea"));
      const r = await api<{ production: VersionedProduction }>(
        `/workspaces/${workspaceId}/productions/${id}`,
        {
          method: "PUT",
          body: json({
            data,
            baseRevision: 0,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      replace(r.production);
      setView("content");
      setTab(example || imported ? "draft" : "plan");
      return true;
    });
  }
  async function select(id: string) {
    if (busy) return;
    if (id === selectedId) return true;
    if (!confirmLeave()) return;
    return run(async () => {
      const r = await api<{ production: VersionedProduction }>(
        `/workspaces/${workspaceId}/productions/${id}`,
      );
      setSelected(r.production);
      setSelectedId(id);
      setDraft(r.production.data);
      return true;
    });
  }
  async function loadMore() {
    if (!nextCursor || busy) return;
    return run(async () => {
      const r = await api<{
        items: ProductionSummary[];
        nextCursor: string | null;
      }>(
        `/workspaces/${workspaceId}/productions?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setProductions((ps) => [
        ...ps,
        ...r.items.filter((x) => !ps.some((p) => p.id === x.id)),
      ]);
      setNextCursor(r.nextCursor);
    });
  }
  function activateWorkspace(id: string) {
    setProductions([]);
    setSelected(undefined);
    setSelectedId("");
    setNextCursor(null);
    setSources([]);
    setSourceCursor(null);
    setSettings(null);
    setChanges([]);
    setDraft(null);
    setError("");
    setNotice("");
    pendingSave.current = null;
    setLoadedWorkspaceId("");
    setWorkspaceFailed(false);
    setWorkspaceId(id);
    try {
      localStorage.setItem("concentrate.workspace", id);
    } catch {}
  }
  async function switchWorkspace(id: string, decision?: "save" | "discard") {
    if (inFlight.current || !workspaces.some((w) => w.id === id)) return;
    if (id === workspaceId) return true;
    if (dirty && decision === "save" && !(await save())) return;
    if (dirty && !decision && !confirmLeave()) return;
    activateWorkspace(id);
    return true;
  }
  function patch(fields: Partial<Production>) {
    if (workspace?.role === "viewer") return;
    setDraft((p) => (p ? { ...p, ...fields } : p));
  }
  async function addSource(
    input: Pick<Source, "name" | "kind" | "reference" | "body">,
  ) {
    return run(async () => {
      const r = await api<{ source: LoadedSource }>(
        `/workspaces/${workspaceId}/sources`,
        { method: "POST", body: json(input) },
      );
      setSources((s) => [
        { ...r.source, body: input.body, nextOffset: null },
        ...s,
      ]);
      setNotice(locale === "ja" ? "資料を保存しました" : "Source saved");
      return r.source;
    });
  }
  /** Loads the next page of a source's text (the first call loads page one). */
  async function loadSource(id: string) {
    const target = sources.find((x) => x.id === id);
    if (!target || !target.truncated || target.nextOffset === null) return;
    if (target.body !== undefined && target.nextOffset === undefined) return;
    try {
      const r = await operation("context_get", {
        workspaceId,
        sourceId: id,
        offset: target.body === undefined ? 0 : (target.nextOffset ?? 0),
      });
      setSources((s) =>
        s.map((x) =>
          x.id === id
            ? {
                ...x,
                body: (r.offset ? (x.body ?? "") : "") + r.text,
                nextOffset: r.nextOffset,
              }
            : x,
        ),
      );
    } catch (e) {
      setError(message(e));
    }
  }
  async function loadMoreSources() {
    if (!sourceCursor || busy) return;
    return run(async () => {
      const r = await operation("context_list", {
        workspaceId,
        limit: SOURCE_PAGE,
        cursor: sourceCursor,
      });
      setSources((s) => [
        ...s,
        ...r.items.filter((x) => !s.some((old) => old.id === x.id)),
      ]);
      setSourceCursor(r.nextCursor);
    });
  }
  async function setSourceAiExcluded(id: string, aiExcluded: boolean) {
    const mark = (value: boolean) =>
      setSources((s) =>
        s.map((x) => (x.id === id ? { ...x, aiExcluded: value } : x)),
      );
    // Optimistic: the switch moves at once and rolls back if the save fails.
    mark(aiExcluded);
    const ok = await run(async () => {
      await operation("context_update", {
        workspaceId,
        sourceId: id,
        aiExcluded,
      });
      setNotice(
        locale === "ja"
          ? aiExcluded
            ? "この資料をAIに送らない設定にしました"
            : "この資料をAIの参照に含めます"
          : aiExcluded
            ? "This source is now excluded from AI requests"
            : "This source is now included in AI requests",
      );
      return true;
    });
    if (!ok) mark(!aiExcluded);
    return ok;
  }
  async function deleteSource(id: string) {
    return run(async () => {
      await operation("context_delete", { workspaceId, sourceId: id });
      setSources((s) => s.filter((x) => x.id !== id));
      setNotice(locale === "ja" ? "資料を削除しました" : "Source deleted");
      return true;
    });
  }
  async function saveSettings(patch: {
    policy?: Partial<WorkspaceSettings["policy"]>;
    profile?: Partial<WorkspaceSettings["profile"]>;
  }) {
    if (!settings) return;
    return run(async () => {
      try {
        const r = await operation("workspace_settings_update", {
          workspaceId,
          baseRevision: settings.revision,
          patch,
        });
        setSettings(r);
        setNotice(locale === "ja" ? "設定を保存しました" : "Settings saved");
        return true;
      } catch (e) {
        // Keep the latest server copy so the next attempt has a fresh revision.
        if (e instanceof ApiError && e.code === "CONFLICT")
          operation("workspace_settings_get", { workspaceId })
            .then((latest) =>
              setSettings({
                settings: latest.settings,
                revision: latest.revision,
              }),
            )
            .catch(() => {});
        throw e;
      }
    });
  }
  async function deleteProduction() {
    if (!selected) return;
    const id = selected.id;
    return run(async () => {
      await operation("production_delete", { workspaceId, productionId: id });
      const rest = productions.filter((p) => p.id !== id);
      setProductions(rest);
      setChanges((cs) => cs.filter((c) => c.productionId !== id));
      pendingSave.current = null;
      const next = rest[0];
      const detail = next
        ? await api<{ production: VersionedProduction }>(
            `/workspaces/${workspaceId}/productions/${next.id}`,
          ).catch(() => null)
        : null;
      setSelected(detail?.production);
      setSelectedId(detail?.production.id ?? "");
      setDraft(detail?.production.data ?? null);
      setNotice(locale === "ja" ? "企画を削除しました" : "Idea deleted");
      return true;
    });
  }
  async function deleteWorkspace() {
    if (!workspace || workspace.role !== "owner") return;
    const id = workspace.id;
    return run(async () => {
      await operation("workspace_delete", { workspaceId: id });
      const rest = workspaces.filter((w) => w.id !== id);
      setWorkspaces(rest);
      activateWorkspace(rest[0]?.id ?? "");
      if (!rest.length) setLoadedWorkspaceId("");
      setView("home");
      setNotice(
        locale === "ja"
          ? "ワークスペースを削除しました。データは30日後に完全に消去されます。"
          : "Workspace deleted. Its data is permanently erased after 30 days.",
      );
      return true;
    });
  }
  async function rejectChange(id: string) {
    return run(async () => {
      await operation("change_reject", { workspaceId, changeId: id });
      setChanges((cs) => cs.filter((c) => c.id !== id));
      setNotice(locale === "ja" ? "変更案を却下しました" : "Proposal rejected");
      return true;
    });
  }
  /** Re-reads open proposals, e.g. after one was decided elsewhere. */
  async function refreshChanges() {
    try {
      const r = await api<{ changes: Change[] }>(
        `/workspaces/${workspaceId}/changes`,
      );
      setChanges(r.changes);
    } catch {}
  }
  async function generate(itemId: string, instruction: string) {
    if (!selected || dirty) return;
    return run(async () => {
      const r = await api<{ change: Change }>(
        `/workspaces/${workspaceId}/generate`,
        {
          method: "POST",
          body: json({
            productionId: selectedId,
            itemId,
            instruction,
            baseRevision: selected.revision,
            idempotencyKey: crypto.randomUUID(),
          }),
        },
      );
      setChanges((cs) => [r.change, ...cs]);
      setTab("review");
    });
  }
  async function apply(id: string) {
    if (dirty) return;
    return run(async () => {
      try {
        const r = await api<{ production: VersionedProduction }>(
          `/workspaces/${workspaceId}/apply`,
          { method: "POST", body: json({ changeId: id }) },
        );
        replace(r.production);
        setChanges((cs) => cs.filter((c) => c.id !== id));
        setNotice(locale === "ja" ? "変更を適用しました" : "Change applied");
      } catch (e) {
        // The proposal may have been decided or gone stale meanwhile.
        void refreshChanges();
        throw e;
      }
    });
  }
  async function restore(revision: number) {
    if (!selected || dirty || busy) return;
    return run(async () => {
      replace(
        await operation("production_restore", {
          workspaceId,
          productionId: selected.id,
          revision,
          baseRevision: selected.revision,
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      setNotice(
        locale === "ja"
          ? "新しい版として復元しました"
          : "Restored as a new revision",
      );
    });
  }
  async function reload() {
    if (!confirmLeave()) return;
    if (!workspaceId) return init();
    return run(async () => {
      const [sourceResult, changeResult, settingsResult] = await Promise.all([
        operation("context_list", { workspaceId, limit: SOURCE_PAGE }),
        api<{ changes: Change[] }>(`/workspaces/${workspaceId}/changes`),
        operation("workspace_settings_get", { workspaceId }),
      ]);
      setSources(sourceResult.items);
      setSourceCursor(sourceResult.nextCursor);
      setChanges(changeResult.changes);
      setSettings({
        settings: settingsResult.settings,
        revision: settingsResult.revision,
      });
      const r = await api<{
        items: ProductionSummary[];
        nextCursor: string | null;
      }>(`/workspaces/${workspaceId}/productions`);
      setProductions(r.items);
      setNextCursor(r.nextCursor);
      const id = r.items.some((p) => p.id === selectedId)
        ? selectedId
        : r.items[0]?.id;
      const detail = id
        ? await api<{ production: VersionedProduction }>(
            `/workspaces/${workspaceId}/productions/${id}`,
          )
        : null;
      setSelected(detail?.production);
      setSelectedId(id ?? "");
      setDraft(detail?.production.data ?? null);
      setWorkspaceFailed(false);
    });
  }
  return {
    workspaces,
    workspaceId,
    workspaceFailed,
    workspace,
    productions,
    nextCursor,
    loadMore,
    sources,
    sourceDraft: sourceDrafts[workspaceId] ?? {
      name: "",
      kind: "markdown" as const,
      reference: "",
      body: "",
    },
    updateSourceDraft: (
      fields: Partial<{
        name: string;
        kind: "markdown" | "url" | "repository";
        reference: string;
        body: string;
      }>,
    ) =>
      setSourceDrafts((ds) => ({
        ...ds,
        [workspaceId]: {
          ...(ds[workspaceId] ?? {
            name: "",
            kind: "markdown" as const,
            reference: "",
            body: "",
          }),
          ...fields,
        },
      })),
    loadSource,
    sourceCursor,
    loadMoreSources,
    setSourceAiExcluded,
    deleteSource,
    settings,
    saveSettings,
    aiProviders,
    deleteProduction,
    deleteWorkspace,
    rejectChange,
    refreshChanges,
    changes,
    selected,
    draft,
    locale,
    setLocale: (value: Locale) => {
      if (value === locale) return;
      setLocale(value);
      setNotice("");
      try {
        localStorage.setItem("concentrate.locale", value);
      } catch {}
    },
    view,
    setView,
    tab,
    setTab,
    loading:
      loading || Boolean(workspaceId && loadedWorkspaceId !== workspaceId),
    busy,
    error,
    notice,
    caps,
    dirty,
    init,
    save,
    createWorkspace,
    createProduction,
    select,
    switchWorkspace,
    patch,
    addSource,
    generate,
    apply,
    reload,
    restore,
    setError,
    setNotice,
  };
}
const SOURCE_PAGE = 50;
export type StudioController = ReturnType<typeof useStudio>;
