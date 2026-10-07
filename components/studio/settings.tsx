"use client";
import { useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import type { OperationResults } from "../../lib/domain/operation-results";
import type { AiPolicy } from "../../lib/domain/settings";
import { operation } from "../../lib/studio-client";
import {
  cacheRate,
  draftToProfile,
  formatTokens,
  formatUsd,
  profileToDraft,
  sameProfile,
  type ProfileDraft,
} from "../../lib/ui/settings-form";
import { errorMessage } from "./errors";
import type { StudioController } from "./use-studio";
import { Action, Badge, ConfirmDialog, Panel } from "./ui";

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
};

/** Workspace-level AI policy, brand profile, usage and deletion. */
export function WorkspaceSettingsPanels({ s }: { s: StudioController }) {
  if (!s.settings || !s.workspace) return null;
  // Remount per workspace so drafts never leak between workspaces.
  return <Panels key={s.workspace.id} s={s} />;
}

function Panels({ s }: { s: StudioController }) {
  return (
    <div className="settings-stack">
      <div className="two-col">
        <PolicyPanel s={s} />
        <UsagePanel s={s} />
      </div>
      <ProfilePanel s={s} />
      {s.workspace?.role === "owner" && <DangerPanel s={s} />}
    </div>
  );
}

function PolicyPanel({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    saved = s.settings!.settings.policy,
    owner = s.workspace?.role === "owner";
  const [draft, setDraft] = useState<AiPolicy>(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const restricted = draft.allowedProviders !== undefined;
  const providers = [
    ...new Set([...s.aiProviders, ...(draft.allowedProviders ?? [])]),
  ];
  return (
    <Panel className="settings-panel">
      <div className="section-heading">
        <h2>{en ? "AI data policy" : "AIのデータポリシー"}</h2>
        <Badge>
          {owner ? (en ? "Owner" : "オーナー") : en ? "View only" : "閲覧のみ"}
        </Badge>
      </div>
      <p className="muted">
        {en
          ? "Controls what this workspace sends to AI providers and what connected agents may do."
          : "このワークスペースからAIに送る内容と、接続したエージェントに許可する操作を決めます。"}
      </p>
      <fieldset disabled={!owner || s.busy} className="choice-group">
        <legend>{en ? "Product sources" : "製品資料の送信"}</legend>
        <Choice
          name="sendSources"
          checked={draft.sendSources === "all"}
          onChange={() => setDraft({ ...draft, sendSources: "all" })}
          title={en ? "Send relevant passages" : "関連する部分だけ送る"}
          detail={
            en
              ? "Only passages relevant to the brief, with keys, emails and phone numbers masked. Sources you exclude are never sent."
              : "ブリーフに関係する部分だけを、APIキー・メール・電話番号を伏せて送ります。除外した資料は送りません。"
          }
        />
        <Choice
          name="sendSources"
          checked={draft.sendSources === "none"}
          onChange={() => setDraft({ ...draft, sendSources: "none" })}
          title={en ? "Never send sources" : "資料を送らない"}
          detail={
            en
              ? "AI sees only the brief, brand profile and the item being edited."
              : "AIにはブリーフ・ブランドプロフィール・編集中の項目だけを渡します。"
          }
        />
      </fieldset>
      <fieldset disabled={!owner || s.busy} className="choice-group">
        <legend>
          {en ? "Connected agents (MCP / CLI)" : "接続エージェント（MCP・CLI）"}
        </legend>
        {(
          [
            [
              "never",
              en ? "Propose only" : "提案のみ",
              en
                ? "Agents can read and propose; a person applies every change."
                : "読み取りと提案まで。適用は必ず人が行います。",
            ],
            [
              "own_proposals",
              en ? "Apply their own proposals" : "自分の提案だけ適用可",
              en
                ? "An agent may apply a proposal it created itself."
                : "エージェントは、自分が作った提案に限り適用できます。",
            ],
            [
              "any",
              en ? "Apply any proposal" : "すべての提案を適用可",
              en
                ? "Agents may apply any open proposal. Use only for trusted automation."
                : "エージェントがすべての提案を適用できます。信頼できる自動化にだけ使ってください。",
            ],
          ] as const
        ).map(([value, title, detail]) => (
          <Choice
            key={value}
            name="agentApply"
            checked={draft.agentApply === value}
            onChange={() => setDraft({ ...draft, agentApply: value })}
            title={title}
            detail={detail}
          />
        ))}
      </fieldset>
      <fieldset disabled={!owner || s.busy} className="choice-group">
        <legend>{en ? "AI providers" : "利用するAIプロバイダ"}</legend>
        <Choice
          name="providers"
          checked={!restricted}
          onChange={() => {
            const next = { ...draft };
            delete next.allowedProviders;
            setDraft(next);
          }}
          title={en ? "Any configured provider" : "設定済みのすべて"}
          detail={
            en
              ? "If one provider fails before answering, another may take over."
              : "応答前に失敗したときは、別のプロバイダに切り替えます。"
          }
        />
        <Choice
          name="providers"
          checked={restricted}
          onChange={() =>
            setDraft({
              ...draft,
              allowedProviders: draft.allowedProviders ?? [...s.aiProviders],
            })
          }
          title={en ? "Only selected providers" : "選んだプロバイダだけ"}
          detail={
            en
              ? "Content never reaches a provider that is not selected."
              : "選んでいないプロバイダには内容を送りません。"
          }
        />
        {restricted && (
          <div className="provider-list">
            {providers.length ? (
              providers.map((id) => (
                <label key={id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={draft.allowedProviders!.includes(id)}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        allowedProviders: e.target.checked
                          ? [...draft.allowedProviders!, id]
                          : draft.allowedProviders!.filter((p) => p !== id),
                      })
                    }
                  />
                  {PROVIDER_NAMES[id] ?? id}
                  {!s.aiProviders.includes(id) && (
                    <Badge>{en ? "Not configured" : "未設定"}</Badge>
                  )}
                </label>
              ))
            ) : (
              <p className="muted">
                {en
                  ? "No AI provider is configured on this deployment."
                  : "このデプロイ先にはAIプロバイダが設定されていません。"}
              </p>
            )}
            {draft.allowedProviders!.length === 0 && (
              <p className="field-hint" role="status">
                {en
                  ? "With no provider selected, AI generation is off for this workspace."
                  : "1つも選ばないと、このワークスペースではAI生成を使えません。"}
              </p>
            )}
          </div>
        )}
      </fieldset>
      {owner && (
        <div className="actions">
          <Action
            primary
            disabled={!dirty || s.busy}
            onClick={() => void s.saveSettings({ policy: draft })}
          >
            {en ? "Save policy" : "ポリシーを保存"}
          </Action>
          {dirty && (
            <Action disabled={s.busy} onClick={() => setDraft(saved)}>
              {en ? "Discard" : "元に戻す"}
            </Action>
          )}
        </div>
      )}
    </Panel>
  );
}

