import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../ui/dialog";
/** Button that never submits a form unless given `type="submit"`. */
export function Action({
  primary,
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { primary?: boolean }) {
  return (
    <Button
      variant={primary ? "default" : "outline"}
      className={`btn ${primary ? "primary" : ""} ${className}`}
      type={type}
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
  error,
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
  /** Shown inside the dialog: the page behind it is hidden from assistive tech. */
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = !confirmText || typed.trim() === confirmText.trim();
  // A confirmed dialog closes from outside; start empty the next time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) setTyped("");
  }
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
          {error && (
            <p className="workspace-failure" role="alert">
              {error}
            </p>
          )}
          <div className="workspace-dialog-actions">
            <Action
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

/**
 * Opens a native <dialog> as a modal on mount. On unmount it closes the dialog
 * and returns focus to the element that opened it (unmounting an open modal
 * skips the browser's own focus restoration).
 */
export function useModalDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return ref;
}
