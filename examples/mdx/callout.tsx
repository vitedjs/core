import type { ReactNode } from 'react';

export default function Callout({ children }: { children: ReactNode }) {
  return (
    <aside
      role='note'
      style={{
        borderLeft: '4px solid #228be6',
        margin: '1rem 0',
        padding: '0.75rem 1rem',
        background: '#f1f3f5',
      }}
    >
      {children}
    </aside>
  );
}
