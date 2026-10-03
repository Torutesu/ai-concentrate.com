"use client";
import { useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Search,
  LoaderCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
import { Action } from "./ui";
import type { StudioController } from "./use-studio";

type Intent = { kind: "switch"; id: string; name: string } | { kind: "create" };
export function WorkspaceSwitcher({ s }: { s: StudioController }) {
  const en = s.locale === "en";
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null),
    [creating, setCreating] = useState(false);
  const [name, setName] = useState(""),
    [failure, setFailure] = useState(false);
  const [decision, setDecision] = useState<"save" | "discard" | undefined>();
  const trigger = useRef<HTMLButtonElement>(null);
  const role = (r?: string) =>
    r === "owner"
      ? en
        ? "Owner"
        : "オーナー"
      : r === "editor"
        ? en
          ? "Editor"
          : "編集者"
        : en
          ? "Viewer"
          : "閲覧者";
  const results = s.workspaces.filter((w) =>
    w.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  function request(next: Intent) {
    setOpen(false);
    setFailure(false);
    if (next.kind === "switch" && next.id === s.workspaceId) return;
    if (s.dirty) {
      setIntent(next);
      return;
    }
    if (next.kind === "create") {
      setDecision(undefined);
      setCreating(true);
    } else void s.switchWorkspace(next.id);
  }
  async function proceed(choice: "save" | "discard") {
    if (!intent) return;
    setFailure(false);
    if (intent.kind === "create") {
      // Keep the old draft until the new workspace has actually been created.
      setDecision(choice);
      setIntent(null);
      setCreating(true);
      return;
    }
    if (await s.switchWorkspace(intent.id, choice)) setIntent(null);
    else setFailure(true);
  }
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (value) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={trigger}
            className="workspace-trigger"
            disabled={s.busy || s.loading}
            aria-label={`${en ? "Switch workspace" : "ワークスペースを切り替え"}: ${s.workspace?.name ?? ""}`}
          >
            <span className="workspace-monogram" aria-hidden="true">
              {s.workspace?.name.slice(0, 1).toUpperCase() || "+"}
            </span>
            <span className="workspace-identity">
              <strong>
                {s.workspace?.name || (en ? "Workspace" : "ワークスペース")}
              </strong>
              <small>
                {s.loading
                  ? en
                    ? "Loading…"
                    : "読み込み中…"
                  : s.workspace
                    ? role(s.workspace.role)
                    : en
                      ? "Create your first workspace"
                      : "最初のワークスペースを作成"}
              </small>
            </span>
            <ChevronsUpDown size={15} aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="workspace-menu"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          aria-label={en ? "Workspaces" : "ワークスペース"}
        >
          <div className="workspace-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label={en ? "Search workspaces" : "ワークスペースを検索"}
              placeholder={en ? "Search workspaces…" : "ワークスペースを検索"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div
            className="workspace-options"
            aria-label={en ? "Available workspaces" : "参加中のワークスペース"}
          >
            {results.map((w) => (
              <button
                key={w.id}
                className="workspace-option"
                aria-current={w.id === s.workspaceId ? "true" : undefined}
                onClick={() =>
                  request({ kind: "switch", id: w.id, name: w.name })
                }
              >
                <span className="workspace-monogram" aria-hidden="true">
                  {w.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="workspace-identity">
                  <strong>{w.name}</strong>
                  <small>{role(w.role)}</small>
                </span>
                {w.id === s.workspaceId && (
                  <Check
                    size={17}
                    aria-label={
                      en ? "Current workspace" : "現在のワークスペース"
                    }
                  />
                )}
              </button>
            ))}
            {!results.length && (
              <p className="workspace-no-results">
                {en
                  ? "No workspaces found"
                  : "該当するワークスペースがありません"}
              </p>
            )}
          </div>
          <button
            className="workspace-create"
            onClick={() => request({ kind: "create" })}
          >
            <Plus size={17} />
            {en ? "Create workspace" : "ワークスペースを作成"}
          </button>
        </PopoverContent>
      </Popover>
      <Dialog
        open={Boolean(intent)}
        onOpenChange={(value) => {
          if (!value && !s.busy) {
            setIntent(null);
            setFailure(false);
          }
        }}
      >
        <DialogContent
          className="workspace-dialog"
          showCloseButton={false}
          onCloseAutoFocus={restoreFocus}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (s.busy) e.preventDefault();
          }}
        >
          <DialogTitle>
            {en ? "Save your changes?" : "編集中の内容を保存しますか？"}
          </DialogTitle>
          <DialogDescription>
            {intent?.kind === "switch"
              ? en
                ? `Before switching to ${intent.name}, choose what to do with your edits in ${s.workspace?.name}.`
                : `${intent.name}に切り替える前に、${s.workspace?.name}での変更を保存できます。`
              : en
                ? "You have unsaved changes in this workspace."
                : "現在のワークスペースに未保存の変更があります。"}
          </DialogDescription>
          <div className="workspace-draft-name">{s.draft?.title}</div>
          {failure && (
            <p className="workspace-failure" role="alert">
              {en
                ? "Could not save. Your edits are still here. Try again or cancel."
                : "保存できませんでした。編集内容は残っています。再試行するか、キャンセルしてください。"}
            </p>
          )}
          <div className="workspace-dialog-actions">
            <Action disabled={s.busy} onClick={() => setIntent(null)}>
              {en ? "Cancel" : "キャンセル"}
            </Action>
            <Action disabled={s.busy} onClick={() => void proceed("discard")}>
              {en ? "Discard changes" : "変更を破棄"}
            </Action>
            <Action
              primary
              disabled={s.busy}
              onClick={() => void proceed("save")}
            >
              {s.busy ? <LoaderCircle size={16} className="spin" /> : null}
              {en ? "Save and continue" : "保存して続ける"}
            </Action>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={creating}
        onOpenChange={(value) => {
          if (!s.busy) {
            setCreating(value);
            setFailure(false);
          }
        }}
      >
        <DialogContent
          className="workspace-dialog"
          showCloseButton={false}
          onCloseAutoFocus={restoreFocus}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (s.busy) e.preventDefault();
          }}
        >
          <DialogTitle>
            {en ? "Create a workspace" : "ワークスペースを作成"}
          </DialogTitle>
          <DialogDescription>
            {en
              ? "Keep each product’s sources, strategy and content together."
              : "プロダクトごとに、情報・戦略・コンテンツをまとめて管理します。"}
          </DialogDescription>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setFailure(false);
              if (await s.createWorkspace(name.trim(), decision)) {
                setCreating(false);
                setName("");
              } else setFailure(true);
            }}
          >
            <label className="workspace-name-label">
              {en ? "Product or brand name" : "プロダクト・ブランド名"}
              <input
                required
                maxLength={100}
                value={name}
                disabled={s.busy}
                placeholder={en ? "e.g. ShogunAI" : "例：ShogunAI"}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {failure && (
              <p className="workspace-failure" role="alert">
                {en
                  ? "Could not create the workspace. Your existing work is unchanged. Please try again."
                  : "作成できませんでした。現在の作業は保持されています。もう一度お試しください。"}
              </p>
            )}
            <div className="workspace-dialog-actions">
              <Action disabled={s.busy} onClick={() => setCreating(false)}>
                {en ? "Cancel" : "キャンセル"}
              </Action>
              <button
                className="btn primary"
                type="submit"
                disabled={s.busy || !name.trim()}
              >
                {s.busy
                  ? en
                    ? "Creating…"
                    : "作成中…"
                  : en
                    ? "Create workspace"
                    : "作成する"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
