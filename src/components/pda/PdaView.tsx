import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Battery, BatteryCharging, BatteryWarning } from 'lucide-react';
import { gs } from '../../api/appsScript';
import { BroadcastItem, Employee, LiveState } from '../../types/shift';
import { buzz, notify, unlockAudio } from '../../utils/audio';
import { shrinkImage } from '../../utils/image';
import { LANGS, PdaLang, T, trStr } from '../../utils/pdaI18n';
import { useBatteryStatus } from '../../utils/useBatteryStatus';
import { NsLogo } from '../NsLogo';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  PdaBroadcastModal,
  PdaCcSheet,
  PdaHelpModal,
  PdaPhotoViewer,
  PdaProdModal,
  PdaSendHelperModal,
} from './PdaModals';
import { PdaHelpCard, PdaTlDeck, sortHelps } from './PdaTlDeck';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FONT_SCALES = [1, 1.15, 1.3, 1.5];
const FONT_LABELS = ['A', 'A+', 'A++', 'A+++'];

const QUEUEABLE: Record<string, boolean> = {
  pdaSetBreakAction: true,
  pdaRaiseHelpRequest: true,
  flAcceptHelpRequest: true,
  resolveHelpRequest: true,
  pdaRequestNonSortCount: true,
  pdaCompleteNonSortPutaway: true,
  pdaAcknowledgeBell: true,
  ackAnnouncement: true,
  tlSetNonSortCount: true,
  pdaCancelNonSort: true,
  dispatchHelperToHelpCall: true,
};

interface QueuedAction {
  name: string;
  args: unknown[];
  ok: string;
  key: string;
  ts: number;
  tries: number;
}

const lc = (s: unknown) => String(s == null ? '' : s).trim().toLowerCase();

function sget(k: string): string {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function store(k: string, v: string | null): void {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // ignore
  }
}

function stationName(st: LiveState, code: string): string {
  const d = st.taskDefinitions && st.taskDefinitions[code];
  return d && d.name ? d.name : code;
}

function stationBg(st: LiveState, code: string): string {
  const d = st.taskDefinitions && st.taskDefinitions[code];
  return d && d.headerBg ? d.headerBg : 'bg-slate-600';
}

function curStation(a: { activeStation?: string; task1?: string } | undefined, plan?: string): string {
  if (!a) return plan || '';
  if (a.activeStation && a.activeStation !== 'None') return a.activeStation;
  if (a.task1 && a.task1 !== 'None') return a.task1;
  return plan || '';
}

