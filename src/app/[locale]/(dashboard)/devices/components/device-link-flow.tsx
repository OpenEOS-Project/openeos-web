'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loading02 } from '@untitledui/icons';

import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';

/* 'admin' fehlt hier bewusst — der Wert wurde nirgends ausgewertet und
   schickte das Geraet in dieselbe Ansicht wie eine Kasse. */
const GERAETETYPEN: DeviceClass[] = ['pos', 'display'];

type Schritt = 'code' | 'einrichten' | 'fertig';

interface DeviceLinkFlowProps {
  /** Aus dem QR-Code des Geraets, dann wird sofort gesucht. */
  codeAusUrl?: string;
  /** Nach dem Verknuepfen — Dialog schliessen oder weiterleiten. */
  onFertig?: () => void;
}

/**
 * Code eingeben, Gerät einrichten, verknüpfen.
 *
 * Als eigene Komponente, weil es diesen Weg zweimal gibt: als Dialog in
 * der Geräteübersicht und als eigene Seite, auf der man landet, wenn man
 * den QR-Code vom Bildschirm abscannt. Zwei Fassungen desselben Ablaufs
 * würden beim nächsten neuen Feld auseinanderlaufen.
 */
export function DeviceLinkFlow({ codeAusUrl, onFertig }: DeviceLinkFlowProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { organizations } = useAuthStore();

  const [schritt, setSchritt] = useState<Schritt>('code');
  const [code, setCode] = useState(codeAusUrl ?? '');
  const [gefunden, setGefunden] = useState<PendingDeviceLookup | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [typ, setTyp] = useState<DeviceClass>('pos');

  // Bei genau einer Organisation gibt es nichts zu wählen.
  useEffect(() => {
    if (organizations?.length === 1) setOrgId(organizations[0].organizationId);
  }, [organizations]);

  const suchen = useMutation({
    mutationFn: (wert: string) => devicesApi.lookup(wert),
    onSuccess: (antwort) => {
      const geraet = antwort.data;
      setGefunden(geraet);
      setName(geraet.suggestedName || '');
      setTyp(geraet.deviceType || 'pos');
      setSchritt('einrichten');
      setFehler(null);
    },
    onError: () => setFehler(t('verify.deviceNotFound')),
  });

  const verknuepfen = useMutation({
    mutationFn: () =>
      devicesApi.link({ code, organizationId: orgId, name, deviceType: typ }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setSchritt('fertig');
    },
    onError: () => setFehler(t('verify.linkFailed')),
  });

  /* Mit Code aus dem QR-Code sofort suchen: Wer gescannt hat, hat die
     Zahl schon übergeben und soll sie nicht abtippen. */
  useEffect(() => {
    if (codeAusUrl?.length === 6) suchen.mutate(codeAusUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeAusUrl]);

  if (schritt === 'fertig') {
    return (
      <div className="device-link__done">
        <span className="device-link__icon device-link__icon--ok">
          <CheckCircle />
        </span>
        <h3 className="device-link__title">{t('verify.success')}</h3>
        <p className="device-link__lead">{t('verify.successDescription')}</p>
        <button type="button" className="btn btn--primary btn--block" onClick={onFertig}>
          {tCommon('close')}
        </button>
      </div>
    );
  }

  if (schritt === 'einrichten' && gefunden) {
    return (
      <div className="device-link__form">
        <p className="device-link__found">{t('verify.deviceFound')}</p>

        {organizations && organizations.length > 1 && (
          <div className="device-link__field">
            <Label htmlFor="org">{t('verify.organization')}</Label>
            <Select
              selectedKey={orgId || null}
              onSelectionChange={(wert) => setOrgId((wert as string) ?? '')}
              placeholder={t('verify.selectOrganization')}
            >
              {organizations.map((org) => (
                <Select.Item key={org.organizationId} id={org.organizationId}>
                  {org.organization?.name ?? org.organizationId}
                </Select.Item>
              ))}
            </Select>
          </div>
        )}

        <div className="device-link__field">
          <Label htmlFor="name">{t('verify.deviceName')}</Label>
          <Input id="name" value={name} onChange={setName} placeholder={t('verify.namePlaceholder')} />
        </div>

        <div className="device-link__field">
          <Label htmlFor="typ">{t('verify.deviceType')}</Label>
          <Select selectedKey={typ} onSelectionChange={(wert) => setTyp(wert as DeviceClass)}>
            {GERAETETYPEN.map((wert) => (
              <Select.Item key={wert} id={wert}>
                {t(`class.${wert}`)}
              </Select.Item>
            ))}
          </Select>
        </div>

        {fehler && <p className="device-link__error">{fehler}</p>}

        <div className="device-link__row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setSchritt('code');
              setGefunden(null);
            }}
          >
            {tCommon('back')}
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              if (!orgId) return setFehler(t('verify.selectOrganization'));
              if (!name.trim()) return setFehler(t('verify.enterName'));
              setFehler(null);
              verknuepfen.mutate();
            }}
            disabled={verknuepfen.isPending}
          >
            {verknuepfen.isPending ? '…' : t('verify.link')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="device-link__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length !== 6) return setFehler(t('verify.invalidCode'));
        setFehler(null);
        suchen.mutate(code);
      }}
    >
      <p className="device-link__lead">{t('verify.enterCodeDescription')}</p>

      <div className="device-link__field">
        <Label htmlFor="code">{t('verify.code')}</Label>
        <Input
          id="code"
          value={code}
          onChange={setCode}
          placeholder="000000"
          maxLength={6}
          className="verify-code-input"
          autoFocus
        />
      </div>

      {fehler && <p className="device-link__error">{fehler}</p>}

      <button
        type="submit"
        className="btn btn--primary btn--block"
        disabled={code.length !== 6 || suchen.isPending}
      >
        {suchen.isPending ? <Loading02 className="animate-spin" /> : t('verify.lookup')}
      </button>
    </form>
  );
}
