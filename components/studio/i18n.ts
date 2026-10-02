export const labels = {
  ja: {
    home: "今日",
    strategy: "戦略",
    content: "コンテンツ",
    agents: "エージェント",
    calendar: "カレンダー",
    analytics: "分析",
    context: "製品コンテキスト",
    integrations: "インテグレーション",
    settings: "設定",
    save: "保存する",
    saved: "保存済み",
    unsaved: "未保存",
    saving: "保存中…",
    new: "新しい企画",
    search: "タイトル・本文で検索",
    plan: "企画",
    draft: "原稿",
    x: "X",
    article: "記事",
    reddit: "Reddit",
    video: "動画",
    guide: "手順書",
    locales: "言語版",
    assets: "素材",
    updates: "更新",
    review: "変更案",
    reload: "再読み込み",
    workspace: "ワークスペース",
    create: "作成",
    cancel: "キャンセル",
    apply: "変更を適用",
    generate: "変更案を生成",
    locked: "ロック中",
    unlock: "ロック解除",
    lock: "編集をロック",
  },
  en: {
    home: "Today",
    strategy: "Strategy",
    content: "Content",
    agents: "Agents",
    calendar: "Calendar",
    analytics: "Analytics",
    context: "Product context",
    integrations: "Integrations",
    settings: "Settings",
    save: "Save changes",
    saved: "Saved",
    unsaved: "Unsaved",
    saving: "Saving…",
    new: "New idea",
    search: "Search title or content",
    plan: "Plan",
    draft: "Draft",
    x: "X",
    article: "Article",
    reddit: "Reddit",
    video: "Video",
    guide: "Guide",
    locales: "Languages",
    assets: "Assets",
    updates: "Updates",
    review: "Changes",
    reload: "Reload",
    workspace: "Workspace",
    create: "Create",
    cancel: "Cancel",
    apply: "Apply change",
    generate: "Generate revision",
    locked: "Locked",
    unlock: "Unlock",
    lock: "Lock editing",
  },
} as const;
export type Locale = keyof typeof labels;
export type View =
  | "home"
  | "strategy"
  | "content"
  | "agents"
  | "calendar"
  | "analytics"
  | "context"
  | "integrations"
  | "settings";
export type Tab =
  | "plan"
  | "draft"
  | "x"
  | "article"
  | "reddit"
  | "video"
  | "guide"
  | "locales"
  | "assets"
  | "updates"
  | "review";
export type Labels = (typeof labels)[Locale];
