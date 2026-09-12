'use client';
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- Interactive WebGL canvas is described as an image; an img tag cannot contain it. */
import { useEffect, useRef } from 'react';
import type { Cosmetics } from '@/lib/cosmetics';
import type { AvatarView } from '@/lib/avatar-view';
export default function AvatarPreview({ outfit }: { outfit: Cosmetics }) {
  const container = useRef<HTMLDivElement>(null),
    view = useRef<AvatarView | null>(null),
    latest = useRef(outfit),
    pointer = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    latest.current = outfit;
    view.current?.setOutfit(outfit);
  }, [outfit]);
  useEffect(() => {
    let cancelled = false;
    void import('@/lib/avatar-view').then(({ AvatarView }) => {
      if (!cancelled && container.current)
        view.current = new AvatarView(container.current, latest.current);
    });
    return () => {
      cancelled = true;
      view.current?.dispose();
      view.current = null;
    };
  }, []);
  return (
    <div className="avatar-stage">
      <div
        className="avatar-canvas"
        ref={container}
        role="img"
        aria-label="Character preview. Drag to rotate."
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (pointer.current && view.current) {
            view.current.yaw += (e.clientX - pointer.current.x) * 0.012;
            view.current.tilt = Math.max(
              -0.3,
              Math.min(
                0.3,
                view.current.tilt + (e.clientY - pointer.current.y) * 0.006,
              ),
            );
            pointer.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onPointerUp={() => (pointer.current = null)}
        onPointerCancel={() => (pointer.current = null)}
      />
      <div className="avatar-rotate">
        <button
          type="button"
          aria-label="Rotate character left"
          onClick={() => {
            if (view.current) view.current.yaw -= Math.PI / 4;
          }}
        >
          ↶
        </button>
        <span>Drag to rotate · 360°</span>
        <button
          type="button"
          aria-label="Rotate character right"
          onClick={() => {
            if (view.current) view.current.yaw += Math.PI / 4;
          }}
        >
          ↷
        </button>
      </div>
    </div>
  );
}
