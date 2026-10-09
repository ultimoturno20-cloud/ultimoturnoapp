import type { ReactNode } from "react";

export function WorkspaceToolbar({ label, className = "", search, actions, children }: { label: string; className?: string; search: ReactNode; actions: ReactNode; children?: ReactNode }) {
  return <div className={`workspace-toolbar ${className}`} role="region" aria-label={label}>
    <div className="workspace-toolbar-main"><div className="workspace-toolbar-search">{search}</div><div className="workspace-toolbar-actions">{actions}</div></div>
    {children ? <div className="workspace-toolbar-filters">{children}</div> : null}
  </div>;
}
