import { Fragment } from 'react';

import { parseLegalText, type LegalInline } from '@/lib/legal';

function Inline({ parts }: { parts: LegalInline[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'bold') return <strong key={i}>{part.text}</strong>;
        if (part.type === 'link') {
          const external = !part.href.startsWith('mailto:');
          return (
            <a
              key={i}
              href={part.href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
            >
              {part.text}
            </a>
          );
        }
        return <Fragment key={i}>{part.text}</Fragment>;
      })}
    </>
  );
}

/**
 * Impressum oder Datenschutzhinweis eines Vereins als Text. Formatierung
 * siehe parseLegalText(): Absaetze, Zeilenumbrueche, Ueberschriften, fett,
 * automatische Links. Kein HTML.
 */
export function LegalText({ text, className }: { text: string; className?: string }) {
  const blocks = parseLegalText(text);
  return (
    <div className={className ? `legal-text ${className}` : 'legal-text'}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const Tag = block.level === 1 ? 'h2' : block.level === 2 ? 'h3' : 'h4';
          return (
            <Tag key={i}>
              <Inline parts={block.content} />
            </Tag>
          );
        }
        return (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inline parts={line} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
