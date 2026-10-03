"use client";
import { ArrowRight, Check } from "lucide-react";
import {
  productionWorkflow,
  type WorkflowStep,
} from "../../lib/domain/workflow";
import type { StudioController } from "./use-studio";
import { Action, Empty } from "./ui";
export function goToStep(s: StudioController, step: WorkflowStep) {
  if (step === "draft") {
    s.setView("content");
    s.setTab("draft");
  } else s.setView(step);
}
export function Workflow({
  s,
  expanded = false,
}: {
  s: StudioController;
  expanded?: boolean;
}) {
  const en = s.locale === "en",
    flow = productionWorkflow(s.draft, s.sources.length);
  const names: Record<WorkflowStep, string> = en
    ? {
        context: "Sources",
        strategy: "Brief",
        draft: "Content",
        calendar: "Publication plan",
        analytics: "Learning",
      }
    : {
        context: "製品情報",
        strategy: "企画",
        draft: "原稿",
        calendar: "公開計画",
        analytics: "振り返り",
      };
  const actions: Record<WorkflowStep, string> = en
    ? {
        context: "Add product sources",
        strategy: "Define the audience and message",
        draft: "Write the first draft",
        calendar: "Set the destination and review date",
        analytics: "Record results and the next decision",
      }
    : {
        context: "製品情報を追加",
        strategy: "誰に・何を伝えるか決める",
        draft: "最初の原稿を作る",
        calendar: "誘導先と公開・評価日を決める",
        analytics: "結果と次の判断を残す",
      };
  const current = s.view === "content" ? "draft" : s.view;
  async function next() {
    if (!s.draft && flow.next !== "context") {
      if (await s.createProduction()) s.setView("strategy");
    } else goToStep(s, flow.next);
  }
  return (
    <section
      className={`workflow ${expanded ? "workflow-expanded" : ""}`}
      aria-label={en ? "Production workflow" : "制作の進め方"}
    >
      {expanded && (
        <div className="workflow-next">
          <div>
            <small>{en ? "Next action" : "次に進めること"}</small>
            <h2>{s.workspace?.role === "viewer" ? (en ? "Review the production progress" : "企画の進捗を確認") : actions[flow.next]}</h2>
          </div>
          <Action
            primary
            disabled={
              s.busy ||
              (!s.draft &&
                flow.next !== "context" &&
                s.workspace?.role === "viewer")
            }
            onClick={() => void next()}
          >
            {s.workspace?.role === "viewer" ? (en ? "Review" : "確認する") : (en ? "Continue" : "進める")}
            <ArrowRight size={16} />
          </Action>
        </div>
      )}
      <nav
        className="workflow-steps"
        aria-label={en ? "Preparation milestones" : "準備の進捗"}
      >
        {flow.steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => goToStep(s, step.id)}
            aria-current={step.id === current ? "step" : undefined}
            className={step.ready ? "is-ready" : ""}
          >
            <span className="workflow-number">
              {step.ready ? <Check size={14} /> : index + 1}
            </span>
            <span>{names[step.id]}</span>
            <span className="sr-only">
              {step.ready
                ? en
                  ? " · recorded"
                  : "・入力済み"
                : en
                  ? " · not complete"
                  : "・未入力あり"}
            </span>
          </button>
        ))}
      </nav>
    </section>
  );
}
export function NoIdea({ s }: { s: StudioController }) {
  const en = s.locale === "en",
    viewer = s.workspace?.role === "viewer";
  return (
    <Empty
      title={
        viewer
          ? en
            ? "No ideas to view yet"
            : "表示できる企画はまだありません"
          : en
            ? "Start with one idea"
            : "最初の企画をつくる"
      }
    >
      <p>
        {viewer
          ? en
            ? "An owner or editor can add ideas to this workspace."
            : "オーナー・編集者が作成した企画をここで確認できます。"
          : en
            ? "Choose an audience and one message. Expand into channels after the first draft."
            : "届ける相手と伝えたいことを一つ決め、原稿から各媒体へ展開します。"}
      </p>
      <div className="actions">
        {!viewer && (
          <Action
            primary
            disabled={s.busy}
            onClick={() => s.createProduction()}
          >
            {en ? "Create idea" : "企画を作成"}
          </Action>
        )}
        <Action onClick={() => s.setView("context")}>
          {en ? "View product sources" : "製品情報を確認"}
        </Action>
      </div>
    </Empty>
  );
}
