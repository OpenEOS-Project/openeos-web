'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stars01,
  Package,
  Plus,
  Edit01,
  Trash01,
  RefreshCw01,
  Check,
  XClose,
  Cloud01,
  AlertTriangle,
} from '@untitledui/icons';
import { Button } from '@/components/ui/buttons/button';
import { FormInput } from '@/components/ui/input/form-input';
import { InputGroup } from '@/components/ui/input/input-group';
import { Label } from '@/components/ui/input/label';
import { Toggle } from '@/components/ui/toggle/toggle';
import { Badge } from '@/components/ui/badges/badges';
import { DialogModal } from '@/components/ui/modal/dialog-modal';
import { adminApi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { SubscriptionConfig, CreditPackage } from '@/types/settings';

const subscriptionSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().optional(),
  priceMonthly: z.coerce.number().min(0, 'Preis muss positiv sein'),
  creditsPerMonth: z.coerce.number().min(1, 'Mindestens 1 Credit'),
});

const packageSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  description: z.string().optional(),
  credits: z.coerce.number().min(1, 'Mindestens 1 Credit'),
  price: z.coerce.number().min(0, 'Preis muss positiv sein'),
  sortOrder: z.coerce.number().optional(),
});

type SubscriptionFormData = z.infer<typeof subscriptionSchema>;
type PackageFormData = z.infer<typeof packageSchema>;