function Choice({
  name,
  checked,
  onChange,
  title,
  detail,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  detail: string;
}) {
  return (
    <label className={`choice ${checked ? "is-checked" : ""}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </label>
  );
}

function ProfilePanel({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    saved = s.settings!.settings.profile,
    canEdit = s.workspace?.role !== "viewer";
  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(saved));
  const next = draftToProfile(draft),
    dirty = !sameProfile(next, saved);
  const setRow = (i: number, fields: Partial<ProfileDraft["glossary"][0]>) =>
    setDraft({
      ...draft,
      glossary: draft.glossary.map((g, n) =>
        n === i ? { ...g, ...fields } : g,
      ),
    });
  return (
    <Panel className="settings-panel">
      <div className="section-heading">
        <h2>{en ? "Brand profile" : "ブランドプロフィール"}</h2>
        <Badge>
          {en ? "Sent with every AI request" : "すべてのAI生成に適用"}
        </Badge>
      </div>
      <p className="muted">
        {en
          ? "Short, stable guidance the AI follows for every item. Keep it concise: it is sent with each request."
          : "AIがすべての原稿で守る、短く安定したルールです。毎回送られるため、簡潔に書いてください。"}
      </p>
      <fieldset disabled={!canEdit || s.busy}>
        <label className="field">
          <span>{en ? "Voice and tone" : "文体・トーン"}</span>
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.voice}
            placeholder={
              en
                ? "e.g. Plain, confident, no hype. Address the reader as “you”."
                : "例：誇張せず、率直に。専門用語は最初に一言で説明する。"
            }
            onChange={(e) => setDraft({ ...draft, voice: e.target.value })}
          />
          <small className="field-hint">
            {draft.voice.length.toLocaleString()} / 2,000
          </small>
        </label>
        <div className="field">
          <span>{en ? "Glossary" : "用語集"}</span>
          {draft.glossary.length > 0 && (
            <div
              className="glossary-table"
              role="table"
              aria-label={en ? "Glossary" : "用語集"}
            >
              <div className="glossary-row glossary-head" role="row">
                <span role="columnheader">{en ? "Term" : "用語"}</span>
                <span role="columnheader">{en ? "Write as" : "推奨表記"}</span>
                <span role="columnheader">
                  {en
                    ? "Avoid (comma-separated)"
                    : "避ける表記（カンマ区切り）"}
                </span>
                <span role="columnheader" className="sr-only">
                  {en ? "Remove" : "削除"}
                </span>
              </div>
              {draft.glossary.map((g, i) => (
                <div className="glossary-row" role="row" key={i}>
                  <input
                    aria-label={en ? `Term ${i + 1}` : `用語 ${i + 1}`}
                    maxLength={100}
                    value={g.term}
                    onChange={(e) => setRow(i, { term: e.target.value })}
                  />
                  <input
                    aria-label={en ? `Write as ${i + 1}` : `推奨表記 ${i + 1}`}
                    maxLength={200}
                    value={g.preferred}
                    onChange={(e) => setRow(i, { preferred: e.target.value })}
                  />
                  <input
                    aria-label={en ? `Avoid ${i + 1}` : `避ける表記 ${i + 1}`}
                    value={g.avoid}
                    onChange={(e) => setRow(i, { avoid: e.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={
                      en ? `Remove term ${i + 1}` : `用語 ${i + 1} を削除`
                    }
                    onClick={() =>
                      setDraft({
                        ...draft,
                        glossary: draft.glossary.filter((_, n) => n !== i),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <Action
              type="button"
              disabled={draft.glossary.length >= 100}
              onClick={() =>
                setDraft({
                  ...draft,
                  glossary: [
                    ...draft.glossary,
                    { term: "", preferred: "", avoid: "" },
                  ],
                })
              }
            >
              <Plus size={15} />
              {en ? "Add term" : "用語を追加"}
            </Action>
          </div>
        </div>
        <label className="field">
          <span>
            {en
              ? "Claims never to make (one per line)"
              : "書いてはいけない主張（1行に1つ）"}
          </span>
          <textarea
            rows={4}
            value={draft.claims}
            placeholder={
              en ? "e.g. Guaranteed results" : "例：必ず成果が出る\n業界No.1"
            }
            onChange={(e) => setDraft({ ...draft, claims: e.target.value })}
          />
          <small className="field-hint">
            {en
              ? "AI drafts avoid these, and reviewers should still check every claim."
              : "AIはこれらを避けて書きます。最終確認は必ず人が行ってください。"}
          </small>
        </label>
      </fieldset>
      {canEdit && (
        <div className="actions">
          <Action
            primary
            disabled={!dirty || s.busy || next.prohibitedClaims.length > 50}
            onClick={() => void s.saveSettings({ profile: next })}
          >
            {en ? "Save profile" : "プロフィールを保存"}
          </Action>
          {dirty && (
            <Action
              disabled={s.busy}
              onClick={() => setDraft(profileToDraft(saved))}
            >
              {en ? "Discard" : "元に戻す"}
            </Action>
          )}
          {next.prohibitedClaims.length > 50 && (
            <small role="alert">
              {en ? "Up to 50 claims." : "50件までです。"}
            </small>
          )}
        </div>
      )}
    </Panel>
  );
}

type Usage = OperationResults["usage_get"];
function UsagePanel({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const [usage, setUsage] = useState<Usage | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    operation("usage_get", { workspaceId: s.workspaceId }, { signal: c.signal })
      .then((u) => {
        setUsage(u);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e, s.locale));
      });
    return () => c.abort();
  }, [s.workspaceId, s.locale, attempt]);
  const used = usage ? usage.monthlyTokenBudget - usage.remainingTokens : 0,
    ratio = usage?.monthlyTokenBudget
      ? Math.min(1, used / usage.monthlyTokenBudget)
      : 0;
  return (
    <Panel className="settings-panel">
      <div className="section-heading">
        <h2>{en ? "AI usage this month" : "今月のAI利用量"}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label={en ? "Refresh usage" : "利用量を更新"}
          onClick={() => setAttempt((n) => n + 1)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !usage ? (
        <p className="muted" role="status">
          {en ? "Loading usage…" : "利用量を読み込み中…"}
        </p>
      ) : (
        <>
          <div className="budget">
            <div className="budget-label">
              <span>{en ? "Your monthly budget" : "あなたの月間予算"}</span>
              <strong>
                {formatTokens(usage.remainingTokens, s.locale)}{" "}
                {en ? "tokens left" : "トークン残り"}
              </strong>
            </div>
            <div
              className={`meter ${ratio >= 0.9 ? "is-high" : ""}`}
              role="meter"
              aria-valuemin={0}
              aria-valuemax={usage.monthlyTokenBudget}
              aria-valuenow={used}
              aria-label={en ? "Budget used" : "予算の使用量"}
            >
              <span style={{ width: `${ratio * 100}%` }} />
            </div>
            <small className="field-hint">
              {formatTokens(used, s.locale)} /{" "}
              {formatTokens(usage.monthlyTokenBudget, s.locale)}{" "}
              {en
                ? "billable tokens (cached input is not counted)"
                : "課金対象トークン（キャッシュ済みの入力は含みません）"}
            </small>
          </div>
          <dl className="usage-grid">
            <div>
              <dt>{en ? "Workspace runs" : "ワークスペースの実行回数"}</dt>
              <dd>{usage.workspace.runs.toLocaleString(s.locale)}</dd>
            </div>
            <div>
              <dt>{en ? "Input / output tokens" : "入力／出力トークン"}</dt>
              <dd>
                {formatTokens(usage.workspace.inputTokens, s.locale)} /{" "}
                {formatTokens(usage.workspace.outputTokens, s.locale)}
              </dd>
            </div>
            <div>
              <dt>{en ? "Prompt cache hits" : "プロンプトキャッシュ率"}</dt>
              <dd>
                {cacheRate(
                  usage.workspace.inputTokens,
                  usage.workspace.cachedInputTokens,
                )}
                %
              </dd>
            </div>
            <div>
              <dt>{en ? "Estimated cost" : "推定費用"}</dt>
              <dd>{formatUsd(usage.workspace.costMicros, s.locale)}</dd>
            </div>
          </dl>
          <small className="field-hint">
            {en
              ? `Since ${new Date(usage.since).toLocaleDateString(s.locale)}. Every attempt is counted, including failed ones and fallbacks.`
              : `${new Date(usage.since).toLocaleDateString(s.locale)}以降。失敗や切り替えを含め、すべての試行を記録しています。`}
            {!s.caps.ai &&
              (en
                ? " AI generation is not configured on this deployment."
                : " このデプロイ先ではAI生成が未設定です。")}
          </small>
        </>
      )}
    </Panel>
  );
}

function DangerPanel({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    [open, setOpen] = useState(false),
    name = s.workspace?.name ?? "";
  return (
    <Panel className="settings-panel danger-zone">
      <h2>{en ? "Delete workspace" : "ワークスペースを削除"}</h2>
      <p className="muted">
        {en
          ? "The workspace disappears for every member immediately. Ideas, sources, proposals and history are permanently erased after 30 days."
          : "すべてのメンバーからすぐに見えなくなります。企画・資料・変更案・履歴は30日後に完全に消去されます。"}
      </p>
      <Action
        className="danger"
        disabled={s.busy}
        onClick={() => setOpen(true)}
      >
        <Trash2 size={15} />
        {en ? "Delete this workspace" : "このワークスペースを削除"}
      </Action>
      <ConfirmDialog
        open={open}
        busy={s.busy}
        title={en ? `Delete “${name}”?` : `「${name}」を削除しますか？`}
        description={
          <p>
            {en
              ? "Export anything you need first. This cannot be undone from the app."
              : "必要な内容は先に書き出してください。アプリから元に戻すことはできません。"}
          </p>
        }
        typePrompt={
          en
            ? "Type the workspace name to confirm"
            : "確認のため、ワークスペース名を入力してください"
        }
        confirmText={name}
        confirmLabel={en ? "Delete workspace" : "削除する"}
        cancelLabel={en ? "Cancel" : "キャンセル"}
        onClose={() => setOpen(false)}
        onConfirm={async () => {
          if (await s.deleteWorkspace()) setOpen(false);
        }}
      />
    </Panel>
  );
}
