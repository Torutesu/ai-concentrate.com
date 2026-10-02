import type { ComponentProps, ReactNode } from "react";
import { Button } from "../ui/button";
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
