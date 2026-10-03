import type { Production } from "./models";
export type WorkflowStep =
  | "context"
  | "strategy"
  | "draft"
  | "calendar"
  | "analytics";
/** These are observable preparation milestones, never publication or business results. */
export function productionWorkflow(p: Production | null, sourceCount: number) {
  const steps: { id: WorkflowStep; ready: boolean }[] = [
    { id: "context", ready: sourceCount > 0 },
    {
      id: "strategy",
      ready:
        !!p && [p.persona, p.problem, p.claim, p.cta].every((v) => v.trim()),
    },
    { id: "draft", ready: !!p?.items.some((i) => i.body.trim()) },
    {
      id: "calendar",
      ready:
        !!p &&
        [p.destination, p.metric, p.plannedDate, p.evaluationDate].every((v) =>
          v.trim(),
        ),
    },
    { id: "analytics", ready: !!p?.decision.trim() },
  ];
  return {
    steps,
    next: steps.find((step) => !step.ready)?.id ?? "analytics",
    complete: steps.every((step) => step.ready),
  };
}
