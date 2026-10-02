"use client";
import { useEffect, useState, useRef } from "react";
import type { ContentItem } from "../../lib/domain/models";
import { api } from "../../lib/studio-client";
import type { StudioController } from "./use-studio";
import { labels, type Tab } from "./i18n";
import { Action, Badge, Empty, Field, Panel } from "./ui";
const tabs: Tab[] = [
  "plan",
  "draft",
  "x",
  "article",
  "reddit",
  "video",
  "guide",
  "locales",
  "assets",
  "updates",
  "review",
];
export function Editor({ s }: { s: StudioController }) {
  const t = labels[s.locale],
    en = s.locale === "en";
  const [query, setQuery] = useState(""),
    [itemId, setItemId] = useState(""),
    [outputLocale, setOutputLocale] = useState<"ja" | "en">("ja"),
    [instruction, setInstruction] = useState(""),
    [aspect, setAspect] = useState("16:9"),
    [preview, setPreview] = useState(false);
  const p = s.draft,
    canEdit = s.workspace?.role !== "viewer" && !s.busy;
  const kinds: Partial<Record<Tab, ContentItem["kind"]>> = {
    draft: "draft",
    x: "x",
    article: "article",
    reddit: "reddit",
    video: "scene",
    guide: "step",
  };
  const kind = kinds[s.tab] ?? "draft";
  const items =
    p?.items.filter((i) => i.kind === kind && i.locale === outputLocale) ?? [];
  const selected = items.find((x) => x.id === itemId) ?? items[0];
  function updateItem(fields: Partial<ContentItem>) {
    if (p && selected)
      s.patch({
        items: p.items.map((x) =>
          x.id === selected.id ? { ...x, ...fields } : x,
        ),
      });
  }
  function addItem() {
    if (!p) return;
    const id = crypto.randomUUID();
    s.patch({
      items: [
        ...p.items,
        {
          id,
          kind: kind as ContentItem["kind"],
          locale: outputLocale,
          title: en ? "Untitled" : "新しい項目",
          body: "",
          locked: false,
        },
      ],
    });
    setItemId(id);
  }
  return (
    <>
      <div className="page-heading">
        <h1>{t.content}</h1>
        <Action
          primary
          disabled={!canEdit}
          onClick={() => s.createProduction()}
        >
          {t.new}
        </Action>
      </div>
      <nav className="tabs" aria-label={en ? "Content format" : "制作形式"}>
        {tabs.map((tab) => (
          <button
            key={tab}
            aria-current={s.tab === tab ? "page" : undefined}
            onClick={() => s.setTab(tab)}
          >
            {t[tab]}
          </button>
        ))}
      </nav>
      {!p ? (
        <Empty title={en ? "Create your first idea" : "最初の企画を作る"}>
          <Action primary onClick={() => s.createProduction()}>
            {t.new}
          </Action>
          <Action onClick={() => s.createProduction(true)}>
            ShogunAI {en ? "sample" : "サンプルを読み込む"}
          </Action>
        </Empty>
      ) : (
        <>
          <div className="identity">
            <div>
              <h2>{p.title}</h2>
              <span className="muted">
                {s.selected?.id.slice(0, 8)} / v{s.selected?.revision} ·{" "}
                {s.dirty ? t.unsaved : t.saved}
              </span>
            </div>
            <div className="actions">
              <label className="compact-select">
                {en ? "Output language" : "制作言語"}
                <select
                  value={outputLocale}
                  onChange={(e) =>
                    setOutputLocale(e.target.value as "ja" | "en")
                  }
                >
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </label>
              <Action primary onClick={s.save} disabled={!s.dirty || !canEdit}>
                {s.busy ? t.saving : t.save}
              </Action>
            </div>
          </div>
          {s.tab === "plan" ? (
            <fieldset disabled={!canEdit} className="split">
              <Panel>
                <Field
                  label={en ? "Audience" : "対象"}
                  value={p.persona}
                  onChange={(e) => s.patch({ persona: e.target.value })}
                />
                <Field
                  label={en ? "Message" : "伝えたいこと"}
                  value={p.claim}
                  onChange={(e) => s.patch({ claim: e.target.value })}
                />
                <Field
                  label="CTA"
                  value={p.cta}
                  onChange={(e) => s.patch({ cta: e.target.value })}
                />
                <Action onClick={() => s.setView("strategy")}>
                  {en ? "View strategy" : "施策の仮説を見る"}
                </Action>
              </Panel>
              <Panel>
                <h2>{en ? "Production plan" : "制作計画"}</h2>
                {p.items
                  .filter((i) => i.kind === "scene")
                  .map((i, n) => (
                    <button
                      className="list-item"
                      key={i.id}
                      onClick={() => {
                        setItemId(i.id);
                        s.setTab("video");
                      }}
                    >
                      {String(n + 1).padStart(2, "0")}　{i.title}
                    </button>
                  ))}
                <p className="muted">
                  {en
                    ? "Keep each deliverable tied to the same idea."
                    : "同じ企画から、原稿と各媒体の成果物を編集します。"}
                </p>
                <Action primary onClick={() => s.setTab("video")}>
                  {en ? "Edit video script" : "動画台本を編集"}
                </Action>
              </Panel>
            </fieldset>
          ) : s.tab === "review" ? (
            <Review s={s} />
          ) : s.tab === "updates" ? (
            <History s={s} />
          ) : s.tab === "assets" ? (
            <Empty title={en ? "Production assets" : "制作素材"}>
              <p>
                {en
                  ? "Cloud asset upload and rendering are not connected yet."
                  : "素材のクラウド保存・収録・動画書き出しは未接続です。"}
              </p>
              <p>
                {en
                  ? "The preview uses a dated ShogunAI reference, not a recording."
                  : "プレビューは既存のShogunAI参考画像です。実収録ではありません。"}
              </p>
              <Action onClick={() => s.setTab("video")}>{t.video}</Action>
            </Empty>
          ) : s.tab === "locales" ? (
            <div className="split">
              <Panel>
                <h2>{t.locales}</h2>
                {(["ja", "en"] as const).map((l) => (
                  <button
                    className="list-item"
                    key={l}
                    onClick={() => {
                      setOutputLocale(l);
                      s.setTab("draft");
                    }}
                  >
                    {l === "ja" ? "日本語" : "English"}{" "}
                    <Badge>
                      {p.items.filter((i) => i.locale === l).length}{" "}
                      {en ? "items" : "項目"}
                    </Badge>
                  </button>
                ))}
              </Panel>
              <Panel>
                <h2>{en ? "Independent variants" : "独立した言語版"}</h2>
                <p>
                  {en
                    ? "Switch the output language, add an item and write or generate its content. UI language remains unchanged."
                    : "制作言語を切り替えて項目を追加し、翻訳を入力・生成できます。UIの表示言語は変更しません。"}
                </p>
              </Panel>
            </div>
          ) : (
            <div
              className={
                s.tab === "video" ? "video-layout" : "split content-split"
              }
            >
              <Panel className="selection">
                <Field
                  label={t.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {s.tab === "video"
                  ? items.map((i, n) => (
                      <button
                        key={i.id}
                        className={`list-item ${selected?.id === i.id ? "selected" : ""}`}
                        onClick={() => setItemId(i.id)}
                      >
                        {String(n + 1).padStart(2, "0")} {i.title}
                      </button>
                    ))
                  : s.productions
                      .filter((x) =>
                        (
                          x.data.title +
                          " " +
                          x.data.items.map((i) => i.body).join(" ")
                        )
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                      )
                      .map((x) => (
                        <button
                          key={x.id}
                          className={`list-item ${s.selected?.id === x.id ? "selected" : ""}`}
                          onClick={() => s.select(x.id)}
                        >
                          <strong>{x.data.title}</strong>
                          <small>
                            v{x.revision} · {x.data.items.length}{" "}
                            {en ? "items" : "項目"}
                          </small>
                        </button>
                      ))}
                <Action disabled={!canEdit} onClick={addItem}>
                  ＋ {en ? "Add item" : "項目を追加"}
                </Action>
              </Panel>
              {s.tab === "video" && (
                <div className="video-center">
                  <button
                    className={`media-preview ${aspect === "9:16" ? "portrait" : ""}`}
                    onClick={() => setPreview(true)}
                    aria-label={en ? "Expand reference" : "参考画像を拡大"}
                  >
                    <img
                      src="/design-assets/shogun-reference.png"
                      alt="ShogunAI reference from 2026-09-06"
                    />
                  </button>
                  <small className="muted">
                    {en
                      ? "Reference · 2026-09-06 · not a recording"
                      : "参考素材 · 2026-09-06 · 実収録ではありません"}
                  </small>
                  <div className="identity">
                    <Action onClick={() => setPreview(true)}>
                      {en ? "Expand preview" : "プレビューを拡大"}
                    </Action>
                    <select
                      aria-label={en ? "Aspect ratio" : "縦横比"}
                      value={aspect}
                      onChange={(e) => setAspect(e.target.value)}
                    >
                      <option>16:9</option>
                      <option>9:16</option>
                    </select>
                  </div>
                  <Panel>
                    <span className="muted">
                      {en
                        ? "Storyboard · timing not set"
                        : "ストーリーボード · 秒数は未設定"}
                    </span>
                    <div className="timeline">
                      {items.map((i, n) => (
                        <button
                          key={i.id}
                          onClick={() => setItemId(i.id)}
                          aria-pressed={i.id === selected?.id}
                        >
                          {String(n + 1).padStart(2, "0")} {i.title}
                        </button>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}
              <Panel>
                {items.length > 1 && s.tab !== "video" && (
                  <label className="field">
                    <span>{en ? "Item" : "項目"}</span>
                    <select
                      value={selected?.id}
                      onChange={(e) => setItemId(e.target.value)}
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!selected ? (
                  <>
                    <h2>
                      {en
                        ? "No content in this language"
                        : "この言語の原稿はまだありません"}
                    </h2>
                    <Action primary disabled={!canEdit} onClick={addItem}>
                      {en ? "Create draft" : "原稿を作成"}
                    </Action>
                  </>
                ) : (
                  <>
                    <Field
                      label={en ? "Title" : "タイトル"}
                      value={selected.title}
                      disabled={!canEdit}
                      onChange={(e) => updateItem({ title: e.target.value })}
                    />
                    {s.tab === "guide" && (
                      <img
                        className="guide-image"
                        src="/design-assets/shogun-reference.png"
                        alt="ShogunAI reference, 2026-09-06"
                      />
                    )}
                    <Field
                      label={
                        s.tab === "video"
                          ? en
                            ? "Script"
                            : "台本"
                          : en
                            ? "Text"
                            : "本文"
                      }
                      multiline
                      value={selected.body}
                      disabled={!canEdit || selected.locked}
                      onChange={(e) => updateItem({ body: e.target.value })}
                    />
                    <div className="actions">
                      <Badge>
                        {selected.locale} / {selected.kind}
                      </Badge>
                      <Action
                        disabled={!canEdit}
                        onClick={() => updateItem({ locked: !selected.locked })}
                      >
                        {selected.locked ? t.unlock : t.lock}
                      </Action>
                    </div>
                    <hr />
                    <Field
                      label={en ? "AI instruction" : "AIへの指示"}
                      multiline
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                    />
                    <Action
                      primary
                      disabled={
                        !canEdit ||
                        s.dirty ||
                        !s.caps.ai ||
                        selected.locked ||
                        !instruction.trim()
                      }
                      onClick={() => s.generate(selected.id, instruction)}
                    >
                      {s.busy ? (en ? "Generating…" : "生成中…") : t.generate}
                    </Action>
                    <small className="muted">
                      {s.dirty
                        ? en
                          ? "Save before generating."
                          : "保存してから変更案を生成できます。"
                        : !s.caps.ai
                          ? en
                            ? "AI provider configuration required."
                            : "AI生成はサーバー設定待ちです。"
                          : en
                            ? "Sources from this workspace are sent to the AI provider."
                            : "このワークスペースの資料をAIに渡し、変更案を作成します。"}
                    </small>
                  </>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
      {preview && <ReferenceDialog en={en} close={() => setPreview(false)} />}
    </>
  );
}
function Review({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    cs = s.changes.filter((c) => c.productionId === s.selected?.id);
  return cs.length ? (
    <div className="stack">
      {cs.map((c) => (
        <Panel key={c.id}>
          <div className="identity">
            <h2>{en ? "Review change" : "変更内容を確認"}</h2>
            <Badge>
              {c.itemId} / v{c.baseRevision}
            </Badge>
          </div>
          <div className="two-col">
            <Field
              label={en ? "Current" : "現在"}
              multiline
              value={c.before}
              readOnly
            />
            <Field
              label={en ? "Proposal" : "変更案"}
              multiline
              value={c.after}
              readOnly
            />
          </div>
          <p className="muted">{c.instruction}</p>
          <Action
            primary
            disabled={
              s.busy ||
              s.dirty ||
              c.baseRevision !== s.selected?.revision ||
              s.workspace?.role === "viewer"
            }
            onClick={() => s.apply(c.id)}
          >
            {labels[s.locale].apply}
          </Action>
          {c.baseRevision !== s.selected?.revision && (
            <small>
              {en
                ? "This proposal targets an older revision."
                : "この変更案の元の版は古くなっています。"}
            </small>
          )}
        </Panel>
      ))}
    </div>
  ) : (
    <Empty title={en ? "No proposals" : "変更案はまだありません"}>
      <p>
        {en
          ? "Generate a revision from a saved item."
          : "保存した原稿やシーンから変更案を生成できます。"}
      </p>
    </Empty>
  );
}
function History({ s }: { s: StudioController }) {
  const [rows, setRows] = useState<{ revision: number; createdAt: string }[]>(
      [],
    ),
    [error, setError] = useState("");
  useEffect(() => {
    const c = new AbortController();
    api<{ history: typeof rows }>(
      `/workspaces/${s.workspaceId}/productions/${s.selected?.id}`,
      { signal: c.signal },
    )
      .then((r) => setRows(r.history))
      .catch((e) => {
        if (!c.signal.aborted) setError(String(e));
      });
    return () => c.abort();
  }, [s.workspaceId, s.selected?.id, s.selected?.revision]);
  return (
    <Panel>
      <h2>{s.locale === "en" ? "Revision history" : "編集履歴"}</h2>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <div key={r.revision} className="identity">
          <strong>v{r.revision}</strong>
          <span>{new Date(r.createdAt).toLocaleString(s.locale)}</span>
        </div>
      ))}
      <p className="muted">
        {s.locale === "en"
          ? "Previous revisions are preserved."
          : "以前の版はサーバーに保存されています。"}
      </p>
    </Panel>
  );
}

function ReferenceDialog({ en, close }: { en: boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="preview-dialog"
      onCancel={close}
      aria-label={en ? "Reference preview" : "参考画像プレビュー"}
    >
      <Action autoFocus onClick={close}>
        {en ? "Close" : "閉じる"}
      </Action>
      <p>
        {en ? "Reference · not a recording" : "参考素材 · 実収録ではありません"}
      </p>
      <img
        src="/design-assets/shogun-reference.png"
        alt="ShogunAI reference, 2026-09-06"
      />
    </dialog>
  );
}
