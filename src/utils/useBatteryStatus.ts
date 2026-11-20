import { useEffect, useState } from 'react';

interface BatteryManagerLike extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
  removeEventListener(type: 'chargingchange' | 'levelchange', listener: () => void): void;
}

export interface BatteryStatus {
  supported: boolean;
  level: number; // 0..100
  charging: boolean;
}

export function useBatteryStatus(): BatteryStatus | null {
  const [status, setStatus] = useState<BatteryStatus | null>(null);

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    if (typeof nav === 'undefined' || typeof nav.getBattery !== 'function') {
      return;
    }

    let cancelled = false;
    let manager: BatteryManagerLike | null = null;

    const update = () => {
      if (!manager || cancelled) return;
      setStatus({
        supported: true,
        level: Math.round(manager.level * 100),
        charging: !!manager.charging,
      });
    };

    nav
      .getBattery()
      .then((bat) => {
        if (cancelled) return;
        manager = bat;
        update();
        bat.addEventListener('levelchange', update);
        bat.addEventListener('chargingchange', update);
      })
      .catch(() => {
        // Ignore if blocked by browser policy
      });

    return () => {
      cancelled = true;
      if (manager) {
        manager.removeEventListener('levelchange', update);
        manager.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  return status;
}
