import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-gray-100 pb-6">
      <h1 className="bg-gradient-to-r from-black to-gray-700 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
        {title}
      </h1>
      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </header>
  );
}
