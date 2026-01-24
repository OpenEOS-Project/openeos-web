'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from '@untitledui/icons';

import { Button } from '@/components/ui/buttons/button';
import { Input } from '@/components/ui/input/input';
import { Textarea } from '@/components/ui/textarea/textarea';
import { Dialog, DialogTrigger, Modal, ModalOverlay } from '@/components/ui/modal/modal';
import { useAuthStore } from '@/stores/auth-store';
import { shiftsApi } from '@/lib/api-client';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
];

const schema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().optional(),
  color: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddJobModalProps {
  open: boolean;
  planId: string;
  onClose: () => void;
}

export function AddJobModal({ open, planId, onClose }: AddJobModalProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const { currentOrganization } = useAuthStore();
  const organizationId = currentOrganization?.organizationId;
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      color: COLORS[0],
    },
  });

  const selectedColor = watch('color');

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      shiftsApi.createJob(organizationId!, planId, {
        name: data.name,
        description: data.description || undefined,
        color: data.color || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-plan', organizationId, planId] });
      reset();
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ein Fehler ist aufgetreten');
    },
  });

  const onSubmit = (data: FormData) => {
    setError(null);
    createMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setError(null);
    onClose();
  };

  return (
    <DialogTrigger isOpen={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <ModalOverlay>
        <Modal className="max-w-md">
          <Dialog className="w-full">
            <div className="w-full rounded-xl bg-primary shadow-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-secondary px-6 py-4">
                <h2 className="text-lg font-semibold text-primary">
                  {t('shifts.editor.addJob')}
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg p-2 text-fg-quaternary transition hover:bg-secondary hover:text-fg-quaternary_hover"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-4 px-6 py-5">
                  {error && (
                    <div className="rounded-lg bg-error-secondary p-3 text-sm text-error-primary">
                      {error}
                    </div>
                  )}

                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input
                        label={t('shifts.editor.jobName')}
                        placeholder={t('shifts.editor.jobNamePlaceholder')}
                        isRequired
                        isInvalid={!!errors.name}
                        hint={errors.name?.message}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                      />
                    )}
                  />

                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <Textarea
                        label={t('shifts.form.description')}
                        placeholder={t('shifts.form.descriptionPlaceholder')}
                        rows={2}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />

                  <div>
                    <label className="block text-sm font-medium text-primary mb-2">
                      {t('shifts.editor.jobColor')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`h-8 w-8 rounded-full border-2 transition-all ${
                            selectedColor === color
                              ? 'border-primary scale-110'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setValue('color', color)}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 border-t border-secondary px-6 py-4">
                  <Button type="button" color="secondary" onClick={handleClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    isDisabled={createMutation.isPending}
                    isLoading={createMutation.isPending}
                  >
                    {t('shifts.editor.addJob')}
                  </Button>
                </div>
              </form>
            </div>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
