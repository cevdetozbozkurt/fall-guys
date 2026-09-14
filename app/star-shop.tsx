'use client';
import { t } from '@/lib/i18n';

/* oxlint-disable nextjs/no-img-element -- Images are locally rendered data URLs; no image server or network transfer. */
import { useEffect, useState } from 'react';
import {
  SHOP_ITEMS,
  OUTFIT_COLORS,
  OUTFIT_BUNDLES,
  equipItem,
  type Cosmetics,
  type CosmeticSlot,
} from '@/lib/cosmetics';
import { starBalance, type Progression } from '@/lib/progression';
import AvatarPreview from './avatar-preview';
export default function StarShop({
  value,
  progress,
  busy,
  onChange,
  onBuy,
  onSave,
}: {
  value: Cosmetics;
  progress: Progression;
  busy: boolean;
  onChange: (value: Cosmetics) => void;
  onBuy: (id: string) => Promise<boolean>;
  onSave?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(value),
    [slot, setSlot] = useState<CosmeticSlot>('body'),
    [selected, setSelected] = useState('body:' + value.body),
    [images, setImages] = useState<Record<string, string>>({}),
    [message, setMessage] = useState('');
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/avatar-view')
      .then(async (module) => {
        // Let the large live preview paint before compiling thumbnail materials.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
        return module.avatarThumbnails(
          (batch) => {
            if (!cancelled) setImages(batch);
          },
          () => cancelled,
        );
      })
      .catch(() => {
        if (!cancelled)
          setMessage(
            'Item pictures could not load. Select an item to preview it.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const item = SHOP_ITEMS.find((item) => item.id === selected)!,
    owned = progress.owned.includes(selected);
  return (
    <div className="star-shop">
      <div className="shop-preview">
        <AvatarPreview outfit={draft} />
        <div className="shop-balance">
          <strong>★ {starBalance(progress)}</strong>
          <span>{t('stars to spend')}</span>
        </div>
        <div className="shop-selection">
          <strong>{t(item.name)}</strong>
          <span>
            {t(owned ? 'Owned · equipped' : `Try it on · ${item.price} stars`)}
          </span>
          {!owned && (
            <button
              className="tc-primary"
              disabled={busy || starBalance(progress) < item.price}
              onClick={() =>
                void onBuy(item.id).then((ok) => {
                  if (ok) {
                    onChange(draft);
                    setMessage(`${item.name} is yours!`);
                  }
                })
              }
            >
              {t('Unlock for ★ ')}
              {item.price}
            </button>
          )}
        </div>
        <fieldset className="shop-swatches">
          <legend>{t('Body color')}</legend>
          {OUTFIT_COLORS.map((color, index) => (
            <button
              key={color}
              aria-label={t(
                `Use ${['peach', 'purple', 'mint', 'yellow', 'pink', 'blue'][index]} body color`,
              )}
              disabled={busy}
              aria-pressed={draft.color === color}
              style={{ background: color }}
              onClick={() => {
                const next = { ...draft, color };
                setDraft(next);
                if (owned) onChange(next);
              }}
            />
          ))}
        </fieldset>
        {onSave && (
          <button
            className="tc-secondary"
            disabled={busy || !owned}
            onClick={() =>
              void onSave()
                .then(() => setMessage('Outfit saved to your account.'))
                .catch((e) => setMessage(e.message))
            }
          >
            {t('Save outfit to account')}
          </button>
        )}
        <output className="shop-message">{t(message)}</output>
        <small>{t('Same speed and hitbox for every outfit.')}</small>
      </div>
      <div className="shop-catalog">
        <fieldset className="shop-tabs" aria-label={t('Accessory category')}>
          {(['body', 'head', 'eyes', 'back'] as const).map((category) => (
            <button
              key={category}
              aria-pressed={slot === category}
              onClick={() => setSlot(category)}
            >
              {t(
                {
                  body: 'Bodies',
                  head: 'Headwear',
                  eyes: 'Eyewear',
                  back: 'Back gear',
                }[category],
              )}
            </button>
          ))}
        </fieldset>
        <div className="shop-grid">
          {SHOP_ITEMS.filter((item) => item.slot === slot).map((item) => (
            <button
              className={
                'shop-tile ' + (selected === item.id ? 'selected' : '')
              }
              key={item.id}
              disabled={busy}
              aria-label={t(
                `${item.name}, ${progress.owned.includes(item.id) ? 'owned' : item.price + ' stars'}`,
              )}
              aria-pressed={selected === item.id}
              onClick={() => {
                const next = equipItem(value, item);
                setDraft(next);
                setSelected(item.id);
                if (progress.owned.includes(item.id)) onChange(next);
              }}
            >
              {images[item.id] ? (
                <img src={images[item.id]} alt={t('')} />
              ) : (
                <span className="shop-picture-loading">✦</span>
              )}
              <strong>{t(item.name)}</strong>
              <span>
                {t(
                  progress.owned.includes(item.id)
                    ? '✓ Owned'
                    : `★ ${item.price}`,
                )}
              </span>
            </button>
          ))}
        </div>
        <details className="shop-bundles">
          <summary>{t('Complete outfits')}</summary>
          {OUTFIT_BUNDLES.map((bundle) => {
            const price = SHOP_ITEMS.filter(
              (item) =>
                bundle.items.some((id) => id === item.id) &&
                !progress.owned.includes(item.id),
            ).reduce((sum, item) => sum + item.price, 0);
            return (
              <div key={bundle.id}>
                <strong>{t(bundle.name)}</strong>
                <span>
                  {bundle.items.length}
                  {t(' matching items')}
                </span>
                <button
                  disabled={busy || price > starBalance(progress)}
                  onClick={() =>
                    void onBuy(bundle.id).then((ok) => {
                      if (ok) {
                        let next = value;
                        for (const id of bundle.items)
                          next = equipItem(
                            next,
                            SHOP_ITEMS.find((item) => item.id === id)!,
                          );
                        onChange(next);
                        setDraft(next);
                        setSelected(bundle.items[0]);
                      }
                    })
                  }
                >
                  {t(price ? `Unlock ★ ${price}` : 'Equip outfit')}
                </button>
              </div>
            );
          })}
        </details>
        <p className="tc-muted">
          {t(
            'Earn up to three stars on each solo course. Improving a best time earns the difference; purchases never remove your earned course stars.',
          )}
        </p>
      </div>
    </div>
  );
}
