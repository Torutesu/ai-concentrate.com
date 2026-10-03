"use client";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Plus,
  Plug,
  CalendarDays,
  Check,
  Layers,
} from "lucide-react";
import type { StudioController } from "./use-studio";
import { Workflow } from "./workflow";
import { Action, Panel } from "./ui";

export function Home({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const current =
    s.productions.find((p) => p.id === s.selected?.id) ?? s.productions[0];
  const editable = s.workspace?.role !== "viewer" && !s.busy;
  const open = async (id: string) => {
    if (await s.select(id)) s.setView("content");
  };
  return (
    <div className="home-workspace">
      <div className="home-heading">
        <div>
          <p className="eyebrow">{s.workspace?.name}</p>
          <h1>{en ? "Your work, in focus." : "今日の制作"}</h1>
          <p className="muted">
            {en
              ? "Pick up where you left off."
              : "前回の続きから、進めましょう。"}
          </p>
        </div>
        <Action
          primary
          disabled={!editable}
          onClick={() => s.createProduction()}
        >
          <Plus size={16} />
          {en ? "New idea" : "新しい企画"}
        </Action>
      </div>
      <div
        className="workspace-overview"
        aria-label={en ? "Workspace overview" : "ワークスペースの状況"}
      >
        <div>
          <FileText size={17} />
          <span>{en ? "Ideas" : "企画"}</span>
          <strong>
            {s.productions.length}
            {s.nextCursor ? "+" : ""}
          </strong>
        </div>
        <div>
          <BookOpen size={17} />
          <span>{en ? "Sources" : "製品資料"}</span>
          <strong>{s.sources.length}</strong>
        </div>
        <div>
          <Plug size={17} />
          <span>{en ? "AI connection" : "AI接続"}</span>
          <span className={`status-dot ${s.caps.ai ? "ready" : ""}`} />
          <strong className="status-word">
            {s.caps.ai
              ? en
                ? "Configured"
                : "設定済み"
              : en
                ? "Not configured"
                : "未設定"}
          </strong>
        </div>
      </div>
      <Workflow s={s} expanded />
      <div className="home-columns">
        <div>
          <Panel className="resume-card">
            <div className="section-label">
              <span className="icon-tile">
                <FileText size={18} />
              </span>
              <span>{en ? "Continue working" : "制作を再開"}</span>
              {current && (
                <span className="version-label">v{current.revision}</span>
              )}
            </div>
            {current ? (
              <>
                <h2>{current.title}</h2>
                <p className="muted">
                  {current.itemCount} {en ? "content items" : "件のコンテンツ"}
                </p>
                <div className="resume-footer">
                  <span className="muted">
                    {en ? "Draft workspace" : "企画・原稿・媒体別コンテンツ"}
                  </span>
                  <Action
                    primary
                    disabled={s.busy}
                    onClick={() => open(current.id)}
                  >
                    {s.workspace?.role === "viewer" ? (en ? "View content" : "内容を確認") : (en ? "Open editor" : "編集を続ける")}
                    <ArrowRight size={16} />
                  </Action>
                </div>
              </>
            ) : (
              <>
                <h2>{en ? "Start your first idea" : "最初の企画をつくる"}</h2>
                <p className="muted">
                  {en
                    ? "Add your product sources, then shape an idea."
                    : "製品資料を入れて、最初のアイデアを形に。"}
                </p>
                <div className="actions">
                  <Action
                    primary
                    disabled={!editable}
                    onClick={() => s.createProduction()}
                  >
                    <Plus size={16} />
                    {en ? "Create idea" : "企画を作成"}
                  </Action>
                  <Action
                    disabled={!editable}
                    onClick={() => s.createProduction(true)}
                  >
                    {en ? "Try ShogunAI example" : "ShogunAIのサンプル"}
                  </Action>
                </div>
              </>
            )}
          </Panel>
          <Panel className="recent-panel">
            <div className="section-heading">
              <h2>{en ? "Recent ideas" : "最近の企画"}</h2>
              <button
                className="text-action"
                onClick={() => s.setView("content")}
              >
                {en ? "View all" : "すべて見る"}
                <ArrowRight size={14} />
              </button>
            </div>
            {s.productions.length ? (
              <div className="recent-list">
                {s.productions.slice(0, 5).map((p) => (
                  <button
                    className="recent-row"
                    key={p.id}
                    disabled={s.busy}
                    onClick={() => open(p.id)}
                  >
                    <span className="document-icon">
                      <FileText size={18} />
                    </span>
                    <span className="recent-title">
                      <strong>{p.title}</strong>
                      <small>
                        {p.itemCount} {en ? "items" : "件のコンテンツ"} · v
                        {p.revision}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="quiet-empty">
                <Layers size={24} />
                <span>
                  {en
                    ? "Your ideas will appear here."
                    : "作成した企画がここに並びます。"}
                </span>
              </div>
            )}
          </Panel>
        </div>
        <div className="home-support">
          <Panel className="setup-panel">
            <h2>{en ? "Workspace setup" : "制作環境"}</h2>
            {[
              {
                view: "context" as const,
                icon: BookOpen,
                title: en ? "Product context" : "製品コンテキスト",
                detail: en
                  ? `${s.sources.length} sources saved`
                  : `${s.sources.length}件の資料を保存済み`,
                ready: s.sources.length > 0,
              },
              {
                view: "integrations" as const,
                icon: Plug,
                title: en ? "Integrations" : "インテグレーション",
                detail: s.caps.ai
                  ? en
                    ? "AI configured"
                    : "AIの設定済み"
                  : en
                    ? "Configure AI generation"
                    : "AI生成を接続する",
                ready: !!s.caps.ai,
              },
              {
                view: "calendar" as const,
                icon: CalendarDays,
                title: en ? "Editorial calendar" : "制作カレンダー",
                detail: en ? "Plan publication dates" : "公開予定日を整理",
                ready: false,
              },
            ].map(({ view, icon: Icon, title, detail, ready }) => (
              <button
                key={view}
                className="setup-row"
                onClick={() => s.setView(view)}
              >
                <span className="document-icon">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </span>
                {ready ? (
                  <Check size={16} className="ready-icon" />
                ) : (
                  <ArrowRight size={16} />
                )}
              </button>
            ))}
          </Panel>
          <div className="workspace-note">
            <span className="status-dot ready" />
            {en ? "Private workspace" : "ワークスペース内で共有"}
            <span>
              {en ? "Review before publishing" : "公開前に内容を確認"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
