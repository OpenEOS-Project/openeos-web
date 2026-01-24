'use client';

import { useTranslations } from 'next-intl';
import {
  CreditCard01,
  Coins01,
  Receipt,
  LinkExternal01,
  Check,
  AlertTriangle,
  Clock,
  RefreshCw01,
  Package,
  Stars01,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { Badge } from '@/components/ui/badges/badges';
import { useAuthStore } from '@/stores/auth-store';
import {
  useBillingOverview,
  usePaymentHistory,
  useCreateCreditCheckout,
  useCreateSubscriptionCheckout,
  useCreatePortalSession,
} from '@/hooks/use-billing';
import type { SubscriptionStatus, CreditPackage, CreditPurchase } from '@/types/settings';

export function BillingContainer() {
  const t = useTranslations('billing');
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;

  const { data: billingData, isLoading: isBillingLoading } = useBillingOverview(organizationId);
  const { data: paymentHistory, isLoading: isHistoryLoading } = usePaymentHistory(organizationId);

  const createCreditCheckout = useCreateCreditCheckout(organizationId);
  const createSubscriptionCheckout = useCreateSubscriptionCheckout(organizationId);
  const createPortalSession = useCreatePortalSession(organizationId);

  const handleBuyCredits = async (pkg: CreditPackage) => {
    const currentUrl = window.location.href;
    await createCreditCheckout.mutateAsync({
      packageId: pkg.id,
      successUrl: `${currentUrl}?success=credits`,
      cancelUrl: currentUrl,
    });
  };

  const handleStartSubscription = async () => {
    const currentUrl = window.location.href;
    await createSubscriptionCheckout.mutateAsync(currentUrl);
  };

  const handleOpenPortal = async () => {
    const currentUrl = window.location.href;
    await createPortalSession.mutateAsync(currentUrl);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: SubscriptionStatus | null) => {
    switch (status) {
      case 'active':
        return <Badge color="success">{t('subscription.status.active')}</Badge>;
      case 'past_due':
        return <Badge color="warning">{t('subscription.status.pastDue')}</Badge>;
      case 'canceled':
        return <Badge color="gray">{t('subscription.status.canceled')}</Badge>;
      case 'trialing':
        return <Badge color="blue">{t('subscription.status.trialing')}</Badge>;
      default:
        return <Badge color="gray">{t('subscription.status.none')}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge color="success" size="sm">{t('payment.status.completed')}</Badge>;
      case 'pending':
        return <Badge color="warning" size="sm">{t('payment.status.pending')}</Badge>;
      case 'failed':
        return <Badge color="error" size="sm">{t('payment.status.failed')}</Badge>;
      default:
        return <Badge color="gray" size="sm">{status}</Badge>;
    }
  };

  if (!organizationId) {
    return (
      <div className="rounded-xl border border-secondary bg-primary p-8 text-center">
        <p className="text-tertiary">
          Bitte wählen Sie zuerst eine Organisation aus.
        </p>
      </div>
    );
  }

  if (isBillingLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw01 className="h-8 w-8 animate-spin text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Subscription Card */}
        <div className="rounded-xl border border-secondary bg-primary shadow-xs">
          <div className="border-b border-secondary px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Stars01 className="h-5 w-5 text-brand-primary" />
                <h2 className="text-lg font-semibold text-primary">{t('subscription.title')}</h2>
              </div>
              {getStatusBadge(billingData?.subscription.status ?? null)}
            </div>
          </div>

          <div className="p-6 space-y-4">
            {billingData?.subscription.status === 'active' ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-tertiary">{t('subscription.price')}</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(billingData.subscription.priceMonthly || 0)} / Monat
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-tertiary">{t('subscription.creditsPerMonth')}</span>
                  <span className="font-semibold text-primary">
                    {billingData.subscription.creditsPerMonth} Credits
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-tertiary">{t('subscription.nextBilling')}</span>
                  <span className="font-medium text-primary">
                    {formatDate(billingData.subscription.currentPeriodEnd)}
                  </span>
                </div>
                <div className="pt-4 border-t border-secondary">
                  <Button
                    color="secondary"
                    onClick={handleOpenPortal}
                    disabled={createPortalSession.isPending}
                    className="w-full"
                  >
                    <LinkExternal01 className="h-4 w-4 mr-2" />
                    {t('subscription.manageSubscription')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  <p className="text-tertiary mb-4">{t('subscription.noSubscription')}</p>
                  {billingData?.subscription.priceMonthly && (
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-primary">
                        {formatCurrency(billingData.subscription.priceMonthly)}
                        <span className="text-lg font-normal text-tertiary"> / Monat</span>
                      </p>
                      <p className="text-sm text-tertiary mt-1">
                        Inkl. {billingData.subscription.creditsPerMonth} Credits pro Monat
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  onClick={handleStartSubscription}
                  disabled={createSubscriptionCheckout.isPending}
                  className="w-full"
                >
                  {createSubscriptionCheckout.isPending ? (
                    <>
                      <RefreshCw01 className="h-4 w-4 mr-2 animate-spin" />
                      Laden...
                    </>
                  ) : (
                    <>
                      <Stars01 className="h-4 w-4 mr-2" />
                      {t('subscription.subscribe')}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Credits Card */}
        <div className="rounded-xl border border-secondary bg-primary shadow-xs">
          <div className="border-b border-secondary px-6 py-4">
            <div className="flex items-center gap-2">
              <Coins01 className="h-5 w-5 text-brand-primary" />
              <h2 className="text-lg font-semibold text-primary">{t('credits.title')}</h2>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-primary">
                {billingData?.credits ?? 0}
              </p>
              <p className="text-tertiary mt-2">{t('credits.available')}</p>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-secondary">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning-primary shrink-0 mt-0.5" />
                <p className="text-sm text-secondary">
                  {t('credits.infoText')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-tertiary" />
            <h2 className="text-lg font-semibold text-primary">{t('packages.title')}</h2>
          </div>
          <p className="text-sm text-tertiary mt-1">{t('packages.description')}</p>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {billingData?.packages.map((pkg) => (
              <div
                key={pkg.id}
                className="relative rounded-xl border border-secondary p-6 hover:border-brand-primary transition-colors"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-primary">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="text-sm text-tertiary mt-1">{pkg.description}</p>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(pkg.price)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-tertiary">
                    <Coins01 className="h-4 w-4" />
                    {pkg.credits} Credits
                  </div>

                  <Button
                    color="secondary"
                    onClick={() => handleBuyCredits(pkg)}
                    disabled={createCreditCheckout.isPending}
                    className="w-full"
                  >
                    {t('packages.buy')}
                  </Button>
                </div>
              </div>
            ))}

            {(!billingData?.packages || billingData.packages.length === 0) && (
              <div className="col-span-full text-center py-8 text-tertiary">
                {t('packages.empty')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-tertiary" />
            <h2 className="text-lg font-semibold text-primary">{t('history.title')}</h2>
          </div>
        </div>

        <div className="divide-y divide-secondary">
          {isHistoryLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw01 className="h-6 w-6 animate-spin text-tertiary" />
            </div>
          ) : paymentHistory && paymentHistory.length > 0 ? (
            paymentHistory.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                    <CreditCard01 className="h-5 w-5 text-tertiary" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">
                      {payment.package?.name || `${payment.credits} Credits`}
                    </p>
                    <p className="text-sm text-tertiary">
                      {formatDate(payment.completedAt || payment.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {getPaymentStatusBadge(payment.paymentStatus)}
                  <span className="font-semibold text-primary">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="px-6 py-8 text-center text-tertiary">
              {t('history.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
