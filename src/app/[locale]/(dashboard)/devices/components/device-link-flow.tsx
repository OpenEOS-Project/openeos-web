'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, Loader } from 'lucide-react';

import { Input } from '@/components/ui/input/input';
import { Label } from '@/components/ui/input/label';
import { Select } from '@/components/ui/select/select';
import { useAuthStore } from '@/stores/auth-store';
import { devicesApi } from '@/lib/api-client';
import type { DeviceClass, PendingDeviceLookup } from '@/types/device';
import { normalizePairingCode, PAIRING_CODE_LENGTH } from '@/utils/pairing-code';

/* 'admin' fehlt hier bewusst — der Wert wurde nirgends ausgewertet und
   schickte das Geraet in dieselbe Ansicht wie eine Kasse. */
const GERAETETYPEN: DeviceClass[] = ['pos', 'display'];

type Schritt = 'code' | 'einrichten' | 'fertig';

interface DeviceLinkFlowProps {
  /** Aus dem QR-Code des Geraets, dann wird sofort gesucht. */
  codeAusUrl?: string;
  /** Nach dem Verknuepfen — Dialog schliessen oder weiterleiten. */
  onFertig?: () => void;
  /**
   * Nur Geraete dieses Typs annehmen und den Typ nicht zur Wahl stellen —
   * die Druckerseite verbindet Drucker-Agents; ein dort eingegebener
   * Kassen-Code darf die Kasse nicht in einen Agent verwandeln.
   */
  fixedType?: DeviceClass;
}

/**
 * Code eingeben, Gerät einrichten, verknüpfen.
 *
 * Als eigene Komponente, weil es diesen Weg zweimal gibt: als Dialog in
 * der Geräteübersicht und als eigene Seite, auf der man landet, wenn man
 * den QR-Code vom Bildschirm abscannt. Zwei Fassungen desselben Ablaufs
 * würden beim nächsten neuen Feld auseinanderlaufen.
 */
export function DeviceLinkFlow({ codeAusUrl, onFertig, fixedType }: DeviceLinkFlowProps) {
  const t = useTranslations('devices');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { organizations } = useAuthStore();

  const [schritt, setSchritt] = useState<Schritt>('code');
  const [code, setCode] = useState(normalizePairingCode(codeAusUrl));
  const [gefunden, setGefunden] = useState<PendingDeviceLookup | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const [orgId, setOrgId] = useState('');
  const [name, setName] = useState('');
  const [typ, setTyp] = useState<DeviceClass>(fixedType ?? 'pos');

  // Bei genau einer Organisation gibt es nichts zu wählen.
  useEffect(() => {
    if (organizations?.length === 1) setOrgId(organizations[0].organizationId);
  }, [organizations]);

  const suchen = useMutation({
    mutationFn: (wert: string) => devicesApi.lookup(wert),
    onSuccess: (antwort) => {
      const geraet = antwort.data;
      if (fixedType && geraet.deviceType !== fixedType) {
        setFehler(t('verify.wrongType', { type: t(`class.${fixedType}`) }));
        return;
      }
      setGefunden(geraet);
      setName(geraet.suggestedName || '');
      setTyp(fixedType ?? geraet.deviceType ?? 'pos');
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
      queryClient.invalidateQueries({ queryKey: ['printer-agents'] });
      setSchritt('fertig');
    },
    onError: () => setFehler(t('verify.linkFailed')),
  });

  /* Mit Code aus dem QR-Code sofort suchen: Wer gescannt hat, hat die
     Zahl schon übergeben und soll sie nicht abtippen. */
  useEffect(() => {
    const ausUrl = normalizePairingCode(codeAusUrl);
    if (ausUrl.length === PAIRING_CODE_LENGTH) suchen.mutate(ausUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeAusUrl]);

  if (schritt === 'fertig') {
    return (
      <div className="device-link__done">
        <span className="device-link__icon device-link__icon--ok">
          <CircleCheck />
        </span>
        <h3 className="device-link__title">{t('verify.success')}</h3>
        <p className="device-link__lead">
          {fixedType === 'printer_agent' ? t('verify.successDescriptionPrinterAgent') : t('verify.successDescription')}
        </p>
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

        {!fixedType && (
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
        )}

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
        if (code.length !== PAIRING_CODE_LENGTH) return setFehler(t('verify.invalidCode'));
        setFehler(null);
        suchen.mutate(code);
      }}
    >
      <p className="device-link__lead">
        {fixedType === 'printer_agent' ? t('verify.enterCodeDescriptionPrinterAgent') : t('verify.enterCodeDescription')}
      </p>

      <div className="device-link__field">
        <Label htmlFor="code">{t('verify.code')}</Label>
        {/* Ohne maxLength: Das Feld schnitt eingefügte Codes mit
            Leerzeichen („57 30 80") nach sechs Zeichen ab, bevor sie
            bereinigt werden konnten. Gekürzt wird jetzt nach dem
            Entfernen der Trenner. */}
        <Input
          id="code"
          value={code}
          onChange={(wert) => setCode(normalizePairingCode(wert))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="verify-code-input"
          autoFocus
        />
      </div>

      {fehler && <p className="device-link__error">{fehler}</p>}

      <button
        type="submit"
        className="btn btn--primary btn--block"
        disabled={code.length !== PAIRING_CODE_LENGTH || suchen.isPending}
      >
        {suchen.isPending ? <Loader className="animate-spin" /> : t('verify.lookup')}
      </button>
    </form>
  );
}
