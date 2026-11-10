'use client';

import { QRCodeSVG } from 'qrcode.react';

import type { ReceiptBlock } from '@/types/receipt';

/** Bausteine eines digitalen Belegs (wie PDF und Mail aus der API). */
export function ReceiptBlocks({ blocks }: { blocks: ReceiptBlock[] }) {
  return (
    <div className="rb">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'banner':
            return <div key={i} className="rb__banner">{b.text}</div>;
          case 'heading':
            return <div key={i} className="rb__heading">{b.text}</div>;
          case 'title':
            return <div key={i} className="rb__title">{b.text}</div>;
          case 'center':
            return <div key={i} className={`rb__center${b.muted ? ' rb__muted' : ''}`}>{b.text}</div>;
          case 'text':
            return (
              <div key={i} className={`${b.bold ? 'rb__bold' : ''}${b.muted ? ' rb__muted' : ''}`}>
                {b.text}
              </div>
            );
          case 'note':
            return <div key={i} className="rb__note">{b.text}</div>;
          case 'row':
            return (
              <div key={i} className={`rb__row${b.bold ? ' rb__row--bold' : ''}`}>
                <span>{b.label}</span>
                <span>{b.value}</span>
              </div>
            );
          case 'item':
            return (
              <div key={i} className="rb__item">
                <span>
                  <span>{b.qty}</span>
                  <span>{b.name}</span>
                </span>
                <span>{b.amount}</span>
              </div>
            );
          case 'rule':
            return <div key={i} className={`rb__rule${b.double ? ' rb__rule--double' : ''}`} />;
          case 'mono':
            return (
              <div key={i} className="rb__mono">
                {b.label && <span>{b.label}:</span>}
                <code>{b.text}</code>
              </div>
            );
          case 'qr':
            return (
              <div key={i} className="rb__qr">
                <QRCodeSVG value={b.value} size={140} level="Q" marginSize={1} />
                {b.caption && <span className="rb__muted">{b.caption}</span>}
              </div>
            );
          case 'fill':
            return (
              <div key={i} className="rb__fill">
                <span>{b.label}:</span>
                {Array.from({ length: b.lines }, (_, n) => (
                  <div key={n} className="rb__fill-line" />
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
