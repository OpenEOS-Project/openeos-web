'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight } from '@untitledui/icons';

import { useProductionStations } from '@/hooks/use-production-stations';
import type { ProductionStation } from '@/types/production-station';

interface StationFlowDiagramProps {
  eventId: string;
}

/** Build chains of stations following handoffStationId links. */
function buildChains(stations: ProductionStation[]): ProductionStation[][] {
  const stationMap = new Map(stations.map((s) => [s.id, s]));

  const handoffTargets = new Set(
    stations.filter((s) => s.handoffStationId).map((s) => s.handoffStationId!),
  );

  const roots = stations.filter((s) => !handoffTargets.has(s.id));
  const chains: ProductionStation[][] = [];

  for (const root of roots) {
    const chain: ProductionStation[] = [root];
    const visited = new Set<string>([root.id]);
    let current = root;

    while (current.handoffStationId && !visited.has(current.handoffStationId)) {
      const next = stationMap.get(current.handoffStationId);
      if (!next) break;
      chain.push(next);
      visited.add(next.id);
      current = next;
    }

    chains.push(chain);
  }

  return chains;
}

function StationNode({ station }: { station: ProductionStation }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-secondary bg-primary px-3 py-2 shadow-xs">
      <div
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: station.color || '#9ca3af' }}
      />
      <span className="whitespace-nowrap text-sm font-medium text-primary">
        {station.name}
      </span>
    </div>
  );
}

function HorizontalArrow() {
  return (
    <div className="flex items-center">
      <div className="h-px w-4 bg-border-secondary" />
      <ArrowRight className="size-3.5 text-fg-quaternary" />
    </div>
  );
}

/**
 * Tree connector on the left side of each chain row.
 * Draws the vertical line + horizontal stub for tree branching.
 *
 *  First row:  ├──   (vertical goes down from center)
 *  Middle row: ├──   (vertical goes full height)
 *  Last row:   └──   (vertical goes up to center)
 */
function TreeConnector({ isFirst, isLast }: { isFirst: boolean; isLast: boolean }) {
  return (
    <div className="relative w-5 self-stretch">
      {/* Top half of vertical line */}
      {!isFirst && (
        <div className="absolute left-0 top-0 bottom-1/2 w-px bg-border-secondary" />
      )}
      {/* Bottom half of vertical line */}
      {!isLast && (
        <div className="absolute left-0 top-1/2 bottom-0 w-px bg-border-secondary" />
      )}
      {/* Horizontal stub going right */}
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-px bg-border-secondary" />
    </div>
  );
}

export function StationFlowDiagram({ eventId }: StationFlowDiagramProps) {
  const t = useTranslations('productionStations');
  const { data: stations, isLoading } = useProductionStations(eventId);

  const chains = useMemo(() => {
    if (!stations || stations.length === 0) return [];
    return buildChains(stations);
  }, [stations]);

  if (isLoading || !stations || stations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-secondary bg-primary p-5 shadow-xs">
      <h3 className="mb-4 text-sm font-semibold text-primary">{t('flowDiagram.title')}</h3>

      <div className="flex items-start gap-0">
        {/* Start node: Bestellung */}
        <div className="flex shrink-0 items-center" style={{ paddingTop: chains.length > 1 ? `${(chains.length - 1) * 22}px` : 0 }}>
          <span className="rounded-lg border border-brand-solid bg-brand-secondary px-3 py-1.5 text-sm font-medium text-brand-primary">
            {t('flowDiagram.order')}
          </span>
          <div className="h-px w-4 bg-border-secondary" />
        </div>

        {/* Chain rows with tree connector */}
        <div className="flex flex-col">
          {chains.map((chain, ci) => (
            <div key={chain[0].id} className="flex items-center py-1.5">
              {/* Tree branch connector (only when multiple chains) */}
              {chains.length > 1 && (
                <TreeConnector
                  isFirst={ci === 0}
                  isLast={ci === chains.length - 1}
                />
              )}

              {/* Station nodes with arrows */}
              {chain.map((station, si) => (
                <div key={station.id} className="flex items-center">
                  {si > 0 && <HorizontalArrow />}
                  <StationNode station={station} />
                </div>
              ))}

              {/* End: Bereit zur Abholung */}
              <HorizontalArrow />
              <span className="shrink-0 rounded-lg border border-success-solid bg-success-secondary px-3 py-1.5 text-sm font-medium text-success-primary">
                {t('flowDiagram.ready')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
