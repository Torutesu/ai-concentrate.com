"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Change,
  Production,
  ProductionSummary,
  Source,
  VersionedProduction,
  Workspace,
} from "../../lib/domain/models";
import { api, json, ApiError } from "../../lib/studio-client";
import { newProduction, shogunExample } from "../../lib/domain/seed";
import type { Locale, View, Tab } from "./i18n";
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
    [sources, setSources] = useState<Source[]>([]),
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
  const dirty = Boolean(
    draft && selected && json(draft) !== json(selected.data),
  );
  const pendingSave = useRef<{ payload: string; key: string } | null>(null),
    operation = useRef(false);
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
        api<{ capabilities: Record<string, boolean> }>("/capabilities"),
      ]);
      setWorkspaces(w.workspaces);
      setCaps(c.capabilities);
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
      api<{ sources: Source[] }>(`/workspaces/${workspaceId}/sources`, {
        signal: controller.signal,
      }),
      api<{ changes: Change[] }>(`/workspaces/${workspaceId}/changes`, {
        signal: controller.signal,
      }),
    ])
      .then(async ([p, s, c]) => {
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
        setSources(s.sources);
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
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      return await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      operation.current = false;
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
    if (operation.current) return;
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
    if (operation.current || !workspaces.some((w) => w.id === id)) return;
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
      const r = await api<{ source: Source }>(
        `/workspaces/${workspaceId}/sources`,
        { method: "POST", body: json(input) },
      );
      setSources((s) => [r.source, ...s]);
      setNotice(locale === "ja" ? "情報を保存しました" : "Source saved");
      return r.source;
    });
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
      const r = await api<{ production: VersionedProduction }>(
        `/workspaces/${workspaceId}/apply`,
        { method: "POST", body: json({ changeId: id }) },
      );
      replace(r.production);
      setNotice(locale === "ja" ? "変更を適用しました" : "Change applied");
    });
  }
  async function restore(revision: number) {
    if (!selected || dirty || busy) return;
    return run(async () => {
      const r = await api<{ data: VersionedProduction }>("/operations", {
        method: "POST",
        body: json({
          name: "production_restore",
          arguments: {
            workspaceId,
            productionId: selected.id,
            revision,
            baseRevision: selected.revision,
            idempotencyKey: crypto.randomUUID(),
          },
        }),
      });
      replace(r.data);
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
      const [sourceResult, changeResult] = await Promise.all([
        api<{ sources: Source[] }>(`/workspaces/${workspaceId}/sources`),
        api<{ changes: Change[] }>(`/workspaces/${workspaceId}/changes`),
      ]);
      setSources(sourceResult.sources);
      setChanges(changeResult.changes);
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
          name: "",
          kind: "markdown",
          reference: "",
          body: "",
          ...ds[workspaceId],
          ...fields,
        },
      })),
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
  };
}
function message(e: unknown) {
  if (e instanceof ApiError) {
    const messages: Record<string, string> = {
      CONFLICT:
        "別の更新が保存されています。編集内容を退避してから再読み込みしてください。 / Revision conflict.",
      LOCKED:
        "この項目はロックされています。解除して保存してから編集してください。",
      UNAUTHENTICATED: "再ログインしてください。 / Sign in again.",
      AI_NOT_CONFIGURED:
        "AI生成はサーバー設定待ちです。手動編集と保存は利用できます。",
      VALIDATION: "入力の長さ・URL・日付を確認してください。",
      PROVIDER_ERROR:
        "AI生成を完了できませんでした。元の内容は保持されています。",
    };
    return messages[e.code] ?? e.message;
  }
  return e instanceof Error ? e.message : "操作を完了できませんでした。";
}
export type StudioController = ReturnType<typeof useStudio>;
