'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stars01,
  RefreshCw01,
  Check,
  Cloud01,
  AlertTriangle,
  CurrencyEuro,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { FormInput } from '@/components/ui/input/form-input';
import { InputGroup } from '@/components/ui/input/input-group';
import { Badge } from '@/components/ui/badges/badges';
import { adminApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

const PACKAGES = [
  { slug: '1-day', credits: 1, defaultDiscount: 0 },
  { slug: 'weekend', credits: 3, defaultDiscount: 14 },
  { slug: '1-week', credits: 7, defaultDiscount: 20 },
] as const;

const pricingSchema = z.object({
  pricePerDay: z.coerce.number().min(0, 'Preis muss positiv sein'),
  priceMonthly: z.coerce.number().min(0, 'Preis muss positiv sein'),
});

type PricingFormData = z.infer<typeof pricingSchema>;

export function PricingManagement() {
  const t = useTranslations('admin.pricing');
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // --- Queries ---
  // apiClient is a fetch wrapper: apiClient.get<T>() returns T directly.
  // API returns { data: T }, so response.data is the actual value.

  const { data: packagesData, isLoading: isPackagesLoading } = useQuery({
    queryKey: ['admin', 'default-packages'],
    queryFn: async () => {
      const res = await adminApi.ensureDefaultPackages();
      return res.data; // CreditPackage[]
    },
  });

  const { data: subData, isLoading: isConfigLoading } = useQuery({
    queryKey: ['admin', 'subscription-config'],
    queryFn: async () => {
      const res = await adminApi.getSubscriptionConfig();
      return res.data; // SubscriptionConfig | null
    },
  });

  // --- Derived API values ---
  const oneDayPkg = packagesData?.find((p) => p.slug === '1-day');
  const loadedPricePerDay = oneDayPkg ? Number(oneDayPkg.price) : 25;
  const loadedPriceMonthly = subData ? Number(subData.priceMonthly) : 0;

  // --- Form ---
  const form = useForm<PricingFormData>({
    resolver: zodResolver(pricingSchema),
    defaultValues: { pricePerDay: 25, priceMonthly: 0 },
  });

  // Reset form with API values once both queries are done
  useEffect(() => {
    if (!isPackagesLoading && !isConfigLoading) {
      form.reset({ pricePerDay: loadedPricePerDay, priceMonthly: loadedPriceMonthly });
    }
  }, [isPackagesLoading, isConfigLoading, loadedPricePerDay, loadedPriceMonthly]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Computed preview ---
  const watched = form.watch();
  const base = watched.pricePerDay || 0;

  const computedPackages = PACKAGES.map((def) => {
    const price = Math.round(base * def.credits * (1 - def.defaultDiscount / 100) * 100) / 100;
    return { ...def, price };
  });

  // --- Mutations ---
  const savePricing = useMutation({
    mutationFn: async (data: PricingFormData) => {
      const packages = PACKAGES.map((def) => ({
        slug: def.slug,
        price: Math.round(data.pricePerDay * def.credits * (1 - def.defaultDiscount / 100) * 100) / 100,
      }));
      await Promise.all([
        adminApi.updatePackagePrices(packages),
        adminApi.updateSubscriptionConfig({ name: 'Monatsabo', priceMonthly: data.priceMonthly }),
      ]);
    },
    onSuccess: () => {
      form.reset(form.getValues());
      queryClient.invalidateQueries({ queryKey: ['admin', 'default-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'credit-packages'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-config'] });
    },
  });

  const syncStripe = useMutation({
    mutationFn: async () => {
      const res = await adminApi.syncStripeProducts();
      return res.data;
    },
  });

  // --- Helpers ---
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  // --- Guards ---
  if (!user?.isSuperAdmin) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-warning-primary mb-4" />
        <h2 className="text-lg font-semibold text-primary mb-2">Zugriff verweigert</h2>
        <p className="text-tertiary">
          Diese Seite ist nur für Super-Administratoren zugänglich.
        </p>
      </div>
    );
  }

  if (isPackagesLoading || isConfigLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw01 className="h-8 w-8 animate-spin text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stripe Sync Button */}
      <div className="flex justify-end">
        <Button
          color="secondary"
          onClick={() => syncStripe.mutate()}
          disabled={syncStripe.isPending}
          isLoading={syncStripe.isPending}
          showTextWhileLoading
          iconLeading={syncStripe.isPending ? RefreshCw01 : Cloud01}
        >
          {syncStripe.isPending ? t('syncStripe.syncing') : t('syncStripe.button')}
        </Button>
      </div>

      <form onSubmit={form.handleSubmit((data) => savePricing.mutateAsync(data))}>
        {/* Price Inputs */}
        <div className="rounded-xl border border-secondary bg-primary shadow-xs">
          <div className="border-b border-secondary px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              <CurrencyEuro className="h-5 w-5 text-brand-primary" />
              <h2 className="text-base sm:text-lg font-semibold text-primary">{t('title')}</h2>
            </div>
            <p className="text-xs sm:text-sm text-tertiary mt-0.5 sm:mt-1">{t('description')}</p>
          </div>

          <div className="p-4 sm:p-6">
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-2">
              <InputGroup size="md" label={t('pricePerDay')} prefix="€">
                <Controller
                  name="pricePerDay"
                  control={form.control}
                  render={({ field }) => (
                    <FormInput
                      id="price-per-day"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="25.00"
                      value={String(field.value)}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      isInvalid={!!form.formState.errors.pricePerDay}
                    />
                  )}
                />
              </InputGroup>

              <InputGroup size="md" label={t('priceMonthly')} prefix="€">
                <Controller
                  name="priceMonthly"
                  control={form.control}
                  render={({ field }) => (
                    <FormInput
                      id="price-monthly"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={String(field.value)}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      isInvalid={!!form.formState.errors.priceMonthly}
                    />
                  )}
                />
              </InputGroup>
            </div>
          </div>
        </div>

        {/* Preview: Package Table */}
        <div className="mt-4 sm:mt-6 rounded-xl border border-secondary bg-primary shadow-xs">
          <div className="border-b border-secondary px-4 py-3 sm:px-6 sm:py-4">
            <h3 className="text-sm sm:text-md font-semibold text-primary">{t('preview.title')}</h3>
            <p className="text-xs sm:text-sm text-tertiary mt-0.5">{t('preview.description')}</p>
          </div>

          {/* Mobile: Card Layout */}
          <div className="divide-y divide-secondary md:hidden">
            {computedPackages.map((cp) => (
              <div key={cp.slug} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary">
                    {t(`packages.${cp.slug === '1-day' ? 'day' : cp.slug === 'weekend' ? 'weekend' : 'week'}` as Parameters<typeof t>[0])}
                  </span>
                  <span className="text-sm font-medium text-primary">{formatCurrency(cp.price)}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-tertiary">
                  <span>{cp.credits} {cp.credits === 1 ? 'Tag' : 'Tage'}</span>
                  <span>{formatCurrency(cp.price / cp.credits)}/Tag</span>
                  {cp.defaultDiscount > 0 && (
                    <Badge color="success" size="sm">-{cp.defaultDiscount}%</Badge>
                  )}
                </div>
              </div>
            ))}

            {/* Subscription row mobile */}
            {Number(watched.priceMonthly || 0) > 0 && (
              <div className="px-4 py-3 bg-brand-50/50 dark:bg-brand-950/10">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
                    <Stars01 className="h-4 w-4 text-brand-primary" />
                    {t('subscription.title')}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {formatCurrency(Number(watched.priceMonthly || 0))}{' '}
                    <span className="font-normal text-tertiary text-xs">{t('subscription.perMonth')}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-tertiary">{t('subscription.unlimited')}</p>
              </div>
            )}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden md:block overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary bg-secondary">
                  <th className="px-6 py-3 text-left text-sm font-medium text-tertiary">
                    {t('preview.package')}
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-tertiary">
                    {t('preview.days')}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-tertiary">
                    {t('preview.price')}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-tertiary">
                    {t('preview.perDay')}
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-tertiary">
                    {t('preview.savings')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary">
                {computedPackages.map((cp) => (
                  <tr key={cp.slug}>
                    <td className="px-6 py-4 text-sm font-medium text-primary">
                      {t(`packages.${cp.slug === '1-day' ? 'day' : cp.slug === 'weekend' ? 'weekend' : 'week'}` as Parameters<typeof t>[0])}
                    </td>
                    <td className="px-6 py-4 text-sm text-tertiary">
                      {cp.credits}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-primary text-right">
                      {formatCurrency(cp.price)}
                    </td>
                    <td className="px-6 py-4 text-sm text-tertiary text-right">
                      {formatCurrency(cp.price / cp.credits)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        {cp.defaultDiscount > 0 ? (
                          <Badge color="success" size="sm">
                            -{cp.defaultDiscount}%
                          </Badge>
                        ) : (
                          <span className="text-sm text-quaternary">&mdash;</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Subscription row */}
                {Number(watched.priceMonthly || 0) > 0 && (
                  <tr className="bg-brand-50/50 dark:bg-brand-950/10">
                    <td className="px-6 py-4 text-sm font-medium text-primary">
                      <span className="flex items-center gap-1.5">
                        <Stars01 className="h-4 w-4 text-brand-primary" />
                        {t('subscription.title')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-tertiary">
                      {t('subscription.unlimited')}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-primary text-right">
                      {formatCurrency(Number(watched.priceMonthly || 0))} <span className="font-normal text-tertiary">{t('subscription.perMonth')}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-tertiary text-right">
                      <span className="text-quaternary">&mdash;</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-quaternary">&mdash;</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Stripe status */}
          {(packagesData?.some((p) => p.stripeProductId) || subData?.stripePriceId) && (
            <div className="px-4 py-3 sm:px-6 border-t border-secondary flex items-center gap-2 text-xs sm:text-sm text-tertiary">
              <Check className="h-4 w-4 text-success-primary" />
              {t('preview.stripeLinked')}
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="mt-4 sm:mt-6 flex justify-end">
          <Button
            type="submit"
            disabled={!form.formState.isDirty || savePricing.isPending}
            isLoading={savePricing.isPending}
            showTextWhileLoading
          >
            {savePricing.isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