export function PricingManagement() {
  const t = useTranslations('admin.pricing');
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Check if user is super admin
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

  // Queries
  const { data: subscriptionConfig, isLoading: isConfigLoading } = useQuery({
    queryKey: ['admin', 'subscription-config'],
    queryFn: async () => {
      const response = await adminApi.getSubscriptionConfig();
      return response.data;
    },
  });

  const { data: creditPackages, isLoading: isPackagesLoading } = useQuery({
    queryKey: ['admin', 'credit-packages'],
    queryFn: async () => {
      const response = await adminApi.getCreditPackages();
      return response.data;
    },
  });

  // Mutations
  const updateConfig = useMutation({
    mutationFn: async (data: Partial<SubscriptionFormData>) => {
      const response = await adminApi.updateSubscriptionConfig(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscription-config'] });
    },
  });

  const createPackage = useMutation({
    mutationFn: async (data: PackageFormData) => {
      const response = await adminApi.createCreditPackage(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'credit-packages'] });
      setShowPackageModal(false);
    },
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PackageFormData & { isActive: boolean }> }) => {
      const response = await adminApi.updateCreditPackage(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'credit-packages'] });
      setEditingPackage(null);
      setShowPackageModal(false);
    },
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      await adminApi.deleteCreditPackage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'credit-packages'] });
      setDeleteConfirmId(null);
    },
  });

  const syncStripe = useMutation({
    mutationFn: async () => {
      await adminApi.syncStripeProducts();
    },
  });

  // Forms
  const subscriptionForm = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    values: {
      name: subscriptionConfig?.name || '',
      description: subscriptionConfig?.description || '',
      priceMonthly: subscriptionConfig?.priceMonthly || 0,
      creditsPerMonth: subscriptionConfig?.creditsPerMonth || 0,
    },
  });

  const packageForm = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: '',
      description: '',
      credits: 0,
      price: 0,
      sortOrder: 0,
    },
  });

  const handleSubscriptionSubmit = async (data: SubscriptionFormData) => {
    await updateConfig.mutateAsync(data);
  };

  const handlePackageSubmit = async (data: PackageFormData) => {
    if (editingPackage) {
      await updatePackage.mutateAsync({ id: editingPackage.id, data });
    } else {
      await createPackage.mutateAsync(data);
    }
  };

  const handleEditPackage = (pkg: CreditPackage) => {
    setEditingPackage(pkg);
    packageForm.reset({
      name: pkg.name,
      description: pkg.description || '',
      credits: pkg.credits,
      price: pkg.price,
      sortOrder: pkg.sortOrder,
    });
    setShowPackageModal(true);
  };

  const handleNewPackage = () => {
    setEditingPackage(null);
    packageForm.reset({
      name: '',
      description: '',
      credits: 0,
      price: 0,
      sortOrder: (creditPackages?.length || 0) + 1,
    });
    setShowPackageModal(true);
  };

  const handleTogglePackageActive = async (pkg: CreditPackage) => {
    await updatePackage.mutateAsync({
      id: pkg.id,
      data: { isActive: !pkg.isActive },
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (isConfigLoading || isPackagesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw01 className="h-8 w-8 animate-spin text-tertiary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Button */}
      <div className="flex justify-end">
        <Button
          color="secondary"
          onClick={() => syncStripe.mutate()}
          disabled={syncStripe.isPending}
        >
          {syncStripe.isPending ? (
            <>
              <RefreshCw01 className="h-4 w-4 mr-2 animate-spin" />
              Synchronisieren...
            </>
          ) : (
            <>
              <Cloud01 className="h-4 w-4 mr-2" />
              Mit Stripe synchronisieren
            </>
          )}
        </Button>
      </div>

      {/* Subscription Config */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <Stars01 className="h-5 w-5 text-brand-primary" />
            <h2 className="text-lg font-semibold text-primary">{t('subscription.title')}</h2>
          </div>
          <p className="text-sm text-tertiary mt-1">{t('subscription.description')}</p>
        </div>

        <form onSubmit={subscriptionForm.handleSubmit(handleSubscriptionSubmit)} className="p-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <InputGroup>
              <Label htmlFor="sub-name">{t('subscription.name')}</Label>
              <FormInput
                id="sub-name"
                {...subscriptionForm.register('name')}
                isInvalid={!!subscriptionForm.formState.errors.name}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="sub-description">{t('subscription.descriptionField')}</Label>
              <FormInput
                id="sub-description"
                {...subscriptionForm.register('description')}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="sub-price">{t('subscription.priceMonthly')}</Label>
              <FormInput
                id="sub-price"
                type="number"
                step="0.01"
                min="0"
                {...subscriptionForm.register('priceMonthly')}
                isInvalid={!!subscriptionForm.formState.errors.priceMonthly}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="sub-credits">{t('subscription.creditsPerMonth')}</Label>
              <FormInput
                id="sub-credits"
                type="number"
                min="1"
                {...subscriptionForm.register('creditsPerMonth')}
                isInvalid={!!subscriptionForm.formState.errors.creditsPerMonth}
              />
            </InputGroup>
          </div>

          {subscriptionConfig?.stripePriceId && (
            <div className="flex items-center gap-2 text-sm text-tertiary">
              <Check className="h-4 w-4 text-success-primary" />
              Mit Stripe synchronisiert
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-secondary">
            <Button
              type="submit"
              disabled={!subscriptionForm.formState.isDirty || updateConfig.isPending}
            >
              {updateConfig.isPending ? 'Speichern...' : t('subscription.save')}
            </Button>
          </div>
        </form>
      </div>

      {/* Credit Packages */}
      <div className="rounded-xl border border-secondary bg-primary shadow-xs">
        <div className="border-b border-secondary px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-tertiary" />
              <h2 className="text-lg font-semibold text-primary">{t('packages.title')}</h2>
            </div>
            <p className="text-sm text-tertiary mt-1">{t('packages.description')}</p>
          </div>
          <Button onClick={handleNewPackage}>
            <Plus className="h-4 w-4 mr-2" />
            {t('packages.add')}
          </Button>
        </div>

        <div className="divide-y divide-secondary">
          {creditPackages && creditPackages.length > 0 ? (
            creditPackages
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                      <Package className="h-5 w-5 text-tertiary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-primary">{pkg.name}</p>
                        {!pkg.isActive && (
                          <Badge color="gray" size="sm">Inaktiv</Badge>
                        )}
                        {pkg.stripeProductId && (
                          <Badge color="success" size="sm">Stripe</Badge>
                        )}
                      </div>
                      <p className="text-sm text-tertiary">
                        {pkg.credits} Credits • {formatCurrency(pkg.price)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      isSelected={pkg.isActive}
                      onChange={() => handleTogglePackageActive(pkg)}
                      size="sm"
                    />
                    <Button
                      color="tertiary"
                      size="sm"
                      onClick={() => handleEditPackage(pkg)}
                    >
                      <Edit01 className="h-4 w-4" />
                    </Button>
                    <Button
                      color="tertiary"
                      size="sm"
                      onClick={() => setDeleteConfirmId(pkg.id)}
                    >
                      <Trash01 className="h-4 w-4 text-error-primary" />
                    </Button>
                  </div>
                </div>
              ))
          ) : (
            <div className="px-6 py-8 text-center text-tertiary">
              {t('packages.empty')}
            </div>
          )}
        </div>
      </div>

      {/* Package Modal */}
      <DialogModal
        isOpen={showPackageModal}
        onClose={() => {
          setShowPackageModal(false);
          setEditingPackage(null);
        }}
        title={editingPackage ? t('packages.edit') : t('packages.add')}
        size="md"
      >
        <form onSubmit={packageForm.handleSubmit(handlePackageSubmit)} className="p-6 space-y-6">
          <InputGroup>
            <Label htmlFor="pkg-name">{t('packages.name')}</Label>
            <FormInput
              id="pkg-name"
              {...packageForm.register('name')}
              isInvalid={!!packageForm.formState.errors.name}
            />
          </InputGroup>

          <InputGroup>
            <Label htmlFor="pkg-description">{t('packages.descriptionField')}</Label>
            <FormInput
              id="pkg-description"
              {...packageForm.register('description')}
            />
          </InputGroup>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputGroup>
              <Label htmlFor="pkg-credits">{t('packages.credits')}</Label>
              <FormInput
                id="pkg-credits"
                type="number"
                min="1"
                {...packageForm.register('credits')}
                isInvalid={!!packageForm.formState.errors.credits}
              />
            </InputGroup>

            <InputGroup>
              <Label htmlFor="pkg-price">{t('packages.price')}</Label>
              <FormInput
                id="pkg-price"
                type="number"
                step="0.01"
                min="0"
                {...packageForm.register('price')}
                isInvalid={!!packageForm.formState.errors.price}
              />
            </InputGroup>
          </div>

          <InputGroup>
            <Label htmlFor="pkg-order">{t('packages.sortOrder')}</Label>
            <FormInput
              id="pkg-order"
              type="number"
              min="0"
              {...packageForm.register('sortOrder')}
            />
          </InputGroup>

          <div className="flex gap-3 pt-4 border-t border-secondary">
            <Button
              type="button"
              color="secondary"
              onClick={() => {
                setShowPackageModal(false);
                setEditingPackage(null);
              }}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={createPackage.isPending || updatePackage.isPending}
              className="flex-1"
            >
              {createPackage.isPending || updatePackage.isPending ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </form>
      </DialogModal>

      {/* Delete Confirmation Modal */}
      <DialogModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title={t('packages.deleteConfirm.title')}
        size="sm"
      >
        <div className="p-6 space-y-6">
          <p className="text-tertiary">{t('packages.deleteConfirm.message')}</p>

          <div className="flex gap-3">
            <Button
              color="secondary"
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              color="primary-destructive"
              onClick={() => deleteConfirmId && deletePackage.mutate(deleteConfirmId)}
              disabled={deletePackage.isPending}
              className="flex-1"
            >
              {deletePackage.isPending ? 'Löschen...' : 'Löschen'}
            </Button>
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
