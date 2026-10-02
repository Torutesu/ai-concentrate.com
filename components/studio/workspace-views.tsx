"use client";
import { useState } from "react";
import type { StudioController } from "./use-studio";
import { labels } from "./i18n";
import { Action, Badge, Empty, Field, Panel } from "./ui";
export function Context({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    [name, setName] = useState(""),
    [kind, setKind] = useState<"markdown" | "url" | "repository">("markdown"),
    [reference, setReference] = useState(""),
    [body, setBody] = useState(""),
    [fileError, setFileError] = useState("");
  async function read(file?: File) {
    if (!file) return;
    if (file.size > 180000) {
      setFileError(en ? "File is too large." : "ファイルが大きすぎます。");
      return;
    }
    const text = await file.text();
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
        <h2>{en ? "Workspace sources" : "登録済みの資料"}</h2>
        {s.sources.length ? (
          s.sources.map((source) => (
            <details key={source.id} className="source-detail">
              <summary>
                {source.name} <Badge>{source.kind}</Badge>
              </summary>
              <p className="muted">{source.reference}</p>
              <pre>{source.body}</pre>
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
  if (!p)
    return (
      <Empty title={en ? "Create an idea first" : "企画を作成してください"}>
        <Action primary onClick={() => s.createProduction()}>
          {labels[s.locale].new}
        </Action>
      </Empty>
    );
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
        <h2>{en ? "Measurement is not connected" : "計測は未接続です"}</h2>
        <p className="muted">
          {en
            ? "No sample results are presented as real performance. Record the metric and your decision below."
            : "実績データはまだありません。評価指標と、検証後の判断を企画に残せます。"}
        </p>
      </Panel>
      {p && (
        <>
          <IdeaPicker s={s} />
          <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
            <Panel>
              <Field
                label={en ? "Metric" : "評価指標"}
                value={p.metric}
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
    [day, setDay] = useState("");
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
      <Panel>
        <h2>{day || (en ? "Plan a publication date" : "公開予定を決める")}</h2>
        <IdeaPicker s={s} />
        {s.draft && (
          <fieldset disabled={s.busy || s.workspace?.role === "viewer"}>
            <Field
              label={en ? "Planned date" : "公開予定日"}
              type="date"
              value={s.draft.plannedDate}
              onChange={(e) => s.patch({ plannedDate: e.target.value })}
            />
            {day && (
              <Action onClick={() => s.patch({ plannedDate: day })}>
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
    [
      "AI",
      s.caps.ai,
      en
        ? "Reviewable revisions from saved sources."
        : "保存済み資料を参照した変更案の生成。",
    ],
    [
      "Markdown",
      true,
      en ? "Import and store source text." : "資料本文の読み込み・保存。",
    ],
    [
      "URL / GitHub",
      false,
      en
        ? "References can be saved; automatic sync is pending."
        : "参照先と本文は保存可能。自動同期は未接続。",
    ],
    [
      "X / Reddit / YouTube",
      false,
      en
        ? "Draft editing is available; publishing is pending."
        : "原稿編集は利用可能。外部への投稿は未接続。",
    ],
    [
      "Video / Voice / Export",
      false,
      en
        ? "Storyboard and script editing only."
        : "シーン構成・台本の編集に対応。",
    ],
    [
      "Analytics",
      false,
      en
        ? "Performance ingestion is pending."
        : "実績データの取り込みは未接続。",
    ],
    [
      "MCP / CLI",
      s.caps.mcp,
      en
        ? "Shared operations endpoint available. Connect the Site plugin with OAuth; CLI requires an authorized token."
        : "共通操作の接続口を用意。SiteプラグインのOAuth接続、CLIは認可済みトークンが必要です。",
    ],
  ] as const;
  return (
    <div className="integration-grid">
      {entries.map(([name, active, description]) => (
        <Panel key={name}>
          <div className="identity">
            <h2>{name}</h2>
            <Badge>
              {active
                ? en
                  ? "Available"
                  : "利用可能"
                : en
                  ? "Not connected"
                  : "未接続"}
            </Badge>
          </div>
          <p className="muted">{description}</p>
          {name === "AI" && !active && (
            <small>
              {en
                ? "Server configuration: OPENAI_API_KEY and OPENAI_MODEL."
                : "サーバーでOPENAI_API_KEY・OPENAI_MODELを設定してください。"}
            </small>
          )}
        </Panel>
      ))}
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
        <Badge>ChatGPT {en ? "authentication" : "認証"}</Badge>
        <label className="field">
          <span>{en ? "Interface language" : "表示言語"}</span>
          <select
            value={s.locale}
            onChange={(e) => s.setLocale(e.target.value as "ja" | "en")}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>
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
