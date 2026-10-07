import { ApiError } from "../../lib/studio-client";
import type { Locale } from "./i18n";

type Copy = { ja: string; en: string };
/** What the person can do next, per domain error code. Never shows provider payloads. */
const messages: Record<string, Copy> = {
  CONFLICT: {
    ja: "別の更新が先に保存されています。編集内容を控えてから再読み込みしてください。",
    en: "Someone saved a newer version. Copy your edits, then reload.",
  },
  LOCKED: {
    ja: "この項目はロックされています。ロックを解除して保存してから編集してください。",
    en: "This item is locked. Unlock it and save before editing.",
  },
  UNAUTHENTICATED: {
    ja: "ログインの有効期限が切れました。再ログインしてください。",
    en: "Your session expired. Sign in again.",
  },
  FORBIDDEN: {
    ja: "この操作を行う権限がありません。",
    en: "You don't have permission to do this.",
  },
  FORBIDDEN_SCOPE: {
    ja: "この接続には、この操作の権限がありません。",
    en: "This connection is not allowed to do this.",
  },
  NOT_FOUND: {
    ja: "対象が見つかりません。削除された可能性があります。再読み込みしてください。",
    en: "Not found. It may have been deleted. Reload to refresh.",
  },
  VALIDATION: {
    ja: "入力内容（長さ・URL・日付）を確認してください。",
    en: "Check the length, URL and date fields.",
  },
  TOO_LARGE: {
    ja: "送信するデータが大きすぎます。本文を分割してください。",
    en: "The request is too large. Split the text.",
  },
  AGGREGATE_TOO_LARGE: {
    ja: "この企画の合計サイズが上限を超えます。不要な項目や言語版を減らしてください。",
    en: "This idea would exceed its total size limit. Remove unused items or language versions.",
  },
  SOURCE_LIMIT: {
    ja: "資料の保存上限に達しました。不要な資料を削除してください。",
    en: "Source storage limit reached. Delete sources you no longer need.",
  },
  WORKSPACE_LIMIT: {
    ja: "作成できるワークスペースの上限に達しました。",
    en: "You've reached the workspace limit.",
  },
  AI_NOT_CONFIGURED: {
    ja: "AI生成はサーバーの設定待ちです。手動での編集と保存は利用できます。",
    en: "AI generation isn't configured on the server yet. Manual editing and saving still work.",
  },
  AI_POLICY: {
    ja: "このワークスペースのAIポリシーで、利用できるAIプロバイダがありません。設定を確認してください。",
    en: "The workspace AI policy allows no available provider. Check Settings.",
  },
  AI_BUDGET: {
    ja: "今月のAI利用上限に達しました。手動で編集するか、管理者に上限の変更を依頼してください。",
    en: "Your monthly AI budget is used up. Edit manually or ask an administrator to raise it.",
  },
  GENERATION_LIMIT: {
    ja: "生成リクエストが集中しています。少し待ってから再試行してください。",
    en: "Too many generations right now. Wait a moment and retry.",
  },
  GENERATION_PENDING: {
    ja: "同じ生成を処理中です。完了まで少し待ってください。",
    en: "This generation is still running. Wait a moment.",
  },
  GENERATION_FAILED: {
    ja: "AI生成を完了できませんでした。元の内容は保持されています。",
    en: "Generation didn't finish. Your content is unchanged.",
  },
  PROVIDER_ERROR: {
    ja: "AI生成を完了できませんでした。元の内容は保持されています。",
    en: "Generation didn't finish. Your content is unchanged.",
  },
  INVALID_OUTPUT: {
    ja: "AIの出力を検証できなかったため破棄しました。指示を変えて再試行してください。",
    en: "The AI output failed validation and was discarded. Adjust the instruction and retry.",
  },
  CHANGE_CLOSED: {
    ja: "この変更案はすでに適用・却下済みです。",
    en: "This proposal was already applied or rejected.",
  },
  EDIT_NOT_FOUND: {
    ja: "変更案の対象テキストが本文に見つかりません。最新の本文から作り直してください。",
    en: "The text this proposal edits is no longer in the item. Create a new proposal.",
  },
  EDIT_AMBIGUOUS: {
    ja: "変更案の対象テキストが複数見つかりました。最新の本文から作り直してください。",
    en: "The text this proposal edits appears more than once. Create a new proposal.",
  },
  IDEMPOTENCY_MISMATCH: {
    ja: "同じ操作キーで異なる内容が送られました。画面を再読み込みしてください。",
    en: "The same request key was reused with different content. Reload.",
  },
  STORAGE_UNAVAILABLE: {
    ja: "保存先に接続できません。時間をおいて再試行してください。",
    en: "Storage is unavailable. Retry shortly.",
  },
  SERVER: {
    ja: "サーバーで問題が発生しました。時間をおいて再試行してください。",
    en: "The server had a problem. Retry shortly.",
  },
};

export function errorMessage(e: unknown, locale: Locale): string {
  if (e instanceof ApiError) {
    const copy = messages[e.code]?.[locale];
    const reference = e.status >= 500 && e.requestId ? ` (${e.requestId})` : "";
    return (copy ?? e.message) + reference;
  }
  if (e instanceof DOMException && e.name === "TimeoutError")
    return locale === "ja"
      ? "通信がタイムアウトしました。内容は保持されています。再試行してください。"
      : "The request timed out. Your content is kept; retry.";
  return locale === "ja"
    ? "操作を完了できませんでした。"
    : "The action could not be completed.";
}
