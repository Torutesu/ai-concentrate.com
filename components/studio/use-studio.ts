"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  Change,
  Production,
  Source,
  VersionedProduction,
  Workspace,
} from "../../lib/domain/models";
import { api, json, ApiError } from "../../lib/studio-client";
import { newProduction, shogunExample } from "../../lib/domain/seed";
import type { Locale, View, Tab } from "./i18n";
export function useStudio() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]),
    [workspaceId, setWorkspaceId] = useState(""),
    [productions, setProductions] = useState<VersionedProduction[]>([]),
    [sources, setSources] = useState<Source[]>([]),
    [changes, setChanges] = useState<Change[]>([]),
    [selectedId, setSelectedId] = useState(""),
    [draft, setDraft] = useState<Production | null>(null),
    [locale, setLocale] = useState<Locale>("ja"),
    [view, setView] = useState<View>("home"),
    [tab, setTab] = useState<Tab>("draft"),
    [loadedWorkspaceId, setLoadedWorkspaceId] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [caps, setCaps] = useState<Record<string, boolean>>({});
  const selected = productions.find((p) => p.id === selectedId),
    workspace = workspaces.find((w) => w.id === workspaceId);
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
      if (dirty || busy) e.preventDefault();
    };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [dirty, busy]);
  const init = useCallback(async () => {
    try {
      const [w, c] = await Promise.all([
        api<{ workspaces: Workspace[] }>("/workspaces"),
        api<{ capabilities: Record<string, boolean> }>("/capabilities"),
      ]);
      setWorkspaces(w.workspaces);
      setCaps(c.capabilities);
      setWorkspaceId((id) => id || w.workspaces[0]?.id || "");
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
      api<{ productions: VersionedProduction[] }>(
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
      .then(([p, s, c]) => {
        setProductions(p.productions);
        setSources(s.sources);
        setChanges(c.changes);
        setSelectedId(p.productions[0]?.id ?? "");
        setDraft(p.productions[0]?.data ?? null);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e));
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
    setProductions((ps) => [p, ...ps.filter((x) => x.id !== p.id)]);
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
    });
  }
  async function createWorkspace(name: string) {
    if (!confirmLeave()) return;
    return run(async () => {
      const r = await api<{ workspace: Workspace }>("/workspaces", {
        method: "POST",
        body: json({ name }),
      });
      setWorkspaces((ws) => [...ws, r.workspace]);
      setWorkspaceId(r.workspace.id);
      setView("context");
    });
  }
  async function createProduction(example = false) {
    if (!confirmLeave()) return;
    return run(async () => {
      const id = crypto.randomUUID(),
        data = example
          ? shogunExample()
          : newProduction(locale === "ja" ? "新しい企画" : "New idea");
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
      setTab("draft");
    });
  }
  function select(id: string) {
    if (busy || !confirmLeave()) return;
    const p = productions.find((x) => x.id === id);
    if (p) {
      setSelectedId(id);
      setDraft(p.data);
    }
  }
  function switchWorkspace(id: string) {
    if (busy || !confirmLeave()) return;
    setProductions([]);
    setSources([]);
    setChanges([]);
    setDraft(null);
    setWorkspaceId(id);
  }
  function patch(fields: Partial<Production>) {
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
  async function reload() {
    if (!confirmLeave()) return;
    return run(async () => {
      const r = await api<{ productions: VersionedProduction[] }>(
        `/workspaces/${workspaceId}/productions`,
      );
      setProductions(r.productions);
      const p =
        r.productions.find((x) => x.id === selectedId) ?? r.productions[0];
      setSelectedId(p?.id ?? "");
      setDraft(p?.data ?? null);
    });
  }
  return {
    workspaces,
    workspaceId,
    workspace,
    productions,
    sources,
    changes,
    selected,
    draft,
    locale,
    setLocale,
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
