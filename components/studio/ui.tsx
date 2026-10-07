import { useState, type ComponentProps, type ReactNode } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
export function Action({
  primary,
  className = "",
  ...props
}: ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <Button
      variant={primary ? "default" : "outline"}
      className={`btn ${primary ? "primary" : ""} ${className}`}
      {...props}
    />
  );
}
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Field({
  label,
  multiline = false,
  ...props
}: {
  label: string;
  multiline?: boolean;
  value: string;
  onChange?: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? <textarea rows={4} {...props} /> : <input {...props} />}
    </label>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Panel>
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </Panel>
  );
}
/**
 * Confirmation for destructive actions. With `confirmText`, the person must
 * type it (e.g. the workspace name) before the action is enabled.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmText,
  typePrompt,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  confirmText?: string;
  typePrompt?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = !confirmText || typed.trim() === confirmText.trim();
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) {
          setTyped("");
          onClose();
        }
      }}
    >
      <DialogContent
        className="workspace-dialog confirm-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild>
          <div>{description}</div>
        </DialogDescription>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (ready && !busy) onConfirm();
          }}
        >
          {confirmText && (
            <label className="workspace-name-label">
              {typePrompt}
              <input
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmText}
              />
            </label>
          )}
          <div className="workspace-dialog-actions">
            <Action
              type="button"
              disabled={busy}
              onClick={() => {
                setTyped("");
                onClose();
              }}
            >
              {cancelLabel}
            </Action>
            <Action type="submit" className="danger" disabled={busy || !ready}>
              {confirmLabel}
            </Action>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
