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
  Search,
  Trash2,
} from "lucide-react";
import { operation } from "../../lib/studio-client";
import { errorMessage } from "./errors";
import { WorkspaceSettingsPanels } from "./settings";
import { LanguageSwitcher } from "./language-switcher";
import type { LoadedSource, StudioController } from "./use-studio";
import { labels } from "./i18n";
import { Action, Badge, ConfirmDialog, Field, Panel } from "./ui";
export function Context({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    { name, kind, reference, body } = s.sourceDraft;
  const [fileError, setFileError] = useState(""),
    [sensitive, setSensitive] = useState<string[]>([]);
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
              setSensitive(result.sensitive ?? []);
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
            {sensitive.length > 0 && (
              <div className="inline-warning" role="alert">
                <strong>
                  {en
                    ? "The saved source contains sensitive data"
                    : "保存した資料に機微な情報が含まれています"}
                </strong>
                <p>
                  {en
                    ? `Detected: ${sensitive.map((k) => SENSITIVE_LABELS[k]?.[1] ?? k).join(", ")}. These are masked before any AI request, but they are stored as written. Delete the source and re-add it without them if they should not be stored.`
                    : `検出：${sensitive.map((k) => SENSITIVE_LABELS[k]?.[0] ?? k).join("、")}。AIに送る前に自動で伏せますが、資料には入力どおり保存されています。保存すべきでない場合は、資料を削除し、除いてから追加し直してください。`}
                </p>
                <button
                  type="button"
                  className="text-action"
                  onClick={() => setSensitive([])}
                >
                  {en ? "Dismiss" : "閉じる"}
                </button>
              </div>
            )}
            <Action
              primary
              disabled={!name.trim() || !body.trim() || body.length > 60000}
            >
              {en ? "Save source" : "資料を保存"}
            </Action>
          </fieldset>
        </form>
      </Panel>
      <SourceLibrary s={s} />
    </div>
  );
}
const SENSITIVE_LABELS: Record<string, [string, string]> = {
  api_key: ["APIキー", "API keys"],
  token: ["認証トークン", "access tokens"],
  private_key: ["秘密鍵", "private keys"],
  email: ["メールアドレス", "email addresses"],
  phone: ["電話番号", "phone numbers"],
};
function SourceLibrary({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    canEdit = s.workspace?.role !== "viewer",
    [pendingDelete, setPendingDelete] = useState<LoadedSource | null>(null),
    excludedAll = s.settings?.settings.policy.sendSources === "none";
  return (
    <Panel>
      <div className="section-heading">
        <h2>{en ? "Workspace sources" : "登録済みの資料"}</h2>
        {s.sources.length > 0 && (
          <Action
            disabled={s.busy || (!s.draft && !canEdit)}
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
      {excludedAll && (
        <p className="inline-note" role="status">
          {en
            ? "Workspace policy: sources are never sent to AI. "
            : "ワークスペースのポリシーにより、資料はAIに送られません。"}
          <button
            type="button"
            className="text-action"
            onClick={() => s.setView("settings")}
          >
            {en ? "Change in Settings" : "設定で変更"}
          </button>
        </p>
      )}
      {s.sources.length > 0 && <SourceSearch s={s} />}
      {s.sources.length ? (
        <>
          {s.sources.map((source) => (
            <details
              key={source.id}
              className="source-detail"
              onToggle={(e) => {
                if (e.currentTarget.open && source.body === undefined)
                  void s.loadSource(source.id);
              }}
            >
              <summary>
                <span className="source-name">{source.name}</span>
                <Badge>{source.kind}</Badge>
                {source.aiExcluded && (
                  <Badge>{en ? "Not sent to AI" : "AIに送らない"}</Badge>
                )}
                <small className="source-meta">
                  {source.chars.toLocaleString(s.locale)}
                  {en ? " chars" : "文字"}
                </small>
              </summary>
              {source.reference && (
                <p className="muted source-reference">{source.reference}</p>
              )}
              <pre>{source.body ?? source.preview}</pre>
              {source.truncated && source.body === undefined ? (
                <p className="muted" role="status">
                  {en ? "Loading the full text…" : "全文を読み込み中…"}
                </p>
              ) : (
                source.nextOffset != null && (
                  <Action
                    disabled={s.busy}
                    onClick={() => void s.loadSource(source.id)}
                  >
                    {en ? "Show more" : "続きを表示"}
                  </Action>
                )
              )}
              <div className="source-actions">
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    disabled={!canEdit || s.busy}
                    checked={!source.aiExcluded}
                    onChange={(e) =>
                      void s.setSourceAiExcluded(source.id, !e.target.checked)
                    }
                  />
                  {en ? "Use as AI reference" : "AIの参照に使う"}
                </label>
                <small className="muted">
                  {new Date(source.createdAt).toLocaleString(s.locale)}
                </small>
                {canEdit && (
                  <Action
                    className="danger subtle"
                    disabled={s.busy}
                    onClick={() => setPendingDelete(source)}
                  >
                    <Trash2 size={14} />
                    {en ? "Delete" : "削除"}
                  </Action>
                )}
              </div>
            </details>
          ))}
          {s.sourceCursor && (
            <Action disabled={s.busy} onClick={() => void s.loadMoreSources()}>
              {en ? "Load more sources" : "さらに資料を読み込む"}
            </Action>
          )}
        </>
      ) : (
        <p className="muted">
          {en
            ? "Add product facts and brand guidelines here."
            : "製品情報やブランドの方針を追加してください。"}
        </p>
      )}
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        busy={s.busy}
        title={
          en
            ? `Delete “${pendingDelete?.name}”?`
            : `「${pendingDelete?.name}」を削除しますか？`
        }
        description={
          <p>
            {en
              ? "The text and its search index are removed permanently. Existing drafts and proposals are not changed."
              : "本文と検索用の索引を完全に削除します。作成済みの原稿や変更案は変わりません。"}
          </p>
        }
        confirmLabel={en ? "Delete source" : "削除する"}
        cancelLabel={en ? "Cancel" : "キャンセル"}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete && (await s.deleteSource(pendingDelete.id)))
            setPendingDelete(null);
        }}
      />
    </Panel>
  );
}
function SourceSearch({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    [query, setQuery] = useState(""),
    [state, setState] = useState<
      | { kind: "idle" }
      | { kind: "loading" }
      | { kind: "error"; message: string }
      | {
          kind: "done";
          query: string;
          results: { sourceId: string; chunk: number; excerpt: string }[];
        }
    >({ kind: "idle" });
  const valid = query.trim().length >= 3;
  async function search() {
    if (!valid) return;
    setState({ kind: "loading" });
    try {
      const r = await operation("context_search", {
        workspaceId: s.workspaceId,
        query: query.trim(),
        limit: 5,
      });
      setState({ kind: "done", query: query.trim(), results: r.results });
    } catch (e) {
      setState({ kind: "error", message: errorMessage(e, s.locale) });
    }
  }
  return (
    <div className="source-search">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="sr-only" htmlFor="source-search-input">
          {en ? "Search passages in sources" : "資料の中を検索"}
        </label>
        <Search size={15} aria-hidden="true" />
        <input
          id="source-search-input"
          type="search"
          value={query}
          maxLength={200}
          placeholder={
            en
              ? "Find a passage (3+ characters)"
              : "資料の中を検索（3文字以上）"
          }
          onChange={(e) => setQuery(e.target.value)}
        />
        <Action disabled={!valid || state.kind === "loading"}>
          {en ? "Search" : "検索"}
        </Action>
      </form>
      {state.kind === "loading" && (
        <p className="muted" role="status">
          {en ? "Searching…" : "検索中…"}
        </p>
      )}
      {state.kind === "error" && <p role="alert">{state.message}</p>}
      {state.kind === "done" && (
        <div role="status" aria-live="polite">
          {state.results.length ? (
            <ol className="passage-list">
              {state.results.map((r) => (
                <li key={`${r.sourceId}#${r.chunk}`}>
                  <strong>
                    {s.sources.find((x) => x.id === r.sourceId)?.name ??
                      (en ? "Source" : "資料")}
                  </strong>
                  <p>{highlight(r.excerpt, state.query)}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">
              {en
                ? `No passage contains “${state.query}”.`
                : `「${state.query}」を含む箇所はありません。`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function highlight(text: string, query: string) {
  const at = text.indexOf(query);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {text.slice(at + query.length)}
    </>
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
      <div className="calendar-workbench">
        <Panel className="calendar-month">
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
        <Panel className="calendar-plan">
          <h2>
            {day || (en ? "Plan a publication date" : "公開予定を決める")}
          </h2>
          {!s.draft ? <NoIdea s={s} /> : <IdeaPicker s={s} />}
          {s.draft && (
            <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
              <Field
                label={en ? "Planned date" : "公開予定日"}
                type="date"
                value={s.draft.plannedDate}
                onChange={(e) => s.patch({ plannedDate: e.target.value })}
              />
              <Field
                label={en ? "Destination URL" : "誘導先URL"}
                type="url"
                value={s.draft.destination}
                onChange={(e) => s.patch({ destination: e.target.value })}
              />
              <Field
                label={en ? "Success metric" : "評価指標"}
                placeholder={
                  en
                    ? "e.g. activated users from this campaign"
                    : "例：この施策から初回の価値体験に到達した人数"
                }
                value={s.draft.metric}
                onChange={(e) => s.patch({ metric: e.target.value })}
              />
              <Field
                label={en ? "Review date" : "評価日"}
                type="date"
                value={s.draft.evaluationDate}
                onChange={(e) => s.patch({ evaluationDate: e.target.value })}
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
      </div>
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
                        ? "Configure OPENAI_API_KEY and OPENAI_MODEL, and/or ANTHROPIC_API_KEY, in the hosting environment, then redeploy. Never paste keys into product sources."
                        : "ホスティング環境でOPENAI_API_KEYとOPENAI_MODEL、またはANTHROPIC_API_KEY（両方も可）を設定して再デプロイしてください。キーは製品資料に貼り付けないでください。"}
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
                <p>
                  {en ? "Agents may: " : "エージェントに許可している操作："}
                  <strong>
                    {s.settings?.settings.policy.agentApply === "any"
                      ? en
                        ? "read, propose and apply any proposal"
                        : "読み取り・提案・すべての提案の適用"
                      : s.settings?.settings.policy.agentApply ===
                          "own_proposals"
                        ? en
                          ? "read, propose and apply their own proposals"
                          : "読み取り・提案・自分の提案の適用"
                        : en
                          ? "read and propose (people apply)"
                          : "読み取りと提案（適用は人が行う）"}
                  </strong>{" "}
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => s.setView("settings")}
                  >
                    {en ? "Change policy" : "ポリシーを変更"}
                  </button>
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
    <>
      {s.workspace && (
        <h2 className="settings-section-title">
          {en ? "Workspace" : "ワークスペース"} · {s.workspace.name}
        </h2>
      )}
      <WorkspaceSettingsPanels s={s} />
      <h2 className="settings-section-title">
        {en ? "Account" : "アカウント"}
      </h2>
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
    </>
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
