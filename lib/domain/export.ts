import type { Production } from "./models";
export function productionMarkdown(p: Production) {
  const sections = [
    ["Audience", p.persona],
    ["Problem", p.problem],
    ["Message", p.claim],
    ["Hypothesis", p.hypothesis],
    ["CTA", p.cta],
    ["Destination", p.destination],
    ["Metric", p.metric],
    ["Review date", p.evaluationDate],
    ["Decision", p.decision],
  ];
  return `# ${p.title}\n\n${sections
    .filter(([, value]) => value)
    .map(([label, value]) => `## ${label}\n\n${value}`)
    .join(
      "\n\n",
    )}\n\n${p.items.map((item) => `## ${item.title} (${item.kind} / ${item.locale})\n\n${item.body}`).join("\n\n")}\n`;
}
