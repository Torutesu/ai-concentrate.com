"use client";
import { useState } from "react";
import {
  CalendarDays,
  ChartNoAxesCombined,
  FileText,
  House,
  Layers,
  Plug,
  Settings,
  Target,
  Waypoints,
  BookOpen,
} from "lucide-react";
import { useStudio } from "./use-studio";
import { labels, type View } from "./i18n";
import { Action, Panel, Badge } from "./ui";
import { Editor } from "./editor";
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
        <label className="workspace-picker">
          <span>{t.workspace}</span>
          <select
            disabled={s.busy}
            value={s.workspaceId}
            onChange={(e) => s.switchWorkspace(e.target.value)}
          >
            <option value="" disabled>
              {en ? "Select workspace" : "選択してください"}
            </option>
            {s.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <nav aria-label={en ? "Main navigation" : "メインナビゲーション"}>
          {nav.map(([v, Icon]) => (
            <button
              key={v}
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
          <select
            aria-label="Language / 言語"
            value={s.locale}
            onChange={(e) => s.setLocale(e.target.value as "ja" | "en")}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
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
          <Badge>{s.dirty ? t.unsaved : t.saved}</Badge>
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
        {s.busy && (
          <div role="status" className="progress-message">
            <span className="spinner" />
            {en
              ? "Processing. Your content stays here."
              : "処理中です。編集内容は保持されています。"}
          </div>
        )}
        {s.loading ? (
          <div role="status" className="loading-state">
            <span className="spinner" />
            {en ? "Loading workspace…" : "ワークスペースを読み込み中…"}
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
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
            <div className="page-heading">
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
              <>
                <div className="home-intro">
                  <div>
                    <Badge>
                      {en ? "Your workspace" : "制作ワークスペース"}
                    </Badge>
                    <h2>
                      {en
                        ? "Turn the next idea into a draft."
                        : "次の企画を、形に。"}
                    </h2>
                    <p className="muted">
                      {s.productions.length} {en ? "ideas" : "件の企画"} ·{" "}
                      {s.sources.length} {en ? "sources" : "件の資料"}
                    </p>
                  </div>
                  <Action
                    primary
                    disabled={s.busy || s.workspace?.role === "viewer"}
                    onClick={() => s.createProduction()}
                  >
                    {t.new}
                  </Action>
                </div>
                <div className="two-col">
                  <Panel>
                    <div className="identity">
                      <h2>{en ? "Continue working" : "制作を続ける"}</h2>
                      <Action onClick={() => s.setView("content")}>
                        {en ? "View all" : "一覧を見る"}
                      </Action>
                    </div>
                    {s.productions.length ? (
                      s.productions.slice(0, 5).map((p) => (
                        <button
                          className="list-item"
                          key={p.id}
                          onClick={() => {
                            s.select(p.id);
                            s.setView("content");
                          }}
                        >
                          <strong>{p.data.title}</strong>
                          <small>
                            v{p.revision} · {p.data.items.length}{" "}
                            {en ? "items" : "項目"}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div className="empty-inner">
                        <Layers size={32} />
                        <p>
                          {en
                            ? "Start with an idea or explore the example."
                            : "企画を作るか、サンプルから試せます。"}
                        </p>
                        <Action
                          onClick={() => s.createProduction(true)}
                          disabled={s.busy || s.workspace?.role === "viewer"}
                        >
                          ShogunAI {en ? "example" : "サンプル"}
                        </Action>
                      </div>
                    )}
                  </Panel>
                  <Panel>
                    <h2>{en ? "Workspace setup" : "制作の準備"}</h2>
                    <button
                      className="list-item"
                      onClick={() => s.setView("context")}
                    >
                      <strong>{t.context}</strong>
                      <small>
                        {s.sources.length}{" "}
                        {en ? "sources saved" : "件の資料を保存済み"} →
                      </small>
                    </button>
                    <button
                      className="list-item"
                      onClick={() => s.setView("integrations")}
                    >
                      <strong>{t.integrations}</strong>
                      <small>
                        {s.caps.ai
                          ? en
                            ? "AI configured"
                            : "AI設定済み"
                          : en
                            ? "AI configuration pending"
                            : "AI設定待ち"}{" "}
                        →
                      </small>
                    </button>
                    <button
                      className="list-item"
                      onClick={() => s.setView("calendar")}
                    >
                      <strong>{t.calendar}</strong>
                      <small>
                        {en
                          ? "Plan publication dates"
                          : "制作物の公開予定を整理"}{" "}
                        →
                      </small>
                    </button>
                  </Panel>
                </div>
              </>
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
              <Panel>
                <h2>{en ? "AI changes" : "AIの変更案"}</h2>
                <p className="muted">
                  {en
                    ? "Generated revisions require review before they change your content."
                    : "生成結果は確認後に適用します。原稿を自動で上書きしません。"}
                </p>
                <Badge>
                  {s.changes.length} {en ? "proposals" : "件の変更案"}
                </Badge>
                <Action
                  onClick={() => {
                    s.setView("content");
                    s.setTab("review");
                  }}
                >
                  {en ? "Review proposals" : "変更案を確認"}
                </Action>
              </Panel>
            )}
          </>
        )}
      </main>
    </div>
  );
}
