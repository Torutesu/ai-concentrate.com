"use client";
import { NoIdea } from "./workflow";
import { reviewReadiness } from "../../lib/agents/marketing";
import type { StudioController } from "./use-studio";
import { Action, Badge, Panel } from "./ui";
export function AgentReview({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  if (!s.draft) return <NoIdea s={s} />;
  const report = reviewReadiness(s.draft, s.sources.length);
  const names: Record<string, string> = {
    persona: "対象ユーザー",
    problem: "顧客の課題",
    claim: "伝える主張",
    cta: "次の行動",
    destination: "誘導先",
    metric: "評価指標",
    evaluationDate: "評価日",
  };
  return (
    <div className="stack">
      <Panel>
        <h2>{en ? "Editorial readiness" : "企画の確認"}</h2>
        <label className="field">
          <span>{en ? "Production" : "企画"}</span>
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
        <Badge>
          {s.dirty
            ? en
              ? "Unsaved draft"
              : "未保存の内容を確認中"
            : `v${s.selected?.revision}`}
        </Badge>
        <h3>{en ? "Missing information" : "不足している情報"}</h3>
        {report.missing.length ? (
          <ul>
            {report.missing.map((key) => (
              <li key={key}>{en ? key : names[key]}</li>
            ))}
          </ul>
        ) : (
          <p>{en ? "Brief fields complete" : "企画の基本項目は入力済みです"}</p>
        )}
        <p>
          {en
            ? `${s.sources.length} sources · claims require verification`
            : `資料 ${s.sources.length} 件 · 主張の根拠は要確認`}
        </p>
        <Action
          onClick={() => {
            s.setView("content");
            s.setTab("plan");
          }}
        >
          {en ? "Edit brief" : "企画を編集"}
        </Action>
        <Action onClick={() => s.setView("context")}>
          {en ? "Review sources" : "資料を確認"}
        </Action>
      </Panel>
      <Panel>
        <h2>{en ? "Human review" : "公開前の確認"}</h2>
        <ul>
          {(en
            ? [
                "Claims match current product capabilities",
                "A new user can reach a useful first result",
                "Copy fits the audience and channel",
                "CTA and measurement work end to end",
              ]
            : [
                "主張が現在の製品機能と一致している",
                "初めての利用者が役立つ結果まで到達できる",
                "対象ユーザーと媒体に内容が合っている",
                "誘導先から成果まで計測できる",
              ]
          ).map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <p className="muted">
          {en
            ? "This checks completeness, not predicted reach or factual accuracy."
            : "入力の充足確認です。効果予測や事実確認の完了を意味しません。"}
        </p>
      </Panel>
      <Panel>
        <h2>{en ? "AI proposals" : "AIの変更案"}</h2>
        <Badge>
          {s.changes.filter((c) => c.productionId === s.selected?.id).length}
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
    </div>
  );
}