function fmtMMSS(ms: number): string {
  ms = Math.max(0, ms);
  let s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  s = s % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function hh(h: number): string {
  return (h < 10 ? '0' : '') + h + ':00';
}

function loadSavedQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem('pda_queue');
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

interface PdaViewProps {
  S: LiveState;
  token: string;
  empId: string;
  isTL: boolean;
  lang: PdaLang;
  onCycleLang: () => void;
  applyState: (st: LiveState) => boolean;
  onAuthFail: () => void;
  onLogout: () => void;
  onSwitchToDashboard?: () => void;
  netFails: number;
  onNetworkStatus: (isNetFail: boolean) => void;
  nowSrv: () => number;
  toast: (m: string) => void;
  toastMsg: string;
}

export const PdaView: React.FC<PdaViewProps> = ({
  S,
  token,
  empId,
  isTL,
  lang,
  onCycleLang,
  applyState,
  onAuthFail,
  onLogout,
  onSwitchToDashboard,
  netFails,
  onNetworkStatus,
  nowSrv,
  toast,
  toastMsg,
}) => {
  const tr = (s: string) => trStr(s, lang);
  const [tab, setTab] = useState<'mytask' | 'alltasks'>('mytask');
  const [rosterDay, setRosterDay] = useState('');
  const [fs, setFs] = useState<number>(() => parseInt(sget('pda_fs') || '0', 10) || 0);

  const [tick, setTick] = useState(0);
  const [isOffline, setIsOffline] = useState<boolean>(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [queue, setQueue] = useState<QueuedAction[]>(() => loadSavedQueue());
  const flushingRef = useRef(false);
  const pendingRef = useRef<Record<string, boolean>>({});

  // Modals
  const [helpOpen, setHelpOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [sendHelperId, setSendHelperId] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [bcViewId, setBcViewId] = useState('');
  const [ccSheet, setCcSheet] = useState<{
    id: string;
    mode: 'main' | 'move' | 'helper' | 'ring' | 'att';
  } | null>(null);

  // Move alert dismissed id
  const [moveSeen, setMoveSeen] = useState(() => sget('pda_move_seen'));

  // Non-Sort input
  const [nsAwb, setNsAwb] = useState('');

  // Cached Devices & Yesterday Data
  const [devData, setDevData] = useState<any>(null);
  const devLoadingRef = useRef(false);
  const devForRef = useRef('');
  const devAtRef = useRef(0);

  const [yData, setYData] = useState<any>(null);
  const yLoadingRef = useRef(false);
  const yForRef = useRef('');
  const yAtRef = useRef(0);

  // Alert state tracking
  const wakeRef = useRef<any>(null);
  const lastSummonRef = useRef('');
  const lastMoveBuzzRef = useRef('');
  const lastAnnBuzzRef = useRef<Record<string, number>>({});
  const seenHelpRef = useRef<Record<string, boolean>>({});
  const seenEscRef = useRef<Record<string, boolean>>({});
  const helpPrimedRef = useRef(false);
  const lastBreachKeyRef = useRef('');
  const myHelpWasRef = useRef('');
  const lastReadyNsRef = useRef<Record<string, boolean>>({});
  const breakWarnForRef = useRef(0);
  const bcBuzzedRef = useRef<Record<string, number>>({});
  const bcPrimedRef = useRef(false);
  const prodSigRef = useRef<string | null>(null);
  const lowBatWarnedRef = useRef(false);

  const battery = useBatteryStatus();
  const isLowBattery = !!(battery && battery.level < 20);

  useEffect(() => {
    if (!battery) return;
    if (battery.level < 20 && !battery.charging) {
      if (!lowBatWarnedRef.current) {
        lowBatWarnedRef.current = true;
        toast(tr(`Low battery (${battery.level}%) - please charge your PDA soon`));
        buzz(2);
      }
    } else if (battery.level >= 22 || battery.charging) {
      lowBatWarnedRef.current = false;
    }
  }, [battery?.level, battery?.charging]);

  const me: Employee | undefined = useMemo(
    () => (S.employees || []).find((e) => lc(e.id) === lc(empId)),
    [S.employees, empId]
  );

  // Font scale preference (apply cleanly without breaking dashboard)
  useEffect(() => {
    const idx = ((fs % 4) + 4) % 4;
    (document.documentElement.style as any).zoom = String(FONT_SCALES[idx] || 1);
    return () => {
      (document.documentElement.style as any).zoom = '1';
    };
  }, [fs]);

  // Body modal-open scroll lock
  useEffect(() => {
    const anyModal = !!(helpOpen || prodOpen || sendHelperId || photoUrl || bcViewId || ccSheet);
    document.body.classList[anyModal ? 'add' : 'remove']('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [helpOpen, prodOpen, sendHelperId, photoUrl, bcViewId, ccSheet]);

  // Keep alerts unlocked and 1-second timer for break countdown & clock
  useEffect(() => {
    unlockAudio();
    const id = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Screen WakeLock
  useEffect(() => {
    const acquireWake = () => {
      try {
        const nav = navigator as any;
        if (!token || !nav.wakeLock || document.visibilityState !== 'visible') return;
        if (wakeRef.current && !wakeRef.current.released) return;
        nav.wakeLock.request('screen').then((l: any) => {
          wakeRef.current = l;
        }).catch(() => {});
      } catch {
        // ignore
      }
    };
    acquireWake();
    const onVis = () => {
      if (!document.hidden) acquireWake();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      try {
        if (wakeRef.current) {
          wakeRef.current.release();
          wakeRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, [token]);

  // Save queue & online/offline listeners
  const saveQueue = (q: QueuedAction[]) => {
    const trimmed = q.slice(-20);
    setQueue(trimmed);
    try {
      localStorage.setItem('pda_queue', JSON.stringify(trimmed));
    } catch {
      // ignore
    }
  };

  const offlineNow = () => isOffline || netFails >= 2;

  const flushQueue = () => {
    if (flushingRef.current || !token) return;
    setQueue((currentQueue) => {
      if (!currentQueue.length) return currentQueue;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return currentQueue;
      flushingRef.current = true;
      const runNext = (items: QueuedAction[]) => {
        if (!items.length) {
          flushingRef.current = false;
          saveQueue([]);
          toast(T('sent_q', lang));
          return;
        }
        const [head, ...rest] = items;
        if (Date.now() - head.ts > 15 * 60000 || head.tries >= 3) {
          saveQueue(rest);
          runNext(rest);
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          flushingRef.current = false;
          return;
        }
        gs<any>(
          head.name,
          [token, ...head.args],
          (res) => {
            onNetworkStatus(false);
            if (res && res.code === 'AUTH') {
              flushingRef.current = false;
              saveQueue([]);
              onAuthFail();
              return;
            }
            if (res && res.success && res.state) {
              applyState(res.state);
            } else if (res && res.error) {
              toast(tr(res.error));
            }
            saveQueue(rest);
            runNext(rest);
          },
          () => {
            const updatedHead = { ...head, tries: head.tries + 1 };
            saveQueue([updatedHead, ...rest]);
            flushingRef.current = false;
          }
        );
      };
      runNext(currentQueue);
      return currentQueue;
    });
  };

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      onNetworkStatus(false);
      flushQueue();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [token]);

  // Auto-flush queue when poll succeeds
  useEffect(() => {
    if (S && S.serverNow && queue.length && !isOffline && netFails === 0) {
      flushQueue();
    }
  }, [S.serverNow]);

  const enqueue = (name: string, args: unknown[], okMsg: string, key: string) => {
    const next = [
      ...queue,
      { name, args, ok: okMsg, key: key || name, ts: Date.now(), tries: 0 },
    ];
    saveQueue(next);
    toast(T('queued', lang));
  };

  const act = (
    name: string,
    args: unknown[],
    okMsg?: string | ((r: any) => string),
    key?: string
  ) => {
    const k = key || name;
    if (pendingRef.current[k]) return;
    if (QUEUEABLE[name] && offlineNow()) {
      enqueue(name, args, typeof okMsg === 'string' ? okMsg : '', k);
      return;
    }
    pendingRef.current[k] = true;
    gs<any>(
      name,
      [token, ...args],
      (res) => {
        pendingRef.current[k] = false;
        onNetworkStatus(false);
        if (!res) return;
        if (res.code === 'AUTH') {
          onAuthFail();
          return;
        }
        if (res.success && res.state) {
          applyState(res.state);
          if (okMsg) {
            const msg = typeof okMsg === 'function' ? okMsg(res) : okMsg;
            if (msg) toast(tr(msg));
          }
        } else if (res.error) {
          toast(tr(res.error));
        }
      },
      (_msg, isNet) => {
        pendingRef.current[k] = false;
        onNetworkStatus(true);
        if (QUEUEABLE[name] && (isNet || offlineNow())) {
          enqueue(name, args, typeof okMsg === 'string' ? okMsg : '', k);
        } else {
          toast(tr('Network problem. Try again.'));
        }
      }
    );
  };

  // Load devices & yesterday productivity
  const loadDevices = (force: boolean) => {
    if (!token || devLoadingRef.current) return;
    if (!force && devForRef.current === empId && Date.now() - devAtRef.current < 2 * 60000) return;
    devLoadingRef.current = true;
    const targetId = empId;
    gs<any>(
      'pdaGetMyDevices',
      [token, targetId],
      (res) => {
        devLoadingRef.current = false;
        if (targetId !== empId) return;
        devForRef.current = targetId;
        devAtRef.current = Date.now();
        setDevData(res || { success: false });
      },
      () => {
        devLoadingRef.current = false;
        devAtRef.current = Date.now() - 100000;
      }
    );
  };

  const loadYesterday = (force = false) => {
    if (!token || yLoadingRef.current) return;
    if (!force && yForRef.current === empId && Date.now() - yAtRef.current < 10 * 60000) return;
    yLoadingRef.current = true;
    const targetId = empId;
    gs<any>(
      'pdaGetProductivity',
      [token, targetId],
      (res) => {
        yLoadingRef.current = false;
        if (targetId !== empId) return;
        yForRef.current = targetId;
        yAtRef.current = Date.now();
        setYData(res || { success: false });
      },
      () => {
        yLoadingRef.current = false;
        yAtRef.current = Date.now() - 9 * 60000;
      }
    );
  };

  useEffect(() => {
    if (token && empId) {
      loadDevices(false);
      loadYesterday(false);
    }
  }, [token, empId]);

  // Productivity sheet version notifications
  const curProdSig = S.prodVer ? S.prodVer.v || String(S.prodVer.rows) : '';
  const curProdLatest = S.prodVer ? S.prodVer.latest : '';
  useEffect(() => {
    if (!S.prodVer) return;
    const seen = sget('prod_seen_latest');
    if (curProdLatest) {
      store('prod_seen_latest', curProdLatest);
      if (seen && curProdLatest > seen) {
        toast(tr(`📈 Productivity data for ${curProdLatest} is now live`));
        buzz(2);
        notify('Productivity', `Data for ${curProdLatest} is now live`);
        yAtRef.current = 0;
        yForRef.current = '';
        loadYesterday(true);
      }
    }
    if (prodSigRef.current !== null && curProdSig !== prodSigRef.current) {
      if (!(curProdLatest && seen && curProdLatest > seen)) {
        toast('📈 Productivity sheet updated');
        buzz(1);
      }
      yAtRef.current = 0;
      yForRef.current = '';
      loadYesterday(true);
    }
    prodSigRef.current = curProdSig;
  }, [curProdSig, curProdLatest]);

  // Alert triggers (summons, moves, announcements, broadcasts, help calls, break 2min warning, non-sort ready)
  const realDay = S.currentRealDay;
  const active = !!S.isShiftActive;
  const plan = (me && me.plan && me.plan[realDay]) || 'PK';
  const a = (me && (S.assignments || {})[me.id]) || {};
  const att = (me && (S.attendance || {})[me.id]) || 'Present';
  const station = curStation(a, plan);
  const isFL = plan === 'FL' || a.task1 === 'FL' || a.activeStation === 'FL';
  const present = att === 'Present';

  const mySummon = useMemo(
    () => (me ? (S.activeSummons || []).find((s) => lc(s.targetId) === lc(me.id)) : undefined),
    [S.activeSummons, me?.id]
  );

  useEffect(() => {
    if (mySummon && lastSummonRef.current !== mySummon.id) {
      lastSummonRef.current = mySummon.id;
      buzz(4);
      notify('Supervisor calling you', mySummon.message || '');
    }
  }, [mySummon?.id]);

  const mv = a.moveNote;
  const showMove = !!(mv && mv.id && moveSeen !== mv.id);
  useEffect(() => {
    if (showMove && mv && lastMoveBuzzRef.current !== mv.id) {
      lastMoveBuzzRef.current = mv.id;
      buzz(2);
      notify('Line update', mv.text);
    }
  }, [showMove, mv?.id]);

  const activeAnns = useMemo(() => {
    if (!me || !present) return [];
    return (S.announcements || []).filter((an) => {
      if (an.ended) return false;
      if (lc(an.senderId) === lc(me.id)) return false;
      if (an.acks && an.acks[me.id]) return false;
      return an.target === 'ALL' || an.target === station;
    });
  }, [S.announcements, me?.id, station, present]);

  useEffect(() => {
    if (!activeAnns.length) return;
    const now = Date.now();
    let buzzNow = false;
    activeAnns.forEach((an) => {
      const last = lastAnnBuzzRef.current[an.id] || 0;
      if (!last || now - last >= 30000) {
        lastAnnBuzzRef.current[an.id] = now;
        buzzNow = true;
      }
    });
    if (buzzNow) {
      buzz(3);
      notify('Announcement', activeAnns[0].message);
    }
  }, [activeAnns, tick]);

  const helps = S.activeHelpRequests || [];
  useEffect(() => {
    if (!(isFL || isTL) || !present) return;
    let fresh = false;
    helps.forEach((r) => {
      if (!seenHelpRef.current[r.id]) {
        seenHelpRef.current[r.id] = true;
        if (helpPrimedRef.current) fresh = true;
      }
      if (r.escalated && !seenEscRef.current[r.id]) {
        seenEscRef.current[r.id] = true;
        buzz(7);
        notify('Help call NOT accepted', `${r.empName} @ ${r.location} is waiting`);
      }
    });
    helpPrimedRef.current = true;
    if (fresh) {
      buzz(4);
      notify('Help call', 'A colleague needs help');
    }
  }, [helps, isFL, isTL, present]);

  useEffect(() => {
    if (!isTL) return;
    const key = (S.minStaffBreaches || []).map((b) => b.code).sort().join(',');
    if (key && key !== lastBreachKeyRef.current) {
      buzz(4);
      notify('Minimum staff breached', key);
    }
    lastBreachKeyRef.current = key;
  }, [S.minStaffBreaches, isTL]);

  // Notify CC if their help call was cleared by someone else
  const myHelp = useMemo(
    () => (me ? helps.find((r) => lc(r.empId) === lc(me.id)) : undefined),
    [helps, me?.id]
  );
  useEffect(() => {
    if (!me) return;
    if (myHelpWasRef.current && !myHelp) {
      const done = (S.helpLog || []).find(
        (h) => h.helpId === myHelpWasRef.current && h.type === 'cleared'
      );
      if (done && lc(done.by) !== lc(me.name)) {
        const actor =
          done.byRole === 'Dashboard' ? 'Supervisor' : `${done.by} (${done.byRole})`;
        toast(tr(`Your help call was cleared by ${actor}`));
        buzz(1);
      }
    }
    myHelpWasRef.current = myHelp ? myHelp.id : '';
  }, [myHelp?.id, S.helpLog]);

  // Ready Non-Sort buzz
  const myNsList = useMemo(
    () => (me ? (S.nonSortRequests || []).filter((r) => lc(r.empId) === lc(me.id)) : []),
    [S.nonSortRequests, me?.id]
  );
  useEffect(() => {
    myNsList.forEach((r) => {
      if (r.status === 'ready' && !lastReadyNsRef.current[r.id]) {
        lastReadyNsRef.current[r.id] = true;
        buzz(2);
      }
    });
  }, [myNsList]);

  // Break 2-min warning
  const nowSrvMs = nowSrv();
  const breakDiff = a.onBreak && a.breakEndTime ? a.breakEndTime - nowSrvMs : 0;
  useEffect(() => {
    if (!isTL && a.onBreak && a.breakEndTime && breakDiff > 0 && breakDiff <= 120000) {
      if (breakWarnForRef.current !== a.breakEndTime) {
        breakWarnForRef.current = a.breakEndTime;
        buzz(3);
        toast(T('brk_2min', lang));
        notify('Break', T('brk_2min', lang));
      }
    }
  }, [isTL, a.onBreak, a.breakEndTime, breakDiff <= 120000]);

  // Broadcast unseen / read tracking
  const bcList = S.broadcasts || [];
  const unseenBc: BroadcastItem[] = useMemo(() => {
    if (!me) return [];
    const myIdLc = lc(me.id);
    return bcList
      .filter((b) => (b.unseen || []).some((u) => lc(u.id) === myIdLc))
      .slice()
      .sort((x, y) => Number(y.priority === 'urgent') - Number(x.priority === 'urgent') || x.ts - y.ts);
  }, [bcList, me?.id]);

  const seenBc = useMemo(() => {
    if (!me) return [];
    return bcList.filter((b) => b.acks && b.acks[me.id]);
  }, [bcList, me?.id]);

  useEffect(() => {
    if (!me) return;
    unseenBc.forEach((b) => {
      const p = b.ping || 0;
      if (bcBuzzedRef.current[b.id] == null) {
        bcBuzzedRef.current[b.id] = p;
        if (bcPrimedRef.current) {
          buzz(b.priority === 'urgent' ? 6 : 3);
          notify(b.priority === 'urgent' ? 'URGENT message' : 'New message', b.title || b.message || 'Photo');
        } else {
          buzz(b.priority === 'urgent' ? 6 : 2);
        }
      } else if (p > bcBuzzedRef.current[b.id]) {
        bcBuzzedRef.current[b.id] = p;
        buzz(5);
        notify('Reminder: please read', b.title || b.message || 'Photo');
      }
    });
    bcPrimedRef.current = true;
  }, [unseenBc, me?.id]);

  // Repeat urgent broadcast buzz every 25s
  const bcUrgentOpen = unseenBc.some((b) => b.priority === 'urgent');
  useEffect(() => {
    if (!bcUrgentOpen) return;
    const id = setInterval(() => {
      if (!document.hidden) buzz(3);
    }, 25000);
    return () => clearInterval(id);
  }, [bcUrgentOpen]);

  const viewBcItem = bcViewId ? bcList.find((b) => b.id === bcViewId) || null : null;
  const activeBcModalItem = unseenBc.length ? unseenBc[0] : viewBcItem;
  const activeBcReadOnly = !unseenBc.length && !!viewBcItem;

  // Network banner message
  const netTxt = (() => {
    const n = queue.length;
    if (isOffline) return T('net_off', lang) + (n ? ` (${n} ${T('net_q', lang)})` : '');
    if (netFails >= 2) return T('net_weak', lang) + (n ? ` (${n} ${T('net_q', lang)})` : '');
    if (n) return `${n} ${T('net_q', lang)}`;
    return '';
  })();

  const currentLangLabel = (LANGS.find((x) => x[0] === lang) || LANGS[0])[1];

  const enableAlerts = () => {
    unlockAudio();
    buzz(1);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {
      // ignore
    }
    toast(tr('Alerts enabled'));
  };

  // Attach photo to active help request
  const handleMyHelpPhoto = (file: File | undefined) => {
    if (!file || !myHelp) return;
    toast(tr('Uploading photo...'));
    shrinkImage(
      file,
      (dataUrl) => {
        gs<{ success?: boolean; imageId?: string; error?: string }>(
          'pdaUploadHelpPhoto',
          [token, empId, dataUrl],
          (res) => {
            if (res && res.success && res.imageId) {
              act(
                'pdaAttachHelpPhoto',
                [empId, myHelp.id, res.imageId],
                'Photo added to your call',
                'hp-' + myHelp.id
              );
            } else {
              toast(tr((res && res.error) || 'Photo upload failed.'));
            }
          },
          () => toast(tr('Photo upload failed.'))
        );
      },
      () => toast(tr('Could not read that photo.'))
    );
  };

  // Render helpers for Yesterday card
  const renderYesterday = () => {
    if (!yData) return <div className="text-xs text-slate-400">...</div>;
    if (!yData.success)
      return <span className="text-xs text-amber-300">{T('y_err', lang)}</span>;
    if (!yData.found)
      return <span className="text-xs italic text-slate-400">{T('y_none', lang)}</span>;

    const types = Object.keys(yData.types || {}).sort((x, y) => yData.types[y] - yData.types[x]);
    const hoursList: { h: number; qty: number }[] = yData.hours || [];
    const maxH = Math.max(1, ...hoursList.map((x) => x.qty));
    const trList: { date: string; tph: number; hours: number }[] = yData.trend || [];
    const mx7 = Math.max(1, ...trList.map((x) => x.tph));

    return (
      <div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black text-sky-300">{yData.total}</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase">{T('y_total', lang)}</div>
          </div>
          <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
            {types.map((t) => (
              <span
                key={t}
                className="text-[10px] font-black bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
              >
                {t.replace(/_/g, ' ')}: {yData.types[t]}
              </span>
            ))}
          </div>
        </div>

        {hoursList.length > 0 && (
          <div className="flex items-end gap-0.5 h-12 mt-2.5">
            {hoursList.map((x) => (
              <div key={x.h} className="flex-1 flex flex-col items-center justify-end min-w-0">
                <div
                  className="w-full bg-sky-600 rounded-sm"
                  style={{ height: `${Math.max(3, Math.round((x.qty / maxH) * 36))}px` }}
                />
                <div className="text-[8px] text-slate-500 mt-0.5">{x.h}</div>
              </div>
            ))}
          </div>
        )}

        {(yData.ach != null || yData.vsPrev) && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {yData.ach != null && (
              <span
                className={`text-[10px] font-black rounded px-1.5 py-0.5 border ${
                  yData.ok ? 'border-emerald-500 text-emerald-300' : 'border-rose-500 text-rose-300'
                }`}
              >
                {tr(`🎯 ${Math.round(yData.ach * 100)}% of target`)}
              </span>
            )}
            {yData.vsPrev && (
              <span
                className={`text-[10px] font-black rounded px-1.5 py-0.5 text-white ${
                  yData.vsPrev.deltaPct > 0
                    ? 'bg-emerald-700'
                    : yData.vsPrev.deltaPct < 0
                    ? 'bg-rose-700'
                    : 'bg-slate-600'
                }`}
              >
                {yData.vsPrev.deltaPct > 0
                  ? tr(`▲ ${yData.vsPrev.deltaPct}% better than ${yData.vsPrev.prevDate}`)
                  : yData.vsPrev.deltaPct < 0
                  ? tr(`▼ ${-yData.vsPrev.deltaPct}% lower than ${yData.vsPrev.prevDate}`)
                  : tr(`= same as ${yData.vsPrev.prevDate}`)}
              </span>
            )}
          </div>
        )}

        {(yData.gaps || []).length > 0 && (
          <div className="mt-2 text-[11px] font-bold text-rose-400">
            {tr(`⚠ No entries at ${(yData.gaps as number[]).map(hh).join(', ')}`)}
          </div>
        )}

        {trList.some((x) => x.hours > 0) && (
          <>
            <div className="mt-3 text-[10px] font-bold uppercase text-slate-500">
              {tr('Last 7 days (TPH)')}
            </div>
            <div className="flex items-end gap-1 h-14 mt-1">
              {trList.map((x, i) => {
                const last = i === trList.length - 1;
                return (
                  <div key={x.date} className="flex-1 flex flex-col items-center justify-end min-w-0">
                    <div className="text-[8px] text-slate-400">
                      {x.hours ? Math.round(x.tph) : '-'}
                    </div>
                    <div
                      className={`w-full rounded-sm ${
                        x.hours ? (last ? 'bg-sky-400' : 'bg-slate-500') : 'bg-slate-800'
                      }`}
                      style={{
                        height: `${x.hours ? Math.max(3, Math.round((x.tph / mx7) * 30)) : 2}px`,
                      }}
                    />
                    <div className="text-[8px] text-slate-500">{x.date.slice(8)}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // Render All Tasks tab
  const renderAllTasks = () => {
    const selDay = rosterDay || realDay;
    const isToday = selDay === realDay;
    const meNameLc = me ? lc(me.name) : '';
    const lb = S.sheetLeaderboard || [];
    const emps = S.employees || [];
    const assigns = S.assignments || {};
    const attMap = S.attendance || {};
    const codes = Object.keys(S.taskDefinitions || {});
    const withPeople: string[] = [];
    const empty: string[] = [];
    const rows: Record<string, Employee[]> = {};

    codes.forEach((code) => {
      const ws = emps.filter((e) => {
        if (isToday) {
          if (attMap[e.id] !== 'Present') return false;
          return curStation(assigns[e.id] || {}, '') === code;
        }
        return e.plan && e.plan[selDay] === code;
      });
      rows[code] = ws;
      (ws.length ? withPeople : empty).push(code);
    });

    const wo = isToday
      ? emps.filter((e) => attMap[e.id] === 'WO').map((e) => e.name)
      : emps.filter((e) => e.plan && e.plan[selDay] === 'WO').map((e) => e.name);
    const lv = isToday
      ? emps
          .filter((e) => attMap[e.id] === 'LV' || attMap[e.id] === 'AB')
          .map((e) => `${e.name} (${attMap[e.id] === 'AB' ? tr('Absent') : tr('Leave')})`)
      : [];
    const eo = isToday
      ? emps
          .filter((e) => attMap[e.id] === 'EO')
          .map((e) => {
            const det = (S.attendanceDetail || {})[e.id];
            return det && det.left ? tr(`${e.name} - left ${det.left.time}`) : e.name;
          })
      : [];

    const offGroup = (title: string, list: string[], cls: string) =>
      list.length > 0 ? (
        <div key={title} className="bg-slate-800/70 border border-slate-700 rounded-2xl p-3.5">
          <div className={`text-[10px] font-black uppercase tracking-wider ${cls} mb-1.5`}>
            {tr(title)} ({list.length})
          </div>
          {list.map((x, idx) => (
            <div key={idx} className="text-xs text-slate-200 py-0.5">
              {x}
            </div>
          ))}
        </div>
      ) : null;

    return (
      <div className="space-y-3">
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {tr('Day')}
            </span>
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-sky-700 text-white">
              {tr(selDay)} {isToday ? `(${tr('Today')})` : '(Plan)'}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAYS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setRosterDay(d)}
                className={`relative py-1.5 rounded-lg text-[10px] font-black ${
                  d === selDay
                    ? 'bg-sky-700 text-white'
                    : 'bg-slate-900 text-slate-400 border border-slate-700'
                }`}
              >
                {tr(d)}
                {d === realDay && (
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/90 border border-indigo-500/40 rounded-2xl p-3.5 shadow-lg">
          <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-700">
            <h3 className="text-xs font-black text-white">
              {tr('📊 Non Sort leaderboard (today)')}
            </h3>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              {tr('Sheet sync')}
            </span>
          </div>
          <div className="space-y-1.5">
            {lb.length ? (
              lb.map((it, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const isMe = lc(it.empName) === meNameLc;
                return (
                  <div
                    key={it.empName + '-' + i}
                    className={`flex items-center justify-between p-2 rounded-xl border ${
                      isMe ? 'bg-sky-950/70 border-sky-600/60' : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs w-5 text-center shrink-0">{medal}</span>
                      <span className="text-xs font-bold text-white truncate">{it.empName}</span>
                      {isMe && (
                        <span className="text-[9px] font-black px-1.5 rounded bg-sky-700 text-white shrink-0">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                        {it.awbs} AWB
                      </span>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        {it.totalCount} {tr('Qty')}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 italic py-1">
                {tr('No Non Sort putaways yet today.')}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          {withPeople.concat(empty).map((code) => {
            const ws = rows[code];
            return (
              <div
                key={code}
                className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 shadow-md"
              >
                <div
                  className={`flex items-center justify-between ${
                    ws.length ? 'mb-2.5 pb-2 border-b border-slate-700/70' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-md text-white ${stationBg(
                        S,
                        code
                      )}`}
                    >
                      {code}
                    </span>
                    <span className="text-xs font-black text-white">
                      {tr(stationName(S, code))}
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-900 text-slate-300 border border-slate-700">
                    {ws.length}
                  </span>
                </div>
                {ws.map((w) => {
                  const wa = assigns[w.id] || {};
                  const isMe = me && lc(w.id) === lc(me.id);
                  return (
                    <div key={w.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`font-bold truncate ${
                            isMe ? 'text-sky-300' : 'text-slate-100'
                          }`}
                        >
                          {w.name}
                          {isMe ? ' (You)' : ''}
                        </span>
                        {isToday && wa.isHelping && (
                          <span className="text-[9px] font-black px-1.5 rounded-full bg-amber-500 text-slate-950">
                            {tr('Helper')}
                          </span>
                        )}
                        {isToday && wa.swappedFrom && (
                          <span className="text-[9px] font-black px-1.5 rounded-full bg-indigo-500 text-white">
                            Covering
                          </span>
                        )}
                      </div>
                      {isToday ? (
                        wa.onBreak ? (
                          <span className="text-[10px] font-bold text-amber-400">
                            {tr('On break')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">{tr('Assigned')}</span>
                        )
                      ) : (
                        <span className="text-[10px] text-slate-400">{tr('Planned')}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {offGroup('Week off', wo, 'text-slate-400')}
          {offGroup('Leave / Absent', lv, 'text-rose-300')}
          {offGroup('Left early', eo, 'text-amber-300')}
        </div>
      </div>
    );
  };

  // Off-day banner config
  const offCfg = ({
    WO: [
      'Scheduled Rest Day',
      'Enjoy your day off.',
      'border-slate-600 bg-slate-800 text-slate-200',
    ],
    LV: [
      'On Leave',
      'You are marked on leave today.',
      'border-sky-700 bg-sky-950/60 text-sky-200',
    ],
    AB: [
      'Marked Absent',
      'Speak to your team lead if this is a mistake.',
      'border-rose-700 bg-rose-950/60 text-rose-200',
    ],
    EO: [
      'Early out recorded',
      'You have left for the day.',
      'border-amber-700 bg-amber-950/60 text-amber-200',
    ],
  } as Record<string, [string, string, string]>)[att] || [
    'Off duty',
    '',
    'border-slate-600 bg-slate-800 text-slate-200',
  ];

  // Help activity (for FL + TL)
  const actLog = (S.helpLog || []).filter((h) => h.type !== 'raised').slice(0, 4);

  // Regular CC stats
  const lbMe = me
    ? (S.sheetLeaderboard || []).find((x) => lc(x.empName) === lc(me.name))
    : undefined;
  const breakMinsMe = me ? (S.breakMins || {})[me.id] || 0 : 0;
  const helpCountMe = me ? (S.helpCount || {})[me.id] || 0 : 0;
  const canAct = active && present;
  const onBreak = !!a.onBreak;
  const nsLocked = !canAct || onBreak;

  const roleDesc = !present
    ? ''
    : a.isHelping
    ? tr(`Deployed as helper (base ${a.originalStation || ''})`)
    : a.swappedFrom
    ? tr(`Covering (planned ${a.swappedFrom})`)
    : tr('Primary duty station');

  const helpBannerText = myHelp
    ? myHelp.helperName
      ? tr(`${myHelp.helperName} is coming to ${myHelp.location}`)
      : myHelp.status === 'accepted'
      ? tr(
          `Accepted by ${myHelp.acceptedBy || ''}${
            myHelp.acceptedByRole ? ` (${myHelp.acceptedByRole})` : ''
          } - on the way (${myHelp.location})`
        )
      : tr(`Waiting for a Floor Lead (${myHelp.location})...`)
    : '';

  return (
    <div className="bg-slate-900 text-slate-100 font-sans antialiased min-h-screen pb-16">
      {/* HEADER */}
      <header className="bg-slate-950 border-b-2 border-[#FEEE00]/80 p-3 sticky top-0 z-40 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <NsLogo size={32} className="rounded-lg shrink-0" />
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight text-white leading-tight truncate">
              {tr('Warehouse PDA')}
            </h1>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  active ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="truncate">
                {tr(
                  `Shift A • ${active ? 'Active (12 AM - 9 AM)' : 'Closed (view only)'}`
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {battery && (
            <div
              title={
                isLowBattery
                  ? tr(`Low battery (${battery.level}%) - please charge your PDA soon`)
                  : `${battery.level}%${battery.charging ? ' (Charging)' : ''}`
              }
              aria-label={`Battery ${battery.level}%${isLowBattery ? ' warning' : ''}`}
              className={`px-2 py-1 rounded-lg flex items-center gap-1 text-[10px] font-black border ${
                isLowBattery && !battery.charging
                  ? 'bg-rose-600 text-white border-rose-300 animate-pulse-alert'
                  : isLowBattery && battery.charging
                  ? 'bg-amber-500 text-slate-950 border-amber-300'
                  : battery.charging
                  ? 'bg-emerald-900/80 text-emerald-200 border-emerald-700'
                  : 'bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              {battery.charging ? (
                <BatteryCharging className="w-3.5 h-3.5 shrink-0" />
              ) : isLowBattery ? (
                <BatteryWarning className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <Battery className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{battery.level}%</span>
            </div>
          )}
          <button
            type="button"
            onClick={enableAlerts}
            className="px-2 py-1 text-[10px] font-black rounded-lg bg-emerald-700 text-white"
          >
            {tr('🔊 Alerts ready')}
          </button>
          {isTL && onSwitchToDashboard && (
            <button
              type="button"
              onClick={onSwitchToDashboard}
              className="px-2.5 py-1 bg-[#FEEE00] text-[#14213f] rounded-lg text-[11px] font-black"
            >
              {tr('Switch to Dashboard')}
            </button>
          )}
          <button
            type="button"
            onClick={onLogout}
            className="px-2.5 py-1 bg-slate-800 rounded-lg text-slate-300 text-xs font-bold"
          >
            {tr('Logout')}
          </button>
        </div>
      </header>

      {/* STICKY TABS */}
      <div className="bg-slate-950/95 border-b border-slate-800 p-1.5 flex gap-1.5 sticky top-[56px] z-30">
        <button
          type="button"
          onClick={() => setTab('mytask')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black ${
            tab === 'mytask'
              ? 'bg-sky-700 text-white'
              : 'text-slate-400 bg-slate-900 border border-slate-800'
          }`}
        >
          {T('tab_my', lang)}
        </button>
        <button
          type="button"
          onClick={() => setTab('alltasks')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black ${
            tab === 'alltasks'
              ? 'bg-sky-700 text-white'
              : 'text-slate-400 bg-slate-900 border border-slate-800'
          }`}
        >
          {T('tab_all', lang)}
        </button>
      </div>

      {/* LOW BATTERY WARNING BANNER */}
      {isLowBattery && battery && !battery.charging && (
        <div className="bg-rose-600 text-white text-[11px] font-black text-center py-1.5 px-3 flex items-center justify-center gap-1.5 animate-pulse-alert">
          <BatteryWarning className="w-3.5 h-3.5 shrink-0" />
          <span>{tr(`Low battery (${battery.level}%) - please charge your PDA soon`)}</span>
        </div>
      )}

      {/* NETWORK / OFFLINE CHIP */}
      {netTxt && (
        <div className="bg-amber-600 text-slate-950 text-[11px] font-black text-center py-1.5 px-3 sticky top-[97px] z-[35]">
          {netTxt}
        </div>
      )}

      {/* PREFS STRIP */}
      <div className="max-w-md mx-auto px-3.5 pt-2 flex items-center justify-between gap-1.5">
        <PWAInstallButton compact />
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={onCycleLang}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black text-slate-200"
          >
            &#127760; {currentLangLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = (fs + 1) % 4;
              setFs(next);
              store('pda_fs', String(next));
            }}
            className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-black text-slate-200"
          >
            {FONT_LABELS[((fs % 4) + 4) % 4]}
          </button>
        </div>
      </div>

      {/* TOAST */}
      {toastMsg && (
        <div className="fixed top-3 left-4 right-4 z-[60] bg-slate-700 text-white py-2 px-3 rounded-xl shadow-2xl text-center text-xs font-bold">
          {tr(toastMsg)}
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="p-3.5 max-w-md mx-auto space-y-3.5">
        {tab === 'mytask' && me && (
          <div className="space-y-3.5">
            {/* SUMMON ALARM */}
            {mySummon && (
              <div className="bg-gradient-to-r from-rose-700 to-red-800 text-white p-4 rounded-3xl shadow-2xl animate-emergency border-2 border-rose-300">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase text-rose-200">
                      {tr('🔔 Supervisor calling you')}
                    </div>
                    <div className="text-sm font-black text-white mt-1">
                      {tr(`${mySummon.tlName || 'Supervisor'} is calling you`)}
                    </div>
                    {mySummon.message && (
                      <p className="text-xs font-bold text-amber-200 mt-0.5">
                        {tr(mySummon.message)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => act('pdaAcknowledgeBell', [empId], 'Acknowledged')}
                    className="px-3.5 py-2 bg-emerald-600 text-white font-black rounded-2xl text-xs shadow-lg active:scale-95 shrink-0"
                  >
                    {tr('✔ Acknowledge')}
                  </button>
                </div>
              </div>
            )}

            {/* ANNOUNCEMENTS */}
            {activeAnns.length > 0 && (
              <div className="space-y-2">
                {activeAnns.map((an) => (
                  <div
                    key={an.id}
                    className="bg-indigo-900 border-2 border-indigo-300 text-white p-3.5 rounded-2xl shadow-xl animate-pulse-alert"
                  >
                    <div className="text-[10px] font-black uppercase text-indigo-200">
                      {tr(
                        `📢 Announcement from ${an.sender} • ${
                          an.target === 'ALL' ? 'Everyone' : an.target
                        }`
                      )}
                    </div>
                    <p className="text-sm font-bold mt-1 break-words">{an.message}</p>
                    <button
                      type="button"
                      onClick={() =>
                        act('ackAnnouncement', [empId, an.id], 'Thanks', 'ack-' + an.id)
                      }
                      className="mt-2.5 w-full py-2 bg-emerald-600 text-white font-black rounded-xl text-xs active:scale-95"
                    >
                      {tr('✔ Got it')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* READ BROADCAST MESSAGES */}
            {seenBc.length > 0 && (
              <div className="bg-slate-800/95 border border-sky-700/50 rounded-3xl p-3.5 shadow-lg space-y-2">
                <div className="text-[11px] font-black text-sky-300 uppercase">
                  {tr(`📢 Messages (${seenBc.length})`)}
                </div>
                {seenBc.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    onClick={() => setBcViewId(b.id)}
                    className={`w-full flex items-center gap-2 text-left px-2.5 py-2 rounded-xl bg-slate-900/80 border ${
                      b.priority === 'urgent' ? 'border-rose-700' : 'border-slate-700'
                    }`}
                  >
                    <span className="text-base">
                      {b.imageUrl ? '📷' : b.priority === 'urgent' ? '🚨' : '📢'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-black text-white truncate">
                        {b.title || b.message || 'Photo'}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {b.sender} &bull; {b.timeStr}
                      </span>
                    </span>
                    <span className="text-slate-500">&rsaquo;</span>
                  </button>
                ))}
              </div>
            )}

            {/* LINE MOVE BANNER */}
            {showMove && mv && (
              <div className="bg-sky-900 border-2 border-sky-400 text-white p-3.5 rounded-2xl shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase text-sky-200">
                      {tr('Line update')}
                    </div>
                    <div className="text-xs font-bold mt-0.5">{tr(mv.text)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      store('pda_move_seen', mv.id);
                      setMoveSeen(mv.id);
                    }}
                    className="px-3 py-1.5 bg-sky-600 text-white font-black rounded-xl text-xs shrink-0"
                  >
                    {tr('OK')}
                  </button>
                </div>
              </div>
            )}

            {/* OFF-DAY BANNER */}
            {!present && (
              <div className={`p-3.5 rounded-2xl border text-center ${offCfg[2]}`}>
                <div className="text-sm font-black">{tr(offCfg[0])}</div>
                <div className="text-[11px] mt-0.5 opacity-80">{tr(offCfg[1])}</div>
              </div>
            )}

            {/* CLOSED BANNER */}
            {!active && (
              <div className="p-3 rounded-2xl border border-amber-700/70 bg-amber-950/50 text-amber-200 text-center text-xs font-bold">
                {tr('Shift is closed. View only - break, help and requests are disabled.')}
              </div>
            )}

            {/* FL HELP ALERTS */}
            {isFL && !isTL && helps.length > 0 && (
              <div className="bg-rose-950/90 border-2 border-rose-500 rounded-3xl p-4 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-rose-200 uppercase">
                    {tr('🚨 Floor Help Calls')}
                  </h3>
                  <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {helps.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {sortHelps(helps, me.id).map((r) => (
                    <PdaHelpCard
                      key={r.id}
                      r={r}
                      empId={me.id}
                      tl={false}
                      lang={lang}
                      onAccept={(id) =>
                        act('flAcceptHelpRequest', [id, me.id], 'Help call accepted', 'acc-' + id)
                      }
                      onClear={(id) =>
                        act('resolveHelpRequest', [id], 'Help call cleared', 'clr-' + id)
                      }
                      onPhotoOpen={setPhotoUrl}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* HELP ACTIVITY (FL + TL) */}
            {(isFL || isTL) && actLog.length > 0 && (
              <div className="bg-slate-800/95 border border-emerald-700/60 rounded-3xl p-3.5 shadow-lg">
                <h3 className="text-[11px] font-black text-emerald-300 uppercase mb-2">
                  {tr('📋 Help activity')}
                </h3>
                <div className="space-y-1.5">
                  {actLog.map((h) => {
                    const actor =
                      h.byRole === 'Dashboard'
                        ? tr('Supervisor (Dashboard)')
                        : `${h.by} (${h.byRole})`;
                    const where = `${h.empName} @ ${h.location}`;
                    const txt =
                      h.type === 'accepted'
                        ? tr(`${actor} accepted ${where}`)
                        : h.type === 'dispatched'
                        ? tr(`${actor} sent ${h.helperName || 'a helper'} to ${where}`)
                        : tr(`${actor} cleared ${where}`);
                    const ic =
                      h.type === 'accepted' ? '🤝' : h.type === 'dispatched' ? '🚶' : '✅';
                    return (
                      <div
                        key={h.id}
                        className={`text-[11px] font-bold text-slate-200 bg-slate-950/70 border ${
                          h.type === 'cleared' ? 'border-emerald-700' : 'border-sky-700'
                        } rounded-xl px-2.5 py-1.5`}
                      >
                        {ic} {txt}{' '}
                        <span className="text-slate-500 font-semibold">&bull; {h.timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TL COMMAND DECK OR REGULAR CC/FL */}
            {isTL ? (
              <PdaTlDeck
                st={S}
                me={me}
                token={token}
                active={active}
                nowSrvMs={nowSrvMs}
                lang={lang}
                toast={toast}
                applyState={applyState}
                onAuthFail={onAuthFail}
                onAct={act}
                onOpenCcSheet={(id) => setCcSheet({ id, mode: 'main' })}
                onOpenSendHelper={setSendHelperId}
                onOpenProd={() => setProdOpen(true)}
                onPhotoOpen={setPhotoUrl}
              />
            ) : (
              <div className="space-y-3.5">
                {/* PROFILE & STATION */}
                <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-sky-400 uppercase">
                        {tr('Logged in')}
                      </span>
                      <h2 className="text-sm font-black text-white truncate">{me.name}</h2>
                      <span className="text-[10px] text-slate-400 font-mono">{me.id}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-slate-400 block">
                        {tr("Today's plan")}
                      </span>
                      <span className="text-xs font-black text-[#14213f] bg-[#FEEE00] px-2 py-0.5 rounded-lg inline-block mt-0.5">
                        {plan}
                      </span>
                    </div>
                  </div>
                  <div className="pt-3">
                    <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-xl flex items-center gap-2.5">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-lg text-white ${
                          present ? stationBg(S, station) : 'bg-slate-600'
                        }`}
                      >
                        {present ? station : '-'}
                      </span>
                      <div>
                        <div className="text-xs font-black text-white">
                          {present ? tr(stationName(S, station)) : tr('Off duty')}
                        </div>
                        <div className="text-[10px] text-slate-400">{roleDesc}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* SHIFT BREAK */}
                <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-black text-white">
                      {T('brk_title', lang)}{' '}
                      <span className="text-slate-400 font-bold">
                        {tr(`(${S.breakDurationSetting || 50} min)`)}
                      </span>
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                      {onBreak
                        ? breakDiff > 0
                          ? tr('ON BREAK')
                          : tr('OVERTIME')
                        : a.breakStatus === 'completed'
                        ? tr('COMPLETED')
                        : tr('PENDING')}
                    </span>
                  </div>

                  {!onBreak && a.breakStatus !== 'completed' && (
                    <button
                      type="button"
                      disabled={!canAct}
                      onClick={() => act('pdaSetBreakAction', [empId, 'start'], 'Break started')}
                      className="w-full py-3 bg-amber-500 text-slate-950 font-black rounded-xl text-xs active:scale-95 disabled:opacity-40"
                    >
                      {T('brk_start', lang)}
                    </button>
                  )}

                  {onBreak && (
                    <div className="space-y-3 p-3.5 rounded-2xl border border-amber-500/80 bg-amber-950/40">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          {breakDiff > 0 ? T('brk_left', lang) : T('brk_over', lang)}
                        </span>
                        <span
                          className={`text-lg font-black font-mono ${
                            breakDiff <= 0
                              ? 'text-rose-300'
                              : breakDiff <= 120000
                              ? 'text-orange-300 animate-pulse'
                              : 'text-amber-300'
                          }`}
                        >
                          {breakDiff > 0 ? fmtMMSS(breakDiff) : '+' + fmtMMSS(-breakDiff)}
                        </span>
                      </div>
                      {breakDiff <= 0 && (
                        <div className="text-xs font-black text-rose-300 bg-rose-950/80 border border-rose-600 rounded-lg p-2 text-center">
                          {tr(
                            `Your break is over by ${Math.ceil(
                              -breakDiff / 60000
                            )} min. Please return to your station now.`
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        disabled={!active}
                        onClick={() =>
                          act('pdaSetBreakAction', [empId, 'end'], (r) =>
                            r && r.overtimeMins > 0
                              ? `Break ended (+${r.overtimeMins} min overtime logged)`
                              : 'Break completed on time'
                          )
                        }
                        className="w-full py-2.5 bg-emerald-600 text-white font-black rounded-xl text-xs active:scale-95 disabled:opacity-40"
                      >
                        {T('brk_end', lang)}
                      </button>
                    </div>
                  )}

                  {!onBreak && a.breakStatus === 'completed' && (
                    <div className="p-3 bg-emerald-950 text-emerald-300 rounded-xl text-center text-xs font-bold">
                      {T('brk_done', lang)}
                    </div>
                  )}
                </div>

                {/* YOUR HELP REQUEST */}
                {myHelp && (
                  <div className="p-3.5 rounded-2xl border-2 border-amber-400 bg-amber-950/60">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-black uppercase text-amber-300">
                          {T('my_help', lang)}
                        </div>
                        <div className="text-xs font-bold text-white mt-0.5">{helpBannerText}</div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <label className="px-2.5 py-1.5 bg-slate-800 text-sky-200 font-bold rounded-lg text-[10px] text-center cursor-pointer active:scale-95">
                          {tr('📷 Add photo')}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files && e.target.files[0];
                              e.target.value = '';
                              handleMyHelpPhoto(f || undefined);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            act('resolveHelpRequest', [myHelp.id], 'Help request cancelled')
                          }
                          className="px-2.5 py-1.5 bg-slate-800 text-slate-200 font-bold rounded-lg text-[10px]"
                        >
                          {T('cancel', lang)}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* NEED FLOOR HELP */}
                <div
                  className="bg-slate-800/90 border border-rose-900 rounded-2xl p-3.5 shadow-lg flex items-center justify-between"
                  style={{ opacity: !canAct || onBreak ? 0.45 : 1 }}
                >
                  <div>
                    <h3 className="text-xs font-black text-rose-300">{T('help_title', lang)}</h3>
                    <p className="text-[10px] text-slate-400">{T('help_sub', lang)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canAct || onBreak}
                    onClick={() => setHelpOpen(true)}
                    className="px-3.5 py-2 bg-rose-700 text-white font-black rounded-xl text-xs active:scale-95 disabled:opacity-40"
                  >
                    {T('help_btn', lang)}
                  </button>
                </div>

                {/* NON SORT PUTAWAY */}
                <div
                  className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 shadow-lg space-y-3"
                  style={{ opacity: nsLocked ? 0.5 : 1 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-black text-white">
                      {tr('📦 Non Sort Putaway')}
                    </h3>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {tr(
                        `My today: ${lbMe ? lbMe.awbs : 0} AWBs • ${
                          lbMe ? lbMe.totalCount : 0
                        } Qty`
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      disabled={nsLocked}
                      value={nsAwb}
                      onChange={(e) => setNsAwb(e.target.value)}
                      placeholder={tr('Scan or type AWB...')}
                      className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-sky-500 disabled:opacity-40"
                    />
                    <button
                      type="button"
                      disabled={nsLocked}
                      onClick={() => {
                        const awb = nsAwb.trim();
                        if (!awb) {
                          toast(tr('Enter or scan an AWB first.'));
                          return;
                        }
                        setNsAwb('');
                        act(
                          'pdaRequestNonSortCount',
                          [empId, awb],
                          'AWB sent. Waiting for the TL count...'
                        );
                      }}
                      className="px-3.5 py-2 bg-indigo-700 text-white font-bold rounded-xl text-xs active:scale-95 disabled:opacity-40"
                    >
                      {tr('Search')}
                    </button>
                  </div>

                  {myNsList.length > 0 && (
                    <div className="space-y-2">
                      {myNsList.map((r) =>
                        r.status === 'pending' ? (
                          <div
                            key={r.id}
                            className="p-2.5 bg-indigo-950/60 border border-indigo-800 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-mono font-bold text-indigo-300">{r.awb}</div>
                              <div className="text-[10px] text-slate-400">
                                {tr('Waiting for the TL count...')}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-amber-400 animate-pulse">
                                {tr('Pending')}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  act('pdaCancelNonSort', [r.id], 'Request removed', 'nsx-' + r.id)
                                }
                                className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold"
                              >
                                {T('cancel', lang)}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            key={r.id}
                            className="p-3 bg-emerald-950/80 border-2 border-emerald-600 rounded-xl flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-mono font-bold text-white">{r.awb}</div>
                              <div className="text-xs font-black text-emerald-300">
                                Count: {r.count} {tr('Qty')}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={!active}
                              onClick={() =>
                                act(
                                  'pdaCompleteNonSortPutaway',
                                  [r.id],
                                  'Putaway recorded. Leaderboard updated.',
                                  'nsd-' + r.id
                                )
                              }
                              className="px-3 py-1.5 bg-emerald-600 text-white font-black rounded-lg text-[11px] active:scale-95 disabled:opacity-40"
                            >
                              {tr('✔ Confirm putaway')}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MY PDA DEVICES */}
            <div className="bg-slate-800/90 border border-violet-700/50 rounded-2xl p-3.5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-white">{T('dev_title', lang)}</h3>
                <button
                  type="button"
                  onClick={() => loadDevices(true)}
                  className="px-2 py-0.5 bg-slate-900 border border-slate-600 rounded-lg text-[10px] font-black text-slate-300"
                >
                  &#8635;
                </button>
              </div>
              <div className="text-xs text-slate-400">
                {!devData ? (
                  '...'
                ) : !devData.success ? (
                  <span className="text-amber-300">{T('dev_err', lang)}</span>
                ) : !(devData.devices || []).length ? (
                  <span className="italic">{T('dev_none', lang)}</span>
                ) : (
                  (devData.devices as any[]).map((x) => {
                    const h = Math.floor(x.mins / 60);
                    const m = x.mins % 60;
                    return (
                      <div
                        key={x.barcode + x.sinceStr}
                        className="flex items-center justify-between gap-2 bg-slate-950/80 border border-violet-700/60 rounded-xl px-3 py-2 mb-1.5"
                      >
                        <div>
                          <div className="text-sm font-black text-violet-200 font-mono">
                            {x.barcode}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {T('dev_since', lang)} {x.sinceStr} &bull; {h}h {m}m
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {x.second && (
                            <span className="text-[9px] font-black bg-amber-500 text-slate-950 rounded px-1.5 py-0.5">
                              {T('dev_second', lang)}
                            </span>
                          )}
                          {x.swap && (
                            <span className="text-[9px] font-black bg-sky-600 text-white rounded px-1.5 py-0.5">
                              {T('dev_swap', lang)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* MY SCORE TODAY */}
            <div className="bg-slate-800/90 border border-emerald-700/50 rounded-2xl p-3.5 shadow-lg">
              <h3 className="text-xs font-black text-white mb-2">{T('sc_title', lang)}</h3>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  [lbMe ? lbMe.awbs : 0, 'sc_awb', 'text-indigo-300'],
                  [lbMe ? lbMe.totalCount : 0, 'sc_qty', 'text-emerald-300'],
                  [breakMinsMe + 'm', 'sc_brk', 'text-amber-300'],
                  [helpCountMe, 'sc_help', 'text-rose-300'],
                ].map(([val, k, cls]) => (
                  <div
                    key={String(k)}
                    className="bg-slate-900 border border-slate-700 rounded-xl py-2"
                  >
                    <div className={`text-base font-black ${cls}`}>{val}</div>
                    <div className="text-[9px] font-bold text-slate-400 uppercase">
                      {T(String(k), lang)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* YESTERDAY'S PRODUCTIVITY */}
            <div className="bg-slate-800/90 border border-sky-700/50 rounded-2xl p-3.5 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-white">{T('y_title', lang)}</h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {(yData && yData.date) || ''}
                </span>
              </div>
              {renderYesterday()}
              <button
                type="button"
                onClick={() => setProdOpen(true)}
                className="mt-2.5 w-full py-2 bg-sky-700 hover:bg-sky-600 text-white font-black rounded-xl text-xs active:scale-95"
              >
                {T('prod_open', lang)}
              </button>
            </div>

            {/* MY 7-DAY SCHEDULE */}
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3.5 shadow-lg">
              <h3 className="text-xs font-black text-white mb-2">
                {tr('📅 My 7-day schedule')}
              </h3>
              <div className="grid grid-cols-7 gap-1 text-center">
                {DAYS.map((d) => {
                  const c = (me.plan && me.plan[d]) || '-';
                  const isToday = d === realDay;
                  return (
                    <div
                      key={d}
                      className={`p-1 rounded-xl border flex flex-col items-center ${
                        isToday ? 'bg-sky-950 border-sky-400' : 'bg-slate-900 border-slate-700'
                      }`}
                    >
                      <span className="text-[9px] text-slate-400">{tr(d)}</span>
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded text-white mt-0.5 ${
                          c === 'WO' ? 'bg-slate-700' : 'bg-sky-700'
                        }`}
                      >
                        {c}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === 'alltasks' && renderAllTasks()}
      </div>

      {/* MODALS */}
      <PdaProdModal
        open={prodOpen}
        onClose={() => setProdOpen(false)}
        token={token}
        empId={empId}
        prodSig={curProdSig}
        lang={lang}
      />

      <PdaHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        token={token}
        empId={empId}
        reasons={S.helpReasons || ['Heavy item', 'Damaged', 'Wrong location', 'Other']}
        lang={lang}
        toast={toast}
        onSend={(loc, reason, imageId) =>
          act('pdaRaiseHelpRequest', [empId, loc, reason, imageId], 'Help alert sent')
        }
      />

      <PdaSendHelperModal
        helpId={sendHelperId}
        st={S}
        empId={empId}
        lang={lang}
        onClose={() => setSendHelperId('')}
        onPickHelper={(hId, workerId) => {
          setSendHelperId('');
          act('dispatchHelperToHelpCall', [hId, workerId], (r) =>
            `${(r && r.helperName) || 'Helper'} sent`
          );
        }}
      />

      <PdaBroadcastModal
        item={activeBcModalItem}
        readOnly={activeBcReadOnly}
        index={1}
        total={unseenBc.length || 1}
        lang={lang}
        onAck={(id, k) => act('ackBroadcast', [empId, id, k], 'Thanks', 'bc-' + id)}
        onCloseView={() => setBcViewId('')}
      />

      <PdaCcSheet
        sheet={ccSheet}
        setSheet={setCcSheet}
        st={S}
        active={active}
        nowSrvMs={nowSrvMs}
        lang={lang}
        toast={toast}
        onAct={act}
      />

      <PdaPhotoViewer url={photoUrl} onClose={() => setPhotoUrl('')} />
    </div>
  );
};
