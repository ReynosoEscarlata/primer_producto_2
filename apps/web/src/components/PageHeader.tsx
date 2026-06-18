import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h1>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}
