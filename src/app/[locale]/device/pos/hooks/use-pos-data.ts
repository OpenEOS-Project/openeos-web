'use client';

import { useQuery } from '@tanstack/react-query';
import { deviceApi } from '@/lib/api-client';
import type { Event } from '@/types/event';
import type { PosProduct } from '../components/product-visual';

/**
 * Stammdaten der Kasse: Organisation, aktive Veranstaltung, Kategorien und
 * Produkte (nur in der Bestellansicht), Rabatt-Bons und Pfandarten.
 * Schlüssel wie bisher — Socket-Ereignisse invalidieren dieselben.
 */
export function usePosData(eventId: string | null, inOrderView: boolean) {
  const { data: orgData } = useQuery({
    queryKey: ['device-organization'],
    queryFn: () => deviceApi.getOrganization(),
  });
  const { data: eventsData } = useQuery({ queryKey: ['device-events'], queryFn: () => deviceApi.getEvents() });
  // Die Geräte-API liefert höchstens eine Veranstaltung (aktiv oder Test).
  const activeEvent: Event | null =
    (eventsData?.data || []).find((e: Event) => e.status === 'active' || e.status === 'test') ?? null;

  const { data: categoriesData } = useQuery({
    queryKey: ['device-categories', eventId],
    queryFn: () => deviceApi.getCategories(eventId!),
    enabled: !!eventId && inOrderView,
  });
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['device-products', eventId],
    queryFn: () => deviceApi.getProducts(eventId!),
    enabled: !!eventId && inOrderView,
  });
  const { data: vouchers = [] } = useQuery({
    queryKey: ['device-discount-vouchers'],
    queryFn: async () => (await deviceApi.getDiscountVouchers()).data,
  });
  const { data: pfandTypes = [] } = useQuery({
    queryKey: ['device-pfand-types'],
    queryFn: async () => (await deviceApi.getPfandTypes()).data,
  });

  return {
    orgName: orgData?.data?.name ?? null,
    orgSettings: orgData?.data?.settings,
    activeEvent,
    categories: categoriesData?.data || [],
    products: (productsData?.data || []) as PosProduct[],
    productsLoading,
    vouchers,
    pfandTypes,
  };
}
