"use client";
import { AgentReview } from "./agent-review";
import { useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  House,
  Plug,
  Settings,
  Target,
  Waypoints,
  BookOpen,
} from "lucide-react";
import { useStudio } from "./use-studio";
import { labels, type View } from "./i18n";
import { Action, Panel } from "./ui";
import { Editor } from "./editor";
import { Workflow } from "./workflow";
import { Home } from "./home";
import { LanguageSwitcher } from "./language-switcher";
import { WorkspaceSwitcher } from "./workspace-switcher";
import {
  Context,
  Strategy,
  Calendar,
  Integrations,
  SettingsView,
  Analytics,
} from "./workspace-views";
const nav = [
  ["home", House],
  ["strategy", Target],
  ["content", FileText],
  ["agents", Waypoints],
  ["calendar", CalendarDays],
  ["analytics", ChartNoAxesCombined],
  ["context", BookOpen],
  ["integrations", Plug],
  ["settings", Settings],
] as const;
export function Studio({ user }: { user: { name: string; email: string } }) {
  const s = useStudio(),
    t = labels[s.locale],
    en = s.locale === "en",
    [name, setName] = useState("");
  return (
    <div className="studio-shell">
      <a className="skip-link" href="#workspace-main">
        {en ? "Skip to content" : "本文へ"}
      </a>
      <aside className="sidebar">
        <div className="brand">
          <img src="/design-assets/flask.svg" alt="" />
          Concentrate
        </div>
        <WorkspaceSwitcher s={s} />
        <nav aria-label={en ? "Main navigation" : "メインナビゲーション"}>
          {nav.map(([v, Icon], index) => (
            <button
              key={v}
              className={index === 6 ? "nav-workspace-start" : undefined}
              onClick={() => s.setView(v as View)}
              aria-current={s.view === v ? "page" : undefined}
            >
              <Icon size={18} />
              {t[v]}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{s.workspace?.role ?? "—"}</small>
          </div>
          <LanguageSwitcher locale={s.locale} onChange={s.setLocale} />
        </div>
      </aside>
      <main
        id="workspace-main"
        className="workspace-main"
        aria-busy={s.loading || s.busy}
      >
        <div className="topline">
          <span>
            {s.workspace?.name ?? "AI Concentrate"}{" "}
            <span className="separator">/</span> {t[s.view]}
          </span>
          <span className={`save-status ${s.dirty ? "is-dirty" : ""}`}>
            <span className="status-dot" />
            {s.workspace?.role === "viewer" && (
              <div className="notice" role="status">
                {en
                  ? "View-only access · an owner or editor can make changes."
                  : "閲覧のみ・変更はオーナーまたは編集者が行えます。"}
              </div>
            )}
            {!s.loading &&
              !s.workspaceFailed &&
              s.workspaceId &&
              !["home", "settings", "integrations"].includes(s.view) && (
                <Workflow s={s} />
              )}
            {s.loading
              ? en
                ? "Loading…"
                : "読み込み中…"
              : s.workspaceFailed
                ? en
                  ? "Load failed"
                  : "読み込み失敗"
                : s.busy
                  ? en
                    ? "Processing…"
                    : "処理中…"
                  : (s.dirty || (s.view === "context" && Boolean(s.sourceDraft.name || s.sourceDraft.reference || s.sourceDraft.body)))
                    ? t.unsaved
                    : t.saved}
          </span>
        </div>
        {s.error && (
          <div className="alert" role="alert">
            <span>{s.error}</span>
            <Action onClick={s.workspaceId ? s.reload : s.init}>
              {t.reload}
            </Action>
          </div>
        )}
        {s.notice && (
          <div className="notice" role="status">
            {s.notice}
          </div>
        )}
        {s.nextCursor && !s.loading && (
          <div className="notice" role="status">
            {en
              ? `${s.productions.length} ideas loaded. Older ideas and their calendar events are not shown yet.`
              : `${s.productions.length}件を読み込み済み。以前の企画とそのカレンダー予定は未表示です。`}{" "}
            <Action disabled={s.busy} onClick={s.loadMore}>
              {en ? "Load more" : "さらに読み込む"}
            </Action>
          </div>
        )}
        {s.busy && (
          <div role="status" className="progress-message">
            <span className="spinner" />
            {en
              ? "Processing. Your content stays here."
              : "処理中です。編集内容は保持されています。"}
          </div>
        )}
        {s.workspace?.role === "viewer" && (
          <div className="notice" role="status">
            {en
              ? "View-only access · an owner or editor can make changes."
              : "閲覧のみ・変更はオーナーまたは編集者が行えます。"}
          </div>
        )}
        {!s.loading &&
          !s.workspaceFailed &&
          s.workspaceId &&
          !["home", "settings", "integrations"].includes(s.view) && (
            <Workflow s={s} />
          )}
        {s.loading ? (
          <div role="status" className="loading-state">
            <span className="spinner" />
            {en ? "Loading workspace…" : "ワークスペースを読み込み中…"}
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : s.workspaceFailed ? (
          <Panel>
            <h1>
              {en
                ? "Workspace could not be loaded"
                : "ワークスペースを読み込めませんでした"}
            </h1>
            <p className="muted">
              {en
                ? "Retry or select another workspace. Your saved work has not been deleted."
                : "再試行するか、別のワークスペースを選んでください。保存済みのデータは削除されていません。"}
            </p>
            <Action primary disabled={s.busy} onClick={s.reload}>
              {en ? "Retry" : "再試行"}
            </Action>
          </Panel>
        ) : !s.workspaceId ? (
          <Panel>
            <h1>{en ? "Create your workspace" : "ワークスペースを作成"}</h1>
            <p className="muted">
              {en
                ? "Keep product sources, ideas and drafts together."
                : "製品ごとに、資料・企画・原稿をまとめます。"}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void s.createWorkspace(name);
              }}
            >
              <label className="field">
                <span>{en ? "Product or brand name" : "製品・ブランド名"}</span>
                <input
                  maxLength={100}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ShogunAI"
                />
              </label>
              <Action primary disabled={s.busy || !name.trim()}>
                {t.create}
              </Action>
            </form>
          </Panel>
        ) : s.view === "content" ? (
          <Editor s={s} />
        ) : (
          <>
            <div
              className={`page-heading ${s.view === "home" ? "home-page-heading" : ""}`}
            >
              <h1>{t[s.view]}</h1>
              {["strategy", "analytics", "calendar"].includes(s.view) && (
                <Action
                  primary
                  disabled={
                    !s.dirty || s.busy || s.workspace?.role === "viewer"
                  }
                  onClick={s.save}
                >
                  {t.save}
                </Action>
              )}
            </div>
            {s.view === "home" ? (
              <Home s={s} />
            ) : s.view === "context" ? (
              <Context s={s} />
            ) : s.view === "strategy" ? (
              <Strategy s={s} />
            ) : s.view === "calendar" ? (
              <Calendar s={s} />
            ) : s.view === "integrations" ? (
              <Integrations s={s} />
            ) : s.view === "settings" ? (
              <SettingsView s={s} user={user} />
            ) : s.view === "analytics" ? (
              <Analytics s={s} />
            ) : (
              <AgentReview s={s} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
