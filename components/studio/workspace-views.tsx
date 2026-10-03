"use client";
import { useState } from "react";
import { NoIdea } from "./workflow";
import {
  ArrowRight,
  FileText,
  Plug,
  BookOpen,
  BarChart3,
  Video,
  Terminal,
} from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";
import type { StudioController } from "./use-studio";
import { labels } from "./i18n";
import { Action, Badge, Field, Panel } from "./ui";
export function Context({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    { name, kind, reference, body } = s.sourceDraft;
  const [fileError, setFileError] = useState("");
  const setName = (name: string) => s.updateSourceDraft({ name }),
    setKind = (kind: "markdown" | "url" | "repository") =>
      s.updateSourceDraft({ kind }),
    setReference = (reference: string) => s.updateSourceDraft({ reference }),
    setBody = (body: string) => s.updateSourceDraft({ body });
  async function read(file?: File) {
    if (!file) return;
    if (file.size > 180000) {
      setFileError(en ? "File is too large." : "ファイルが大きすぎます。");
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setFileError(
        en
          ? "Could not read this file. Try another file."
          : "読み込めませんでした。別のファイルを選んでください。",
      );
      return;
    }
    if (text.length > 60000) {
      setFileError(
        en ? "Maximum 60,000 characters." : "60,000文字以内にしてください。",
      );
      return;
    }
    setBody(text);
    setName(file.name);
    setFileError("");
  }
  return (
    <div className="split">
      <Panel>
        <h2>{en ? "Add source" : "資料を追加"}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const result = await s.addSource({ name, kind, reference, body });
            if (result) {
              setName("");
              setReference("");
              setBody("");
            }
          }}
        >
          <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
            <label className="field">
              <span>{en ? "Source type" : "資料の種類"}</span>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="markdown">Markdown / Text</option>
                <option value="url">URL</option>
                <option value="repository">Repository</option>
              </select>
            </label>
            <Field
              label={en ? "Name" : "資料名"}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {kind !== "markdown" && (
              <>
                <Field
                  label={en ? "Reference URL" : "参照URL"}
                  type="url"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
                <p className="muted">
                  {en
                    ? "Automatic fetching is not connected. Paste the relevant content below."
                    : "自動取得は未接続です。参照する本文を下に貼り付けてください。"}
                </p>
              </>
            )}
            {kind === "markdown" && (
              <label className="file-input">
                {en ? "Read a Markdown file" : "MDファイルを読み込む"}
                <input
                  type="file"
                  accept=".md,.markdown,.txt,text/plain,text/markdown"
                  onChange={(e) => void read(e.target.files?.[0])}
                />
              </label>
            )}
            <Field
              label={en ? "Source text" : "参照する本文"}
              multiline
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <small className="muted">
              {body.length.toLocaleString()} / 60,000
            </small>
            {fileError && <p role="alert">{fileError}</p>}
            <Action
              primary
              disabled={!name.trim() || !body.trim() || body.length > 60000}
            >
              {en ? "Save source" : "資料を保存"}
            </Action>
          </fieldset>
        </form>
      </Panel>
      <Panel>
        <div className="section-heading">
          <h2>{en ? "Workspace sources" : "登録済みの資料"}</h2>
          {s.sources.length > 0 && (
            <Action
              disabled={s.busy || (!s.draft && s.workspace?.role === "viewer")}
              onClick={async () => {
                if (s.draft || (await s.createProduction()))
                  s.setView("strategy");
              }}
            >
              {en ? "Continue to brief" : "企画へ進む"}
              <ArrowRight size={14} />
            </Action>
          )}
        </div>
        {s.sources.length ? (
          s.sources.map((source) => (
            <details
              key={source.id}
              className="source-detail"
              onToggle={(e) => {
                if (e.currentTarget.open) void s.loadSource(source.id);
              }}
            >
              <summary>
                {source.name} <Badge>{source.kind}</Badge>
              </summary>
              <p className="muted">{source.reference}</p>
              <pre>{source.body ?? source.preview}</pre>
              <small>
                {new Date(source.createdAt).toLocaleString(s.locale)}
              </small>
            </details>
          ))
        ) : (
          <p className="muted">
            {en
              ? "Add product facts and brand guidelines here."
              : "製品情報やブランドの方針を追加してください。"}
          </p>
        )}
      </Panel>
    </div>
  );
}
export function Strategy({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    p = s.draft;
  if (!p) return <NoIdea s={s} />;
  return (
    <>
      <IdeaPicker s={s} />
      <fieldset
        disabled={s.busy || s.workspace?.role === "viewer"}
        className="two-col"
      >
        <Panel>
          <Field
            label={en ? "Idea title" : "企画名"}
            value={p.title}
            onChange={(e) => s.patch({ title: e.target.value })}
          />
          <Field
            label={en ? "Audience" : "届ける相手"}
            value={p.persona}
            onChange={(e) => s.patch({ persona: e.target.value })}
          />
          <Field
            label={en ? "Problem" : "解決したい課題"}
            multiline
            value={p.problem}
            onChange={(e) => s.patch({ problem: e.target.value })}
          />
          <Field
            label={en ? "Core message" : "伝える主張"}
            multiline
            value={p.claim}
            onChange={(e) => s.patch({ claim: e.target.value })}
          />
        </Panel>
        <Panel>
          <Field
            label={en ? "Hypothesis" : "検証する仮説"}
            multiline
            value={p.hypothesis}
            onChange={(e) => s.patch({ hypothesis: e.target.value })}
          />
          <Field
            label="CTA"
            value={p.cta}
            onChange={(e) => s.patch({ cta: e.target.value })}
          />
          <Field
            label={en ? "Destination URL" : "遷移先URL"}
            value={p.destination}
            onChange={(e) => s.patch({ destination: e.target.value })}
          />
          <Field
            label={en ? "Success metric" : "評価指標"}
            value={p.metric}
            onChange={(e) => s.patch({ metric: e.target.value })}
          />
          <Field
            label={en ? "Review date" : "評価日"}
            type="date"
            value={p.evaluationDate}
            onChange={(e) => s.patch({ evaluationDate: e.target.value })}
          />
          <Action
            onClick={() => {
              s.setView("content");
              s.setTab("draft");
            }}
          >
            {en ? "Edit content" : "原稿を編集"}
          </Action>
        </Panel>
      </fieldset>
    </>
  );
}
export function Analytics({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    p = s.draft;
  return (
    <>
      <Panel>
        <div className="section-heading">
          <h2>{en ? "Experiment notes" : "成果の振り返り"}</h2>
          <Badge>{en ? "Manual entry" : "手動記録"}</Badge>
        </div>
        <p className="muted">
          {en
            ? "Record the actual result, what you learned and the next experiment. Automatic analytics import is not connected."
            : "実測値・分かったこと・次に変えることを企画に残します。実績の自動取得は未接続です。"}
        </p>
      </Panel>
      {!p && <NoIdea s={s} />}
      {p && (
        <>
          <IdeaPicker s={s} />
          <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
            <Panel>
              <Field
                label={en ? "Metric" : "評価指標"}
                value={p.metric}
                placeholder={
                  en
                    ? "e.g. 10 activated users from this campaign"
                    : "例：この施策から初回の価値体験に到達した人数"
                }
                onChange={(e) => s.patch({ metric: e.target.value })}
              />
              <Field
                label={en ? "Review date" : "評価日"}
                type="date"
                value={p.evaluationDate}
                onChange={(e) => s.patch({ evaluationDate: e.target.value })}
              />
              <Field
                label={en ? "Findings and next decision" : "検証結果・次の判断"}
                placeholder={
                  en
                    ? "Actual result and period:\nEvidence / source URL:\nWhat we learned:\nNext: continue, change or stop"
                    : "実測値・集計期間：\n根拠・参照URL：\n分かったこと：\n次の判断：継続・変更・停止"
                }
                multiline
                value={p.decision}
                onChange={(e) => s.patch({ decision: e.target.value })}
              />
            </Panel>
          </fieldset>
        </>
      )}
    </>
  );
}
export function Calendar({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [day, setDay] = useState(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
  const year = month.getFullYear(),
    m = month.getMonth(),
    offset = (month.getDay() + 6) % 7,
    last = new Date(year, m + 1, 0).getDate();
  return (
    <>
      <div className="identity">
        <div className="actions">
          <Action
            aria-label={en ? "Previous month" : "前月"}
            onClick={() => setMonth(new Date(year, m - 1, 1))}
          >
            ←
          </Action>
          <Action
            onClick={() => {
              const d = new Date();
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
              setDay(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
              );
            }}
          >
            {en ? "Today" : "今日"}
          </Action>
          <h2>
            {month.toLocaleDateString(s.locale, {
              year: "numeric",
              month: "long",
            })}
          </h2>
          <Action
            aria-label={en ? "Next month" : "翌月"}
            onClick={() => setMonth(new Date(year, m + 1, 1))}
          >
            →
          </Action>
        </div>
        <Badge>
          {en
            ? "Planning only · publishing disconnected"
            : "公開予定 · 自動投稿は未接続"}
        </Badge>
      </div>
      <Panel>
        <div
          className="calendar-grid"
          role="group"
          aria-label={en ? "Monthly calendar" : "月間カレンダー"}
        >
          {(en
            ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
            : ["月", "火", "水", "木", "金", "土", "日"]
          ).map((d) => (
            <strong className="weekday" key={d}>
              {d}
            </strong>
          ))}
          {Array.from(
            { length: Math.ceil((offset + last) / 7) * 7 },
            (_, i) => {
              const n = i - offset + 1,
                date = `${year}-${String(m + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
              return n < 1 || n > last ? (
                <div className="calendar-cell outside" key={i} />
              ) : (
                <div
                  className={`calendar-cell ${day === date ? "selected" : ""}`}
                  key={i}
                >
                  <button
                    className="day-number"
                    aria-label={date}
                    aria-pressed={day === date}
                    onClick={() => setDay(date)}
                  >
                    {n}
                  </button>
                  {s.productions
                    .filter(
                      (p) =>
                        (p.id === s.selected?.id
                          ? s.draft?.plannedDate
                          : p.plannedDate) === date,
                    )
                    .map((p) => (
                      <button
                        className="calendar-event"
                        key={p.id}
                        onClick={() => {
                          setDay(date);
                          s.select(p.id);
                        }}
                      >
                        {p.title}
                      </button>
                    ))}
                </div>
              );
            },
          )}
        </div>
      </Panel>
      {s.nextCursor && (
        <Action disabled={s.busy} onClick={s.loadMore}>
          {en
            ? "Load more ideas into calendar"
            : "カレンダーに表示する企画をさらに読み込む"}
        </Action>
      )}
      <Panel>
        <h2>{day || (en ? "Plan a publication date" : "公開予定を決める")}</h2>
        {!s.draft ? <NoIdea s={s} /> : <IdeaPicker s={s} />}
        {s.draft && (
          <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
            <Field
              label={en ? "Planned date" : "公開予定日"}
              type="date"
              value={s.draft.plannedDate}
              onChange={(e) => s.patch({ plannedDate: e.target.value })}
            />
            {day && (
              <Action
                disabled={s.draft.plannedDate === day}
                onClick={() => s.patch({ plannedDate: day })}
              >
                {en ? "Use selected date" : "選択した日付を使う"}
              </Action>
            )}
          </fieldset>
        )}
      </Panel>
    </>
  );
}
export function Integrations({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const entries = [
    {
      name: en ? "AI writing" : "AIライティング",
      icon: Plug,
      state: s.caps.ai
        ? en
          ? "Configured"
          : "設定済み"
        : en
          ? "Setup required"
          : "設定が必要",
      description: s.caps.ai
        ? en
          ? "Generate proposals using saved sources. Review before applying."
          : "保存済み資料から変更案を生成し、確認して適用します。"
        : en
          ? "An administrator needs to configure the AI provider. Manual editing is available."
          : "AIの利用には管理者による接続設定が必要です。手動編集は利用できます。",
      view: "content" as const,
      tab: "draft" as const,
      action: en ? "Open editor" : "原稿を開く",
    },
    {
      name: en ? "Product sources" : "製品資料",
      icon: BookOpen,
      state: en ? "Manual import" : "手動取り込み",
      description: en
        ? "Import Markdown or paste text with a URL / repository reference. Automatic sync is not available."
        : "Markdownの読み込み、URL・リポジトリと本文の保存に対応。自動同期は未接続です。",
      view: "context" as const,
      action: en ? "Add sources" : "資料を追加",
    },
    {
      name: "X / Reddit / YouTube",
      icon: FileText,
      state: en ? "Publishing unavailable" : "自動投稿は未接続",
      description: en
        ? "Prepare channel-specific copy and export Markdown. Publish from each platform."
        : "媒体別の原稿を編集し、Markdownで書き出せます。投稿は各プラットフォームで行います。",
      view: "content" as const,
      tab: "x" as const,
      action: en ? "Prepare content" : "媒体別の原稿へ",
    },
    {
      name: en ? "Video production" : "動画制作",
      icon: Video,
      state: en ? "Script editing" : "台本編集に対応",
      description: en
        ? "Plan scenes and narration. Recording, voice generation and rendering are not connected."
        : "シーンとナレーションを編集できます。収録・音声生成・動画書き出しは未接続です。",
      view: "content" as const,
      tab: "video" as const,
      action: en ? "Edit script" : "台本を編集",
    },
    {
      name: en ? "Measurement" : "効果測定",
      icon: BarChart3,
      state: en ? "Manual entry" : "手動記録",
      description: en
        ? "Record observed results and the next experiment. Automatic performance import is not connected."
        : "実測値と次の施策を記録できます。実績の自動取得は未接続です。",
      view: "analytics" as const,
      action: en ? "Record results" : "結果を記録",
    },
    {
      name: "MCP / CLI",
      icon: Terminal,
      state: s.caps.mcp
        ? en
          ? "Available"
          : "利用可能"
        : en
          ? "Not connected"
          : "未接続",
      description: en
        ? "Agent access uses authenticated operations. Setup details are available to the workspace administrator."
        : "認証済みの操作をエージェントから利用します。接続手順は管理者向けガイドを確認してください。",
    },
  ];
  return (
    <div className="integration-grid">
      {entries.map(
        ({ name, icon: Icon, state, description, view, tab, action }) => (
          <Panel key={name}>
            <div className="section-heading">
              <span className="icon-tile">
                <Icon size={20} />
              </span>
              <Badge>{state}</Badge>
            </div>
            <h2>{name}</h2>
            <p className="muted">{description}</p>
            {view && (
              <Action
                onClick={() => {
                  s.setView(view);
                  if (tab) s.setTab(tab);
                }}
              >
                {action}
                <ArrowRight size={14} />
              </Action>
            )}
            {name === "AIライティング" || name === "AI writing"
              ? !s.caps.ai &&
                s.workspace?.role === "owner" && (
                  <details className="setup-details">
                    <summary>
                      {en ? "Administrator setup" : "管理者向け設定"}
                    </summary>
                    <p>
                      {en
                        ? "Configure OPENAI_API_KEY and OPENAI_MODEL in the hosting environment, then redeploy. Never paste keys into product sources."
                        : "ホスティング環境でOPENAI_API_KEYとOPENAI_MODELを設定して再デプロイしてください。キーは製品資料に貼り付けないでください。"}
                    </p>
                  </details>
                )
              : null}
            {name === "MCP / CLI" && (
              <details className="setup-details">
                <summary>{en ? "Connection details" : "接続情報"}</summary>
                <p>
                  {en
                    ? "The MCP endpoint is /mcp on this deployment. Use your host’s supported authentication; an endpoint alone does not grant access."
                    : "接続先はこのデプロイ先の /mcp です。ホストが対応する認証を使用してください。URLだけではアクセス権は付与されません。"}
                </p>
              </details>
            )}
          </Panel>
        ),
      )}
    </div>
  );
}
export function SettingsView({
  s,
  user,
}: {
  s: StudioController;
  user: { name: string; email: string };
}) {
  const en = s.locale === "en",
    [name, setName] = useState("");
  return (
    <div className="two-col">
      <Panel>
        <h2>{en ? "Account" : "アカウント"}</h2>
        <p>{user.name}</p>
        <p className="muted">{user.email}</p>
        <Badge>{en ? "Signed in" : "ログイン済み"}</Badge>
        <LanguageSwitcher
          locale={s.locale}
          onChange={s.setLocale}
          variant="settings"
        />
        <p className="muted">
          {en
            ? "Team invites and billing are not enabled in this private version."
            : "この非公開版では、チーム招待と課金は未接続です。"}
        </p>
      </Panel>
      <Panel>
        <h2>{en ? "New workspace" : "ワークスペースを追加"}</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await s.createWorkspace(name);
          }}
        >
          <Field
            label={en ? "Product or brand name" : "製品・ブランド名"}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Action primary disabled={s.busy || !name.trim()}>
            {labels[s.locale].create}
          </Action>
        </form>
        <p className="muted">
          {en
            ? "Sources and drafts are isolated per workspace."
            : "資料と原稿はワークスペースごとに分離されます。"}
        </p>
      </Panel>
    </div>
  );
}
function IdeaPicker({ s }: { s: StudioController }) {
  return (
    <label className="field idea-picker">
      <span>{s.locale === "en" ? "Idea" : "企画"}</span>
      <select
        value={s.selected?.id ?? ""}
        disabled={s.busy}
        onChange={(e) => s.select(e.target.value)}
      >
        {s.productions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
