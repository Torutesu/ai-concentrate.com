import type { Production } from "./models";
export function newProduction(title = "新しい企画"): Production {
  return {
    title,
    persona: "",
    problem: "",
    claim: "",
    hypothesis: "",
    cta: "",
    destination: "",
    metric: "",
    evaluationDate: "",
    plannedDate: "",
    decision: "",
    items: [
      {
        id: "draft-ja",
        kind: "draft",
        locale: "ja",
        title: "原稿",
        body: "",
        locked: false,
      },
    ],
  };
}
export function shogunExample(): Production {
  return {
    ...newProduction("月曜の仕事復帰"),
    persona: "複数案件を持つフリーランス",
    problem: "仕事を再開するとき、前回の判断を探し直す。",
    claim: "前回の判断から仕事を再開する",
    hypothesis: "実演を見せることで、機能説明だけより体験利用につながるか。",
    cta: "ShogunAIを試す",
    destination: "https://shogunaios.com/ja?utm_campaign=resume-work",
    metric: "流入 → 初回の価値体験",
    items: [
      {
        id: "draft-ja",
        kind: "draft",
        locale: "ja",
        title: "原稿",
        body: "月曜の朝、金曜の自分に聞けたら。\n\n前回、何を決めて、なぜそう決めたのか。その文脈から、仕事を再開する。\n\n【検証用の企画】実際の画面で動作を確認してから公開します。",
        locked: false,
      },
      {
        id: "x-ja",
        kind: "x",
        locale: "ja",
        title: "X",
        body: "月曜の朝、最初にやる仕事が「先週の仕事を思い出すこと」になっていませんか。",
        locked: false,
      },
      ...["困る瞬間", "前回の判断", "次の作業", "試してみる"].map(
        (title, i) => ({
          id: `scene-${i + 1}-ja`,
          kind: "scene" as const,
          locale: "ja" as const,
          title,
          body: [
            "前回の判断を探していませんか。",
            "前回、何を決めて、なぜそう決めたのか。",
            "残った論点を確認して、次の作業へ。",
            "ShogunAIを自分の仕事で試す。",
          ][i],
          locked: i === 3,
        }),
      ),
      {
        id: "step-1-ja",
        kind: "step",
        locale: "ja",
        title: "前回の判断を確認する",
        body: "決定事項とその理由を確認して、続きの作業を選びます。",
        locked: false,
      },
    ],
  };
}
