import React from 'react';

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  // Escape regex special characters
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Split query into words for individual matching
  const words = escaped.split(/\s+/).filter(Boolean);
  if (words.length === 0) return text;

  const pattern = new RegExp(`(${words.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-yellow-300 !text-black dark:bg-yellow-500 dark:!text-black rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}
