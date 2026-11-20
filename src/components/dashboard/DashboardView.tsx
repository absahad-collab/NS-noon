import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Clock,
  Coffee,
  Columns3,
  History,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  MoreVertical,
  Package,
  Smartphone,
  Tv,
  UserCheck,
  UserMinus,
  Users,
  X,
} from 'lucide-react';
import { gs } from '../../api/appsScript';
import { Employee, LiveState } from '../../types/shift';
import { beep, unlockAudio } from '../../utils/audio';
import { NsLogo } from '../NsLogo';
import { PWAInstallButton } from '../PWAInstallButton';
import {
  BroadcastPopup,
  Btn,
  Chip,
  COLOR_CHOICES,
  curStation,
  DAYS,
  fmt12,
  fmtMMSS,
  fmtSecsShort,
  HELP_ICON,
  helpEventText,
  HelpLogPopup,
  LatePopup,
  lateList,
  lc,
  LineInfoPopup,
  Modal,
  NsPopup,
  PhotoThumb,
  ProductivityPopup,
  ReportPopup,
  SUMMON_PRESETS,
} from './DashboardModals';

const PRIORITY = ['FT', 'PK', 'BT'];
const AFTER_ORDER = ['DIS', 'FL', 'CIR', 'HV', 'ST', 'TL', 'CON', 'LA'];
const OVERVIEW_ORDER = ['FT', 'PK', 'BT', 'DIS', 'FL', 'CIR', 'HV', 'ST', 'TL', 'CON', 'LA'];

function lsGet(k: string): string {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
}
function lsSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
}

interface DashboardViewProps {
  S: LiveState;
  token: string;
  applyState: (st: LiveState) => boolean;
  onRequireAuth: () => void;
  onLogout: () => void;
  isTL: boolean;
  onSwitchToPda?: () => void;
  netBannerText: string;
  onNetworkStatus: (isNetFail: boolean) => void;
  nowSrv: () => number;
  toast: (m: string) => void;
  toastMsg: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  S,
  token,
  applyState,
  onRequireAuth,
  onLogout,
  isTL,
  onSwitchToPda,
  netBannerText,
  onNetworkStatus,
  nowSrv,
  toast,
  toastMsg,
}) => {
  const [view, setView] = useState<'board' | 'roster' | 'audit' | 'weekly'>('board');
  const [day, setDay] = useState('');
  const [search, setSearch] = useState('');
  const [inspect, setInspect] = useState('');
  const [modal, setModal] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[] | null>(null);
  const [weekly, setWeekly] = useState<any>(null);
  const [weekDays, setWeekDays] = useState(7);

  const [menuOpen, setMenuOpen] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState('');
  const [flash, _setFlash] = useState('');
  const [tv, setTv] = useState(() => lsGet('dash_tv') === '1');
  const [moveMode, setMoveMode] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [moveTarget, setMoveTarget] = useState('');
  const [dropOn, setDropOn] = useState('');

  const [, setTick] = useState(0);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const primed = useRef(false);
  const seen = useRef<{
    help: Record<string, number>;
    over: Record<string, number>;
    ns: Record<string, number>;
    breach: string;
    esc: Record<string, number>;
  }>({
    help: {},
    over: {},
    ns: {},
    breach: '',
    esc: {},
  });

  const [prodNew, setProdNew] = useState('');
  const prodNewRef = useRef(false);
  const sigRef = useRef('');

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    document.body.classList[modal ? 'add' : 'remove']('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [modal]);

  useEffect(() => {
    document.body.classList[tv ? 'add' : 'remove']('tv');
    lsSet('dash_tv', tv ? '1' : '0');
    if (!tv) return () => document.body.classList.remove('tv');
    const id = setInterval(() => {
      if (document.body.classList.contains('modal-open')) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= max - 8) window.scrollTo({ top: 0, behavior: 'smooth' });
      else window.scrollBy({ top: Math.round(window.innerHeight * 0.7), behavior: 'smooth' });
    }, 14000);
    return () => {
      clearInterval(id);
      document.body.classList.remove('tv');
    };
  }, [tv]);

  useEffect(() => {
    if (S && !day) setDay(S.currentRealDay);
  }, [S, day]);

  // Beeps on NEW help / overstay / breach / escalation / non-sort
  useEffect(() => {
    if (!S) return;
    const helpIds = (S.activeHelpRequests || []).map((r) => r.id);
    const overKeys = (S.overstayBreaks || []).map((o) => o.empId + '@' + o.breakEndTime);
    const breachKey = (S.minStaffBreaches || []).map((b) => b.code).sort().join(',');
    let loud = false;
    helpIds.forEach((id) => {
      if (!seen.current.help[id]) {
        seen.current.help[id] = 1;
        loud = true;
      }
    });
    overKeys.forEach((k) => {
      if (!seen.current.over[k]) {
        seen.current.over[k] = 1;
        loud = true;
      }
    });
    if (breachKey && breachKey !== seen.current.breach) loud = true;
    (S.activeHelpRequests || []).forEach((r) => {
      if (r.escalated && !seen.current.esc[r.id]) {
        seen.current.esc[r.id] = 1;
        loud = true;
      }
    });
    let soft = false;
    (S.nonSortRequests || [])
      .filter((r) => r.status === 'pending')
      .forEach((r) => {
        if (!seen.current.ns[r.id]) {
          seen.current.ns[r.id] = 1;
          soft = true;
        }
      });
    seen.current.breach = breachKey;
    if (primed.current && loud) beep(3);
    else if (primed.current && soft) beep(1);
    primed.current = true;
  }, [S]);

  // Productivity sheet update notifications
  const pvLatest = S && S.prodVer ? S.prodVer.latest : '';
  useEffect(() => {
    if (!pvLatest) return;
    let seenD = '';
    try {
      seenD = localStorage.getItem('prod_seen_latest') || '';
    } catch {
      // ignore
    }
    try {
      localStorage.setItem('prod_seen_latest', pvLatest);
    } catch {
      // ignore
    }
    if (seenD && pvLatest > seenD) {
      setProdNew(pvLatest);
      prodNewRef.current = true;
      toast('📈 Productivity data for ' + pvLatest + ' is now live');
      beep(2);
    }
  }, [pvLatest, toast]);

  const pvSig = S && S.prodVer ? S.prodVer.v || String(S.prodVer.rows) : '';
  useEffect(() => {
    if (!pvSig) return;
    if (sigRef.current && sigRef.current !== pvSig && !prodNewRef.current) {
      toast('📈 Productivity sheet updated');
      beep(1);
    }
    prodNewRef.current = false;
    sigRef.current = pvSig;
  }, [pvSig, toast]);

  // Lazy tabs
  useEffect(() => {
    if (view === 'audit') {
      gs(
        'getShiftHistory',
        [tokenRef.current],
        (r: any) => {
          onNetworkStatus(false);
          if (r && (r.code === 'AUTH' || r.authRequired)) {
            onRequireAuth();
            return;
          }
          setHistory(Array.isArray(r) ? r : []);
        },
        (_m, isNet) => {
          if (isNet) onNetworkStatus(true);
          setHistory([]);
        }
      );
    }
    if (view === 'weekly') {
      setWeekly(null);
      gs(
        'getWeeklyRecord',
        [tokenRef.current, weekDays],
        (r: any) => {
          onNetworkStatus(false);
          if (r && (r.code === 'AUTH' || r.authRequired)) {
            onRequireAuth();
            return;
          }
          setWeekly(r || { success: false });
        },
        (_m, isNet) => {
          if (isNet) onNetworkStatus(true);
          setWeekly({ success: false });
        }
      );
    }
  }, [view, weekDays, onNetworkStatus, onRequireAuth]);

  const run = useCallback(
    (op: string, payload?: Record<string, unknown>, okMsg?: string | ((res: any) => string)) => {
      if (busy) return;
      setBusy(true);
      gs(
        'dashAction',
        [tokenRef.current, op, payload || {}],
        (res: any) => {
          setBusy(false);
          onNetworkStatus(false);
          if (!res) return;
          if (res.code === 'AUTH' || res.authRequired) {
            onRequireAuth();
            return;
          }
          if (res.success) {
            applyState(res.state);
            const m = typeof okMsg === 'function' ? okMsg(res) : okMsg;
            if (m) toast(m);
          } else toast(res.error || 'Action failed.');
        },
        (m, isNet) => {
          setBusy(false);
          if (isNet) onNetworkStatus(true);
          toast(m);
        }
      );
    },
    [busy, applyState, onRequireAuth, onNetworkStatus, toast]
  );

  const callApiFn = useCallback(
    (name: string, args: unknown[], okMsg?: string, after?: (res: any) => void) => {
      if (busy) return;
      setBusy(true);
      gs(
        name,
        [tokenRef.current, ...args],
        (res: any) => {
          setBusy(false);
          onNetworkStatus(false);
          if (res && (res.code === 'AUTH' || res.authRequired)) {
            onRequireAuth();
            return;
          }
          if (res && res.success) {
            applyState(res.state);
            if (okMsg) toast(okMsg);
            if (after) after(res);
          } else toast((res && res.error) || 'Action failed.');
        },
        (m, isNet) => {
          setBusy(false);
          if (isNet) onNetworkStatus(true);
          toast(m);
        }
      );
    },
    [busy, applyState, onRequireAuth, onNetworkStatus, toast]
  );

  const realDay = S.currentRealDay;
  const selDay = day || realDay;
  const isToday = selDay === realDay;
  const canAct = isToday && S.isShiftActive;
  const emps = S.employees || [];
  const att = S.attendance || {};
  const asg = S.assignments || {};
  const defs = S.taskDefinitions || {};
  const disabled = S.disabledTasks || {};
  const q = lc(search);
  const matches = (e: Employee) => !q || lc(e.name).includes(q) || lc(e.id).includes(q);
  const planFor = (e: Employee, d: string) => (e.plan && e.plan[d]) || 'PK';
  const now = nowSrv();

  const membersOf = (code: string) => {
    if (isToday) return emps.filter((e) => att[e.id] === 'Present' && curStation(asg[e.id], '') === code);
    return emps.filter((e) => planFor(e, selDay) === code);
  };
  const plannedOf = (code: string) => emps.filter((e) => planFor(e, realDay) === code && att[e.id] !== 'WO').length;
  const codes = Object.keys(defs);
  const memAll: Record<string, Employee[]> = {};
  codes.forEach((c) => {
    memAll[c] = membersOf(c);
  });
  const memMap: Record<string, Employee[]> = {};
  codes.forEach((c) => {
    memMap[c] = isToday ? memAll[c].filter((e) => !(asg[e.id] || {}).onBreak) : memAll[c];
  });
  const onBreakList = isToday ? emps.filter((e) => att[e.id] === 'Present' && asg[e.id] && asg[e.id].onBreak) : [];

  const counts = { present: 0, absent: 0, eo: 0, wo: 0 };
  emps.forEach((e) => {
    const s = att[e.id];
    if (s === 'Present') counts.present++;
    else if (s === 'AB' || s === 'LV') counts.absent++;
    else if (s === 'EO') counts.eo++;
    else if (s === 'WO') counts.wo++;
  });
  const breaksDone = emps.filter((e) => asg[e.id] && asg[e.id].breakStatus === 'completed').length;
  const breaksPending = emps.filter(
    (e) => att[e.id] === 'Present' && asg[e.id] && asg[e.id].breakStatus === 'pending'
  ).length;
  const breakingNow = onBreakList.length;

  const breachMap: Record<string, { code: string; min: number; active: number }> = {};
  (S.minStaffBreaches || []).forEach((b) => {
    breachMap[b.code] = b;
  });

  const stat: Record<
    string,
    { have: number; planned: number; active: number; kind: 'none' | 'short' | 'extra' | 'ok'; deficit: number }
  > = {};
  codes.forEach((c) => {
    const have = memAll[c].length;
    const planned = plannedOf(c);
    const active = memMap[c].length;
    let kind: 'none' | 'short' | 'extra' | 'ok' = 'none';
    if (isToday && !disabled[c] && (planned > 0 || have > 0)) {
      kind = have < planned ? 'short' : have > planned ? 'extra' : 'ok';
    }
    stat[c] = { have, planned, active, kind, deficit: Math.max(0, planned - have) };
  });

  const shortages: { code: string; text: string }[] = [];
  (S.minStaffBreaches || []).forEach((b) =>
    shortages.push({ code: b.code, text: b.code + ' ' + b.active + '/' + b.min + ' (min)' })
  );
  if (isToday) {
    codes.forEach((c) => {
      if (disabled[c] || breachMap[c]) return;
      if (stat[c].kind === 'short') shortages.push({ code: c, text: c + ' (' + stat[c].deficit + ')' });
      else if (stat[c].planned > 0 && stat[c].active === 0) shortages.push({ code: c, text: c + ' 0 active' });
    });
  }

  const forecastWarn: { code: string; after: number; min: number }[] = [];
  if (isToday) {
    codes.forEach((c) => {
      if (disabled[c]) return;
      const mn = (S.minStaff || {})[c] || 0;
      const pend = memMap[c].filter(
        (e) => (asg[e.id] || {}).breakStatus === 'pending' && !(asg[e.id] || {}).onBreak
      ).length;
      if (mn > 0 && pend > 0 && stat[c].active >= mn && stat[c].active - 1 < mn) {
        forecastWarn.push({ code: c, after: stat[c].active - 1, min: mn });
      }
    });
  }
  const fcMap: Record<string, { code: string; after: number; min: number }> = {};
  forecastWarn.forEach((f) => {
    fcMap[f.code] = f;
  });

  const ovCodes = codes.slice().sort((x, y) => {
    const ix = OVERVIEW_ORDER.indexOf(x);
    const iy = OVERVIEW_ORDER.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || x.localeCompare(y);
  });
  const nsReqAll = S.nonSortRequests || [];
  const nsPending = nsReqAll.filter((r) => r.status === 'pending').length;

  // Board column order: FT, PK, BT first -> BRK -> remaining lines
  const hasPeople = codes.filter((c) => memAll[c].length > 0 && PRIORITY.indexOf(c) < 0);
  const sortRest = (a: string, b: string) => {
    const ia = AFTER_ORDER.indexOf(a);
    const ib = AFTER_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  };
  const midLines = hasPeople.slice().sort(sortRest);
  const emptyLines = codes.filter((c) => memAll[c].length === 0 && PRIORITY.indexOf(c) < 0).sort(sortRest);
  const priorityLines = PRIORITY.filter((c) => defs[c]);
  const boardCols: ({ t: 'line'; code: string } | { t: 'break'; code?: undefined })[] = ([] as any[])
    .concat(priorityLines.map((c) => ({ t: 'line' as const, code: c })))
    .concat([{ t: 'break' as const }])
    .concat(midLines.map((c) => ({ t: 'line' as const, code: c })))
    .concat(emptyLines.map((c) => ({ t: 'line' as const, code: c })));

  const visibleCols = inspect ? boardCols.filter((c) => c.t === 'break' || c.code === inspect) : boardCols;

  const helps = S.activeHelpRequests || [];
  const summons = S.activeSummons || [];
  const anns = S.announcements || [];
  const over = S.overstayBreaks || [];
  const lateToday = lateList(S);
  const recentHelp = (S.helpLog || []).filter((h) => h.type !== 'raised' && now - h.ts < 120000).slice(0, 3);
  const hasTopRedAlerts =
    helps.length > 0 || over.length > 0 || lateToday.length > 0 || (S.minStaffBreaches || []).length > 0;
  const hasInfoAlerts = anns.length > 0 || summons.length > 0 || recentHelp.length > 0 || nsPending > 0;

  const shiftLabel =
    S.shiftStartMs && S.shiftEndMs ? fmt12(S.shiftStartMs) + ' - ' + fmt12(S.shiftEndMs) : '12:00 AM - 09:00 AM';

  const eStatusBadge = (e: Employee) => {
    const d = (S.attendanceDetail || {})[e.id] || {};
    return (
      <>
        {d.late && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-200 border border-amber-500/60">
            Late {d.late.mins}m ({d.late.time})
          </span>
        )}
        {d.left && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-rose-950/70 text-rose-200 border border-rose-500/60">
            Left {d.left.time}
          </span>
        )}
      </>
    );
  };

  const renderCCCard = (e: Employee) => {
    const a = asg[e.id] || {};
    const planned = planFor(e, realDay);
    const isHelper = !!a.isHelping;
    const covering = !!a.swappedFrom;
    const summoned = summons.some((s) => lc(s.targetId) === lc(e.id));
    const det = (S.attendanceDetail || {})[e.id] || {};
    const menuIsOpen = openRowMenu === e.id;

    // Status colour dot
    const dotClass = det.left
      ? 'bg-rose-500'
      : isHelper || summoned || det.late
      ? 'bg-amber-400'
      : covering
      ? 'bg-sky-400'
      : 'bg-emerald-400';

    return (
      <div
        key={e.id}
        draggable={!!(canAct && isToday)}
        onDragStart={(ev) => {
          const ids = sel[e.id] ? Object.keys(sel).filter((k) => sel[k]) : [e.id];
          try {
            ev.dataTransfer.setData('text/plain', JSON.stringify(ids));
            ev.dataTransfer.effectAllowed = 'move';
          } catch {
            // ignore
          }
        }}
        className={
          'bg-[#0b1530] border rounded-xl p-2.5 shadow-sm transition ' +
          (summoned ? 'border-amber-400 ' : 'border-slate-700/80 ') +
          (sel[e.id] ? 'ring-2 ring-[#FEEE00] ' : '') +
          (canAct && isToday ? 'cursor-grab' : '')
        }
      >
        <div className="flex items-center justify-between gap-2 min-h-[44px]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {moveMode && canAct && (
              <label className="min-h-[44px] min-w-[36px] flex items-center justify-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={!!sel[e.id]}
                  onChange={() => setSel((p) => ({ ...p, [e.id]: !p[e.id] }))}
                  className="w-5 h-5 accent-[#FEEE00]"
                />
              </label>
            )}
            <span
              className={'w-3 h-3 rounded-full shrink-0 ' + dotClass}
              title={
                det.left
                  ? 'Left early'
                  : isHelper
                  ? 'Helper'
                  : summoned
                  ? 'Called'
                  : det.late
                  ? 'Late'
                  : covering
                  ? 'Covering'
                  : 'Primary active'
              }
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{e.name}</div>
              <div className="text-xs text-slate-400 truncate">
                <span className="font-mono">{e.id}</span> &middot; Plan: <b className="text-slate-200">{planned}</b>
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label={'Actions for ' + e.name}
            onClick={() => setOpenRowMenu(menuIsOpen ? '' : e.id)}
            className={
              'min-h-[44px] min-w-[44px] rounded-xl border flex items-center justify-center shrink-0 transition ' +
              (menuIsOpen
                ? 'bg-[#FEEE00] text-[#14213f] border-[#FEEE00]'
                : 'bg-[#14213f] text-slate-200 border-slate-600 hover:border-[#FEEE00]')
            }
          >
            {menuIsOpen ? <X className="w-4 h-4" /> : <MoreVertical className="w-4 h-4" />}
          </button>
        </div>

        {(isHelper || covering || det.late || det.left || a.breakStatus === 'completed' || summoned) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {isHelper && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-200 border border-amber-500/60">
                Helper (base {a.originalStation})
              </span>
            )}
            {!isHelper && covering && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-sky-950/70 text-sky-200 border border-sky-500/60">
                Covering
              </span>
            )}
            {eStatusBadge(e)}
            {a.breakStatus === 'completed' && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-950/70 text-emerald-300 border border-emerald-600/60">
                Break done
              </span>
            )}
            {summoned && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-950/70 text-amber-300 border border-amber-500/60">
                Called
              </span>
            )}
          </div>
        )}

        {menuIsOpen && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-700 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={!canAct || busy}
              onClick={() => {
                setOpenRowMenu('');
                setModal({ type: 'line', mode: 'swap', emp: e });
              }}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-slate-600 text-sm font-bold text-white hover:border-[#FEEE00] disabled:opacity-40"
            >
              Swap
            </button>
            {isHelper ? (
              <button
                type="button"
                disabled={!canAct || busy}
                onClick={() => {
                  setOpenRowMenu('');
                  run('helperRevert', { empId: e.id }, (r) => 'Helper ended (' + r.durationFormatted + ')');
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-sky-500/70 text-sm font-bold text-sky-300 hover:border-[#FEEE00] disabled:opacity-40"
              >
                Revert helper
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAct || busy}
                onClick={() => {
                  setOpenRowMenu('');
                  setModal({ type: 'line', mode: 'helper', emp: e });
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-slate-600 text-sm font-bold text-sky-300 hover:border-[#FEEE00] disabled:opacity-40"
              >
                Helper
              </button>
            )}
            {a.breakStatus === 'completed' ? (
              <button
                type="button"
                disabled={!canAct || busy}
                onClick={() => {
                  setOpenRowMenu('');
                  run('breakUndo', { empId: e.id }, 'Break reset');
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-slate-600 text-sm font-bold text-slate-200 hover:border-[#FEEE00] disabled:opacity-40"
              >
                Undo break
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAct || busy}
                onClick={() => {
                  setOpenRowMenu('');
                  run('breakStart', { empId: e.id }, 'Break started: ' + e.name);
                }}
                className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-amber-500/60 text-sm font-bold text-amber-300 hover:border-[#FEEE00] disabled:opacity-40"
              >
                Break
              </button>
            )}
            <button
              type="button"
              disabled={!canAct || busy}
              onClick={() => {
                setOpenRowMenu('');
                setModal({ type: 'call', emp: e });
              }}
              className="min-h-[44px] px-2.5 py-2 rounded-xl bg-[#14213f] border border-slate-600 text-sm font-bold text-[#FEEE00] hover:border-[#FEEE00] disabled:opacity-40"
            >
              Call
            </button>
            <button
              type="button"
              disabled={!canAct || busy}
              onClick={() => {
                setOpenRowMenu('');
                run('attendance', { empId: e.id, kind: 'AB' }, e.name + ': Absent');
              }}
              className="col-span-2 min-h-[44px] px-2.5 py-2 rounded-xl bg-rose-950/70 border border-rose-500/70 text-sm font-bold text-rose-200 hover:bg-rose-900/70 disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              <UserMinus className="w-4 h-4" /> Absent
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBreakCol = () => (
    <div
      className={
        'h-full w-full bg-[#14213f] border-2 border-amber-400/70 rounded-2xl shadow-lg flex flex-col overflow-hidden ' +
        (flash === 'BRK' ? 'box-flash' : '')
      }
    >
      <div className="shrink-0 px-3.5 py-3 border-b border-amber-500/30 bg-[#0b1530]/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-950 px-2 py-0.5 rounded-md bg-amber-400">☕ BRK</span>
            <span className="text-sm font-black text-white truncate">On Break (Live)</span>
          </div>
          <div className="text-xs text-slate-300 mt-1">
            Current: <b className="text-white">{onBreakList.length} CC</b>
          </div>
        </div>
        <span className="text-xs font-black border rounded-lg px-2 py-1 bg-amber-950/70 text-amber-200 border-amber-500/60 whitespace-nowrap">
          {onBreakList.length} on Break
        </span>
      </div>
      <div className="p-2.5 space-y-2 flex-1 min-h-0 overflow-y-auto box-scroll">
        {onBreakList.length === 0 && (
          <div className="border-2 border-dashed border-amber-500/40 rounded-xl text-center text-sm text-amber-200/80 py-9 px-3">
            ☕ No colleagues on break.
            <br />
            All active staff on duty.
          </div>
        )}
        {onBreakList.map((e) => {
          const a = asg[e.id];
          const diff = (a.breakEndTime || 0) - now;
          const overBrk = diff < 0;
          return (
            <div
              key={e.id}
              className={
                'bg-[#0b1530] border rounded-xl p-3 ' +
                (overBrk ? 'border-rose-500 pulse-red' : 'border-amber-500/50')
              }
            >
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={'w-3 h-3 rounded-full shrink-0 ' + (overBrk ? 'bg-rose-500' : 'bg-amber-400')} />
                  <span className="text-sm font-bold text-white truncate">{e.name}</span>
                </div>
                <span className="text-xs font-bold text-slate-300 shrink-0">{curStation(a, '')}</span>
              </div>
              <div className={'text-xl font-mono font-black mt-1 ' + (overBrk ? 'text-rose-400' : 'text-amber-300')}>
                {overBrk ? '+' : ''}
                {fmtMMSS(Math.abs(diff))}
              </div>
              <div className="text-xs text-slate-300">
                {overBrk ? 'Overstay' : 'Remaining'} &middot; {a.breakDurationMins} min break
              </div>
              {canAct && (
                <div className="grid grid-cols-2 gap-2 mt-2.5">
                  <Btn
                    small
                    tone="green"
                    disabled={busy}
                    onClick={() =>
                      run('breakEnd', { empId: e.id }, (r) =>
                        r.overtimeMins > 0 ? 'Returned (+' + r.overtimeMins + 'm overstay)' : 'Returned on time'
                      )
                    }
                  >
                    Return
                  </Btn>
                  <Btn small disabled={busy} onClick={() => run('breakUndo', { empId: e.id }, 'Break cancelled')}>
                    Undo
                  </Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="shrink-0 px-3 py-2 border-t border-amber-500/30 text-center text-xs font-semibold text-slate-300">
        Standard Break: {S.breakDurationSetting} mins
      </div>
    </div>
  );

  const renderLineCol = (code: string) => {
    const d = defs[code] || { name: code, headerBg: 'bg-slate-600' };
    const list = memMap[code].filter(matches);
    const dis = !!disabled[code];
    const st = stat[code];
    const br = !!breachMap[code];
    const pill =
      st.kind === 'short'
        ? ['bg-rose-950/80 text-rose-200 border-rose-500/70', st.active + '/' + st.planned + ' Short']
        : st.kind === 'extra'
        ? ['bg-sky-950/80 text-sky-200 border-sky-500/70', st.active + '/' + st.planned + ' Extra']
        : st.kind === 'ok'
        ? ['bg-emerald-950/80 text-emerald-200 border-emerald-500/70', st.active + '/' + st.planned + ' OK']
        : null;
    return (
      <div
        className={
          'h-full w-full bg-[#14213f] border-2 rounded-2xl shadow-lg flex flex-col overflow-hidden transition-colors duration-300 ' +
          (st.kind === 'short' || br ? 'border-rose-500/80 ' : 'border-slate-700/80 ') +
          (dis ? 'opacity-60 ' : '') +
          (flash === code ? 'box-flash' : '')
        }
      >
        <div className="shrink-0 px-3.5 py-2.5 border-b border-slate-700/80 bg-[#0b1530]/60 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={
                  'text-xs font-black text-white px-2 py-0.5 rounded-md shrink-0 ' +
                  (d.headerBg || 'bg-slate-600')
                }
              >
                {code}
              </span>
              <span className="text-sm font-black text-white truncate">
                {d.name || code}
                {dis ? ' (off)' : ''}
              </span>
              <button
                type="button"
                title="Focus this line"
                aria-label={'Focus ' + code}
                onClick={() => setInspect(inspect === code ? '' : code)}
                className={
                  'min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-sm shrink-0 ' +
                  (inspect === code ? 'text-[#FEEE00] bg-slate-800' : 'text-slate-300 hover:text-white')
                }
              >
                👁
              </button>
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {isToday ? 'Active' : 'Planned'}: <b className="text-white">{memMap[code].length} CC</b>
              {isToday && st.have > st.active ? (
                <span className="text-amber-300"> &middot; {st.have - st.active} on break</span>
              ) : null}
            </div>
          </div>
          {isToday && pill && (
            <span className={'text-xs font-bold border rounded-lg px-2 py-1 whitespace-nowrap shrink-0 ' + pill[0]}>
              {pill[1]}
            </span>
          )}
        </div>
        <div className="p-2.5 space-y-2 flex-1 min-h-0 overflow-y-auto box-scroll">
          {list.length === 0 && (
            <div className="text-sm text-slate-400 italic text-center py-6">
              {memMap[code].length ? 'No match' : memAll[code].length ? 'Everyone is on break' : 'Empty'}
            </div>
          )}
          {list.map((e) =>
            isToday ? (
              renderCCCard(e)
            ) : (
              <div key={e.id} className="bg-[#0b1530] border border-slate-700 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-sm font-bold text-white truncate">{e.name}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Planned for {selDay}</div>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  const VIEW_TABS: {
    k: 'board' | 'roster' | 'audit' | 'weekly';
    short: string;
    full: string;
    Icon: React.FC<{ className?: string }>;
  }[] = [
    { k: 'board', short: 'Board', full: 'Workstation Columns', Icon: Columns3 },
    { k: 'roster', short: 'Roster', full: 'Roster Table', Icon: Users },
    { k: 'audit', short: 'Audit', full: 'Audit & Logs', Icon: History },
    { k: 'weekly', short: 'Weekly', full: 'Weekly Record', Icon: CalendarDays },
  ];

  return (
    <div className="min-h-screen bg-[#0b1530] text-slate-100 overflow-x-hidden" onClick={unlockAudio}>
      {netBannerText && (
        <div className="bg-amber-500 text-slate-950 text-sm font-black text-center py-2 px-3 sticky top-0 z-[60]">
          {netBannerText}
        </div>
      )}

      {/* Red Emergency Top Strip: Help Calls, Break Overstays, Late Alerts, Min-Staff Breaches */}
      {hasTopRedAlerts && (
        <div
          role="region"
          aria-label="Urgent alerts"
          className="bg-rose-700 border-b-2 border-rose-500 text-white sticky top-0 z-50 shadow-xl"
        >
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 space-y-2">
            {(S.minStaffBreaches || []).length > 0 && (
              <div className="bg-rose-950/75 border border-rose-300/60 rounded-xl px-3 py-2 text-sm flex flex-wrap items-center gap-2">
                <span className="font-black">&#9888; Minimum staff breached:</span>
                <span>{(S.minStaffBreaches || []).map((b) => b.code + ' (' + b.active + '/' + b.min + ')').join(', ')}</span>
              </div>
            )}

            {helps.map((h) => (
              <div
                key={h.id}
                className={
                  'rounded-xl px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border ' +
                  (h.escalated
                    ? 'bg-rose-950 border-yellow-300 pulse-red'
                    : 'bg-rose-800/95 border-rose-300/70')
                }
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  {h.imageUrl && <PhotoThumb url={h.imageUrl} h="h-11 w-11" />}
                  <div className="min-w-0 text-sm leading-snug">
                    <div>
                      <b>🚨 Help call:</b> {h.empName} at {h.location} ({h.station}) &middot; {h.timeStr}
                    </div>
                    {h.reason && (
                      <div className="mt-1 inline-block text-xs font-black bg-rose-950/80 border border-rose-300/60 px-2 py-0.5 rounded-md">
                        ⚠ {h.reason}
                      </div>
                    )}
                    <div className="text-xs text-rose-100 mt-1">
                      {h.escalated ? (
                        <b className="text-[#FEEE00]">
                          ⏰ NOT ACCEPTED for {Math.floor((h.waitMs || 0) / 60000)} min - TL notified &middot;{' '}
                        </b>
                      ) : null}
                      {h.helperName
                        ? h.helperName + ' is coming'
                        : h.status === 'accepted'
                        ? '✔ accepted by ' +
                          (h.acceptedByRole === 'Dashboard'
                            ? 'Supervisor (Dashboard)'
                            : h.acceptedBy + (h.acceptedByRole ? ' (' + h.acceptedByRole + ')' : '')) +
                          (h.acceptedAtStr ? ' at ' + h.acceptedAtStr : '')
                        : 'awaiting response'}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Btn small tone="yellow" disabled={busy} onClick={() => setModal({ type: 'helpHelper', req: h })}>
                    Send helper
                  </Btn>
                  <Btn
                    small
                    tone="green"
                    disabled={busy}
                    onClick={() => callApiFn('resolveHelpRequest', [h.id], 'Help call cleared')}
                  >
                    Clear
                  </Btn>
                </div>
              </div>
            ))}

            {over.map((o) => (
              <div
                key={o.empId}
                className="bg-rose-800/95 border border-rose-300/70 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div className="min-w-0">
                  <b>⏱ Break overstay:</b> {o.name} ({o.station}) is <b>{o.overtimeMins}m over</b> a {o.scheduledMins}m
                  break
                </div>
                <div className="flex gap-2 shrink-0">
                  <Btn
                    small
                    tone="yellow"
                    disabled={busy || !canAct}
                    onClick={() =>
                      setModal({
                        type: 'call',
                        emp: { id: o.empId, name: o.name },
                        preset: 'Break ended - return to line',
                      })
                    }
                  >
                    🔔 Call
                  </Btn>
                  <Btn
                    small
                    tone="green"
                    disabled={busy || !canAct}
                    onClick={() => run('breakEnd', { empId: o.empId }, 'Returned')}
                  >
                    Return
                  </Btn>
                </div>
              </div>
            ))}

            {lateToday.length > 0 && (
              <div className="bg-rose-800/95 border border-rose-300/70 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <b>⏰ Late today ({lateToday.length}):</b>{' '}
                  {lateToday
                    .slice(0, 3)
                    .map((l) => l.name + ' (+' + l.mins + 'm)')
                    .join(', ')}
                  {lateToday.length > 3 ? ` +${lateToday.length - 3} more` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'late' })}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white text-rose-800 font-black text-sm shrink-0"
                >
                  View Late
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compact Header */}
      <header className="bg-[#0b1530] border-b border-slate-700/80">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pt-3 pb-3 space-y-3">
          {/* Row 1: Logo + Single-line Title + Status Pill + Desktop Switch + Menu */}
          <div className="flex items-center justify-between gap-2 relative">
            <div className="flex items-center gap-2.5 min-w-0">
              <NsLogo size={36} className="rounded-xl shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap leading-none">
                  NS Shift A
                </h1>
                <span
                  className={
                    'inline-flex items-center gap-1.5 text-xs font-black tracking-wide px-2.5 py-1 rounded-lg border whitespace-nowrap shrink-0 ' +
                    (S.isShiftActive
                      ? 'border-emerald-400/60 text-emerald-300 bg-emerald-500/15'
                      : 'border-amber-400/60 text-amber-300 bg-amber-500/15')
                  }
                >
                  <span
                    className={'w-2 h-2 rounded-full ' + (S.isShiftActive ? 'bg-emerald-400' : 'bg-amber-400')}
                  />
                  {S.isShiftActive ? 'SHIFT LIVE' : 'SHIFT CLOSED'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isTL && onSwitchToPda && (
                <button
                  type="button"
                  onClick={onSwitchToPda}
                  className="hidden sm:inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FEEE00] text-[#14213f] text-sm font-black shadow hover:brightness-95 active:scale-95 whitespace-nowrap"
                >
                  <Smartphone className="w-4 h-4" />
                  Switch to my PDA
                </button>
              )}

              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className={
                  'min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border flex items-center justify-center gap-1.5 text-sm font-bold transition ' +
                  (menuOpen
                    ? 'bg-[#FEEE00] text-[#14213f] border-[#FEEE00]'
                    : 'bg-[#14213f] text-white border-slate-600 hover:border-[#FEEE00]')
                }
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-64 bg-[#14213f] border-2 border-[#FEEE00] rounded-2xl shadow-2xl p-2 space-y-1.5">
                  <div className="px-3 py-2 border-b border-slate-700 text-xs text-slate-300">
                    <div className="font-black text-white text-sm">{S.shiftName || 'Shift A'}</div>
                    <div>{shiftLabel} &bull; Jeddah / JEDMS02</div>
                  </div>
                  {isTL && onSwitchToPda && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onSwitchToPda();
                      }}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#FEEE00] text-[#14213f] text-sm font-black flex items-center gap-2 text-left"
                    >
                      <Smartphone className="w-4 h-4 shrink-0" />
                      Switch to my PDA
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setModal({ type: 'announce' });
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#0b1530] border border-slate-700 text-white text-sm font-bold flex items-center gap-2 text-left hover:border-[#FEEE00]"
                  >
                    <Bell className="w-4 h-4 shrink-0 text-[#FEEE00]" />
                    Quick Announcement
                  </button>
                  <div className="px-1">
                    <PWAInstallButton compact />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-black flex items-center gap-2 text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mobile compact bar for TL Switch to my PDA (keeps header max 2 lines) */}
          {isTL && onSwitchToPda && (
            <div className="sm:hidden">
              <button
                type="button"
                onClick={onSwitchToPda}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FEEE00] text-[#14213f] text-sm font-black shadow flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Switch to my PDA
              </button>
            </div>
          )}

          {/* 8 Action Buttons Grid: 4 columns laptop, 2 columns phone, icon on top, label below */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setModal({ type: 'broadcast' })}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'broadcast'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <Megaphone className="w-5 h-5" />
              <span>Broadcast</span>
              {(S.broadcasts || []).length > 0 && (
                <span className="absolute top-1.5 right-2 bg-[#FEEE00] text-[#14213f] text-xs font-black rounded-full px-1.5 py-0.5 leading-none">
                  {(S.broadcasts || []).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: 'nonsort' })}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'nonsort'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : nsPending > 0
                  ? 'border-2 border-rose-500 text-white pulse-red'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <Package className="w-5 h-5" />
              <span>Non Sort</span>
              {nsPending > 0 && (
                <span className="absolute top-1.5 right-2 bg-rose-600 text-white text-xs font-black rounded-full px-1.5 py-0.5 leading-none">
                  {nsPending}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: 'helplog' })}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'helplog'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : helps.length > 0
                  ? 'border-2 border-rose-500 text-white'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <AlertTriangle className="w-5 h-5" />
              <span>Help Log</span>
              {helps.length > 0 && (
                <span className="absolute top-1.5 right-2 bg-rose-600 text-white text-xs font-black rounded-full px-1.5 py-0.5 leading-none">
                  {helps.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: 'report' })}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'report'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <ClipboardList className="w-5 h-5" />
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProdNew('');
                setModal({ type: 'prod' });
              }}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'prod'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <BarChart3 className="w-5 h-5" />
              <span>Productivity</span>
              {prodNew && (
                <span className="absolute top-1.5 right-2 bg-rose-600 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none animate-pulse">
                  NEW
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setModal({ type: 'late' })}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (modal?.type === 'late'
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <Clock className="w-5 h-5" />
              <span>Late</span>
              {lateToday.length > 0 && (
                <span className="absolute top-1.5 right-2 bg-[#FEEE00] text-[#14213f] text-xs font-black rounded-full px-1.5 py-0.5 leading-none">
                  {lateToday.length}
                </span>
              )}
            </button>

            <button
              type="button"
              disabled={!canAct || !isToday}
              onClick={() => {
                setMoveMode(!moveMode);
                setSel({});
              }}
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition disabled:opacity-40 ' +
                (moveMode
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <CheckSquare className="w-5 h-5" />
              <span>Multi-move</span>
            </button>

            <button
              type="button"
              onClick={() => setTv(!tv)}
              title="TV mode: larger text, auto-scroll"
              className={
                'relative min-h-[72px] w-full rounded-2xl bg-[#14213f] p-2.5 flex flex-col items-center justify-center gap-1 text-sm font-bold transition ' +
                (tv
                  ? 'border-2 border-[#FEEE00] text-[#FEEE00]'
                  : 'border border-slate-700 text-white hover:border-[#FEEE00]/70')
              }
            >
              <Tv className="w-5 h-5" />
              <span>TV</span>
            </button>
          </div>

          {/* Segmented Control Tabs + 7-Day Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
            <div className="lg:col-span-7 grid grid-cols-4 gap-1 bg-[#14213f] border border-slate-700/80 rounded-xl p-1">
              {VIEW_TABS.map(({ k, short, full, Icon }) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setView(k)}
                  className={
                    'min-h-[44px] px-1.5 sm:px-3 py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition min-w-0 ' +
                    (view === k
                      ? 'bg-[#FEEE00] text-[#14213f] font-black shadow'
                      : 'text-slate-200 hover:bg-slate-800/70')
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="md:hidden truncate">{short}</span>
                  <span className="hidden md:inline truncate">{full}</span>
                </button>
              ))}
            </div>

            <div className="lg:col-span-5 grid grid-cols-7 gap-1 bg-[#14213f] border border-slate-700/80 rounded-xl p-1">
              {DAYS.map((d) => {
                const isRealToday = d === realDay;
                const isSelected = d === selDay;
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => setDay(d)}
                    className={
                      'min-h-[44px] w-full rounded-lg text-sm font-bold flex items-center justify-center transition ' +
                      (isSelected
                        ? 'bg-[#FEEE00] text-[#14213f] font-black '
                        : 'text-slate-200 hover:bg-slate-800/70 ') +
                      (isRealToday ? 'ring-2 ring-[#FEEE00]' : '')
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {!isToday && (
        <div className="bg-amber-950/90 border-b border-amber-500/60 text-amber-200 text-sm text-center py-2 px-3">
          Previewing <b>{selDay}</b> plan. Read-only.{' '}
          <button type="button" className="underline font-black text-[#FEEE00] ml-1" onClick={() => setDay(realDay)}>
            Back to today
          </button>
        </div>
      )}

      {/* Secondary notifications strip (Announcements, Summons, Pending NS, Recent Help) */}
      {hasInfoAlerts && (
        <div className="bg-[#14213f] border-b border-slate-700">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2 space-y-2">
            {anns.map((a) => (
              <div
                key={a.id}
                className="bg-[#0b1530] border border-indigo-500/60 text-slate-100 text-sm rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <b>📢 {a.target === 'ALL' ? 'Everyone' : a.target}:</b> {a.message}{' '}
                  <span className="text-sky-300 font-bold">
                    ✔ {a.ackedCount}/{a.total}
                  </span>
                </div>
                <Btn small disabled={busy} onClick={() => run('announceEnd', { id: a.id }, 'Announcement ended')}>
                  End
                </Btn>
              </div>
            ))}
            {summons.map((s) => (
              <div
                key={s.id}
                className="bg-amber-950/60 border border-amber-500/60 text-amber-100 text-sm rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <b>🔔 Summoned:</b> {s.targetName} &middot; "{s.message}" &middot; awaiting acknowledgement
                </div>
                <Btn small disabled={busy} onClick={() => run('ringCancel', { empId: s.targetId }, 'Call cancelled')}>
                  Cancel
                </Btn>
              </div>
            ))}
            {recentHelp.map((h) => (
              <div
                key={h.id}
                className="bg-emerald-950/60 border border-emerald-500/60 text-emerald-100 text-sm rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 rise-in"
              >
                <div className="min-w-0 flex-1">
                  {HELP_ICON[h.type]} <b>{helpEventText(h)}</b>{' '}
                  <span className="text-emerald-300">&middot; {h.timeStr}</span>
                </div>
                <Btn small onClick={() => setModal({ type: 'helplog' })}>
                  Log
                </Btn>
              </div>
            ))}
            {nsPending > 0 && (
              <div className="bg-sky-950/70 border border-sky-500/70 text-sky-100 text-sm rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <b>📦 Non Sort:</b> {nsPending} request{nsPending > 1 ? 's' : ''} waiting for a count
                </div>
                <Btn small tone="yellow" onClick={() => setModal({ type: 'nonsort' })}>
                  Open Non Sort
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {moveMode && (
        <div className="bg-[#14213f] border-b-2 border-[#FEEE00]">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 text-sm">
            <b className="text-[#FEEE00]">Multi-move:</b>
            <span className="text-slate-300">tick CCs (or drag onto a line), then pick destination.</span>
            <span className="font-black text-white">{Object.keys(sel).filter((k) => sel[k]).length} selected</span>
            <select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="min-h-[44px] border border-slate-600 rounded-xl px-3 py-2 text-sm bg-[#0b1530] text-white"
            >
              <option value="">Move to...</option>
              {Object.keys(defs)
                .filter((c) => !disabled[c])
                .map((c) => (
                  <option key={c} value={c}>
                    {c} - {(defs[c] || {}).name}
                  </option>
                ))}
            </select>
            <Btn
              small
              tone="yellow"
              disabled={busy || !moveTarget || !Object.keys(sel).some((k) => sel[k])}
              onClick={() =>
                run(
                  'swapMany',
                  { empIds: Object.keys(sel).filter((k) => sel[k]), target: moveTarget },
                  (r) =>
                    'Moved ' +
                    r.moved +
                    ' to ' +
                    moveTarget +
                    (r.skipped && r.skipped.length ? ' (skipped ' + r.skipped.length + ')' : '')
                )
              }
            >
              Move selected
            </Btn>
            <Btn small onClick={() => setSel({})}>
              Clear ticks
            </Btn>
          </div>
        </div>
      )}

      {/* KPI band + Workstation Overview */}
      <div className="bg-[#0b1530] border-b border-slate-800">
        <div className="max-w-[1600px] mx-auto px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2">
          <Chip>
            📅 <b>{selDay.toUpperCase()}</b>
            <span
              className={
                'text-xs font-black px-2 py-0.5 rounded-md ' +
                (isToday
                  ? S.isShiftActive
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                  : 'bg-[#FEEE00] text-[#14213f]')
              }
            >
              {isToday ? (S.isShiftActive ? 'LIVE' : 'CLOSED') : 'PLAN'}
            </span>
          </Chip>
          <Chip tone="emerald">
            <UserCheck className="w-4 h-4" /> <b>{counts.present}</b> Present
          </Chip>
          <Chip tone="rose">
            <b>{counts.absent}</b> Absent
          </Chip>
          {counts.eo > 0 && (
            <Chip tone="amber">
              <b>{counts.eo}</b> Early out
            </Chip>
          )}
          {counts.wo > 0 && (
            <Chip>
              <b>{counts.wo}</b> Week off
            </Chip>
          )}
          <Chip tone="amber">
            <Coffee className="w-4 h-4" /> {breaksDone} Done &bull; {breaksPending} Pend
            {breakingNow > 0 ? ` • ${breakingNow} Out` : ''}
          </Chip>

          <div className="flex items-center gap-1.5 border border-slate-700 bg-[#14213f] rounded-xl px-2.5 py-1">
            <span className="text-xs font-bold text-slate-300 mr-1">Timer:</span>
            {[30, 45, 50].map((m) => (
              <button
                type="button"
                key={m}
                disabled={!isToday || busy}
                onClick={() => run('breakDuration', { mins: m }, 'Break set to ' + m + ' min')}
                className={
                  'min-h-[38px] px-2.5 py-1 rounded-lg text-sm font-black border transition ' +
                  (S.breakDurationSetting === m
                    ? 'bg-[#FEEE00] text-[#14213f] border-[#FEEE00]'
                    : 'bg-[#0b1530] text-slate-200 border-slate-600') +
                  ' disabled:opacity-40'
                }
              >
                {m}m
              </button>
            ))}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or ID..."
            className="min-h-[44px] w-full sm:w-52 border border-slate-600 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FEEE00] bg-[#14213f] text-white"
          />

          <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
            {forecastWarn.length > 0 && (
              <Chip tone="amber">
                🔮 Break risk: {forecastWarn.map((f) => f.code + ' ' + f.after + '/' + f.min).join(', ')}
              </Chip>
            )}
            {shortages.length === 0 ? (
              <Chip tone="emerald">✔ All lines staffed</Chip>
            ) : (
              <Chip tone="rose">⚠ Short: {shortages.map((x) => x.text).join(', ')}</Chip>
            )}
          </div>
        </div>

        {view === 'board' && (
          <div className="max-w-[1600px] mx-auto px-3 sm:px-4 pb-4 pt-1">
            {inspect && (
              <div className="mb-2.5">
                <Btn small tone="yellow" onClick={() => setInspect('')}>
                  <LayoutGrid className="w-4 h-4" /> Show all lines
                </Btn>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {ovCodes.map((c) => {
                const d = defs[c];
                const dis = !!disabled[c];
                const br = breachMap[c];
                const st = stat[c];
                const mn = (S.minStaff || {})[c] || 0;
                const bad = st.kind === 'short' || !!br;
                const pillTone =
                  st.kind === 'short'
                    ? 'bg-rose-950/80 text-rose-200 border-rose-500/70'
                    : st.kind === 'ok' || st.kind === 'extra'
                    ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/70'
                    : 'bg-[#0b1530] text-slate-300 border-slate-700';
                return (
                  <div
                    key={c}
                    onClick={() => setModal({ type: 'lineinfo', code: c })}
                    className={
                      'cursor-pointer rounded-2xl border p-2.5 bg-[#14213f] transition hover:border-[#FEEE00]/80 ' +
                      (inspect === c ? 'ring-2 ring-[#FEEE00] ' : '') +
                      (bad ? 'border-rose-500 ' : 'border-slate-700/80 ') +
                      (br ? 'pulse-red ' : '') +
                      (dis ? 'opacity-60' : '')
                    }
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={
                          'text-xs font-black text-white px-2 py-0.5 rounded-md ' + (d.headerBg || 'bg-slate-600')
                        }
                      >
                        {c}
                      </span>
                      <button
                        type="button"
                        disabled={!canAct || busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          run('toggleTask', { code: c }, dis ? c + ' enabled' : c + ' disabled');
                        }}
                        className="min-h-[34px] text-xs font-bold px-2 py-1 rounded-lg border bg-[#0b1530] text-slate-200 border-slate-600 hover:border-[#FEEE00] disabled:opacity-40"
                      >
                        {dis ? 'Enable' : 'Off'}
                      </button>
                    </div>
                    <div className="text-sm font-bold text-white mt-1.5 truncate" title={d.name}>
                      {d.name}
                    </div>
                    {fcMap[c] && (
                      <div className="mt-1 text-xs font-black text-amber-300">
                        ⚠ Next break {fcMap[c].after}/{fcMap[c].min}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-1.5 text-xs text-slate-300">
                      <span>Active:</span>
                      <span className={'font-bold rounded-md px-2 py-0.5 border ' + pillTone}>
                        {st.active}/{st.planned}
                      </span>
                    </div>
                    <div
                      className="flex items-center justify-between mt-2 text-xs text-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Min:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!canAct || busy || mn <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            run('minStaff', { code: c, n: mn - 1 });
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-600 bg-[#0b1530] text-white text-sm font-black disabled:opacity-30"
                        >
                          &minus;
                        </button>
                        <span className={'text-sm font-black w-5 text-center ' + (br ? 'text-rose-400' : 'text-white')}>
                          {mn > 0 ? mn : '–'}
                        </span>
                        <button
                          type="button"
                          disabled={!canAct || busy}
                          onClick={(e) => {
                            e.stopPropagation();
                            run('minStaff', { code: c, n: mn + 1 });
                          }}
                          className="w-8 h-8 rounded-lg border border-slate-600 bg-[#0b1530] text-white text-sm font-black disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={!canAct}
                onClick={() => setModal({ type: 'addTask' })}
                className="rounded-2xl border-2 border-dashed border-[#FEEE00]/70 text-[#FEEE00] bg-[#14213f] hover:bg-slate-800/70 disabled:opacity-40 min-h-[110px] flex flex-col items-center justify-center text-sm font-black p-3"
              >
                <span className="text-2xl leading-none mb-1">+</span>Add Task
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 py-4 space-y-4">
        {view === 'board' && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {visibleCols
              .filter((c) => c.t !== 'break' || isToday)
              .map((c, i) => (
                <div
                  key={c.t === 'break' ? 'BRK' : c.code}
                  id={'box-' + (c.t === 'break' ? 'BRK' : c.code)}
                  data-box={i}
                  data-col-code={c.t === 'break' ? 'BRK' : c.code}
                  className={
                    'h-[28rem] scroll-mt-24 rise-in rounded-2xl transition-shadow ' +
                    (c.t === 'line' && dropOn === c.code ? 'ring-4 ring-[#FEEE00]' : '')
                  }
                  onDragOver={(ev) => {
                    if (c.t !== 'break' && canAct) {
                      ev.preventDefault();
                      if (dropOn !== c.code) setDropOn(c.code);
                    }
                  }}
                  onDragLeave={() => {
                    if (c.t === 'line' && dropOn === c.code) setDropOn('');
                  }}
                  onDrop={(ev) => {
                    if (c.t === 'break' || !canAct) return;
                    ev.preventDefault();
                    setDropOn('');
                    let ids: string[] = [];
                    try {
                      ids = JSON.parse(ev.dataTransfer.getData('text/plain')) || [];
                    } catch {
                      // ignore
                    }
                    if (ids.length) {
                      run('swapMany', { empIds: ids, target: c.code }, (r) => 'Moved ' + r.moved + ' to ' + c.code);
                      setSel({});
                    }
                  }}
                >
                  {c.t === 'break' ? renderBreakCol() : renderLineCol(c.code)}
                </div>
              ))}
          </section>
        )}

        {view === 'roster' && (
          <RosterTable
            emps={emps}
            att={att}
            asg={asg}
            selDay={selDay}
            isToday={isToday}
            canAct={canAct}
            matches={matches}
            planFor={planFor}
            busy={busy}
            run={run}
            setModal={setModal}
            eStatusBadge={eStatusBadge}
          />
        )}
        {view === 'audit' && <Audit history={history} />}
        {view === 'weekly' && <Weekly weekly={weekly} weekDays={weekDays} setWeekDays={setWeekDays} />}
      </main>

      {toastMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] bg-[#FEEE00] text-[#14213f] text-sm font-black px-4 py-2.5 rounded-xl shadow-2xl max-w-[90vw] text-center">
          {toastMsg}
        </div>
      )}

      {modal && (
        <DashModalDispatcher
          modal={modal}
          setModal={setModal}
          S={S}
          token={token}
          emps={emps}
          att={att}
          asg={asg}
          defs={defs}
          run={run}
          callApiFn={callApiFn}
          busy={busy}
          toast={toast}
          nowSrv={nowSrv}
          onRequireAuth={onRequireAuth}
        />
      )}
    </div>
  );
};

const RosterTable: React.FC<{
  emps: Employee[];
  att: Record<string, string>;
  asg: LiveState['assignments'];
  selDay: string;
  isToday: boolean;
  canAct: boolean;
  matches: (e: Employee) => boolean;
  planFor: (e: Employee, d: string) => string;
  busy: boolean;
  run: (op: string, payload?: Record<string, unknown>, okMsg?: string | ((r: any) => string)) => void;
  setModal: (m: any) => void;
  eStatusBadge: (e: Employee) => React.ReactNode;
}> = ({ emps, att, asg, selDay, isToday, canAct, matches, planFor, busy, run, setModal, eStatusBadge }) => {
  const rows = emps.filter(matches);
  const label: Record<string, string> = { Present: 'Present', AB: 'Absent', LV: 'Leave', WO: 'Week Off', EO: 'Early Out' };
  return (
    <section className="bg-[#14213f] border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700">
        <h2 className="text-sm font-black text-white uppercase tracking-wide">Roster ({rows.length})</h2>
        <div className="flex flex-wrap gap-2">
          <Btn
            small
            tone="green"
            disabled={!canAct || busy}
            onClick={() =>
              run('markAllPresent', {}, (r) => (r.changed ? r.changed + ' marked present' : 'Everyone already present'))
            }
          >
            ✔ Mark all Present
          </Btn>
          <Btn small tone="yellow" disabled={busy} onClick={() => setModal({ type: 'joiner' })}>
            + Add Joiner
          </Btn>
        </div>
      </div>

      {/* Phone stacked cards (zero horizontal scroll) */}
      <div className="md:hidden divide-y divide-slate-800">
        {rows.map((e) => {
          const a = asg[e.id] || {};
          const s = att[e.id] || 'Present';
          return (
            <div key={e.id} className="p-3.5 space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">{e.name}</div>
                  <div className="text-xs text-slate-400 font-mono">{e.id}</div>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-lg bg-[#0b1530] border border-slate-700 text-[#FEEE00] shrink-0">
                  {planFor(e, selDay)}
                  {isToday && s === 'Present' && curStation(a, '') !== planFor(e, selDay)
                    ? ' → ' + curStation(a, '')
                    : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">{eStatusBadge(e)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  disabled={!isToday || busy}
                  value={s}
                  onChange={(ev) => {
                    const v = ev.target.value;
                    if (v === 'EO') setModal({ type: 'time', kind: 'early', emp: e });
                    else run('attendance', { empId: e.id, kind: v }, e.name + ': ' + label[v]);
                  }}
                  className="flex-1 min-h-[44px] border border-slate-600 rounded-xl px-3 py-2 text-sm bg-[#0b1530] text-white disabled:opacity-50"
                >
                  {Object.keys(label).map((k) => (
                    <option key={k} value={k}>
                      {label[k]}
                    </option>
                  ))}
                </select>
                <Btn
                  small
                  disabled={!isToday || busy || s === 'WO' || s === 'AB' || s === 'LV'}
                  onClick={() => setModal({ type: 'time', kind: 'late', emp: e })}
                >
                  ⏰ Late
                </Btn>
                <Btn small tone="rose" disabled={busy} onClick={() => setModal({ type: 'delete', emp: e })}>
                  🗑
                </Btn>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop/Tablet table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0b1530] text-slate-300 text-xs uppercase">
            <tr>
              <th className="text-left px-3 py-2.5">ID</th>
              <th className="text-left px-3 py-2.5">Name</th>
              <th className="text-left px-3 py-2.5">{isToday ? 'Plan / Now' : selDay + ' plan'}</th>
              <th className="text-left px-3 py-2.5">Attendance</th>
              <th className="text-left px-3 py-2.5">Notes</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const a = asg[e.id] || {};
              const s = att[e.id] || 'Present';
              return (
                <tr key={e.id} className="border-t border-slate-800 hover:bg-[#0b1530]/60">
                  <td className="px-3 py-2.5 font-mono text-slate-400">{e.id}</td>
                  <td className="px-3 py-2.5 font-bold text-white">{e.name}</td>
                  <td className="px-3 py-2.5 text-slate-200">
                    {planFor(e, selDay)}
                    {isToday && s === 'Present' && curStation(a, '') !== planFor(e, selDay)
                      ? ' → ' + curStation(a, '')
                      : ''}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <select
                        disabled={!isToday || busy}
                        value={s}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          if (v === 'EO') setModal({ type: 'time', kind: 'early', emp: e });
                          else run('attendance', { empId: e.id, kind: v }, e.name + ': ' + label[v]);
                        }}
                        className="min-h-[44px] border border-slate-600 rounded-xl px-2.5 py-1.5 text-sm bg-[#0b1530] text-white disabled:opacity-50"
                      >
                        {Object.keys(label).map((k) => (
                          <option key={k} value={k}>
                            {label[k]}
                          </option>
                        ))}
                      </select>
                      <Btn
                        small
                        disabled={!isToday || busy || s === 'WO' || s === 'AB' || s === 'LV'}
                        onClick={() => setModal({ type: 'time', kind: 'late', emp: e })}
                      >
                        ⏰ Late
                      </Btn>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">{eStatusBadge(e)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Btn small tone="ghost" disabled={busy} onClick={() => setModal({ type: 'delete', emp: e })}>
                      🗑
                    </Btn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const Audit: React.FC<{ history: any[] | null }> = ({ history }) => {
  const [open, setOpen] = useState('');
  if (history === null) return <div className="text-sm text-slate-300 p-6 text-center">Loading history...</div>;
  if (!history.length) {
    return (
      <div className="text-sm text-slate-300 p-6 text-center bg-[#14213f] border border-slate-700 rounded-2xl">
        No archived shifts yet. A record is saved automatically at 9:00 AM.
      </div>
    );
  }
  return (
    <section className="space-y-2.5">
      {history.map((h, i) => {
        const k = (h.id || '') + i;
        const s = h.summary || {};
        return (
          <div key={k} className="bg-[#14213f] border border-slate-700 rounded-2xl overflow-hidden">
            <button
              type="button"
              className="w-full min-h-[44px] text-left px-4 py-3 flex flex-wrap items-center justify-between gap-2"
              onClick={() => setOpen(open === k ? '' : k)}
            >
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{h.savedAt}</div>
                <div className="text-xs text-slate-300 mt-0.5">
                  {h.day} &middot; staff {s.totalStaff} &middot; present {s.presentCount} &middot; absent{' '}
                  {s.absentCount} &middot; week off {s.weekoffCount} &middot; breaks {s.breaksTakenCount}
                </div>
              </div>
              <span className="text-[#FEEE00] font-bold text-sm shrink-0">{open === k ? 'Hide' : 'Details'}</span>
            </button>
            {open === k && (
              <div className="border-t border-slate-700">
                <div className="md:hidden divide-y divide-slate-800">
                  {(h.roster || []).map((r: any) => (
                    <div key={r.id} className="p-3 text-sm space-y-1">
                      <div className="flex justify-between gap-2">
                        <b className="text-white">{r.name}</b>
                        <span className="text-xs text-[#FEEE00] font-bold">{r.attendance}</span>
                      </div>
                      <div className="text-xs text-slate-300">
                        Planned {r.planned} &middot; Line {r.activeStation} &middot; {r.roleText}
                      </div>
                      <div className="text-xs text-slate-400">{r.breakSummary}</div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#0b1530] text-slate-300 uppercase text-xs">
                      <tr>
                        <th className="text-left px-3 py-2">Name</th>
                        <th className="text-left px-3 py-2">Attendance</th>
                        <th className="text-left px-3 py-2">Planned</th>
                        <th className="text-left px-3 py-2">Station</th>
                        <th className="text-left px-3 py-2">Role</th>
                        <th className="text-left px-3 py-2">Break</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(h.roster || []).map((r: any) => (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="px-3 py-2 font-bold text-white">{r.name}</td>
                          <td className="px-3 py-2">{r.attendance}</td>
                          <td className="px-3 py-2">{r.planned}</td>
                          <td className="px-3 py-2">{r.activeStation}</td>
                          <td className="px-3 py-2">{r.roleText}</td>
                          <td className="px-3 py-2">{r.breakSummary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(!h.roster || !h.roster.length) && (
                  <div className="p-3 text-sm text-slate-400">No per-person detail stored for this record.</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
};

const Weekly: React.FC<{ weekly: any; weekDays: number; setWeekDays: (d: number) => void }> = ({
  weekly,
  weekDays,
  setWeekDays,
}) => {
  const rows: any[] = (weekly && weekly.rows) || [];
  const tot = rows.reduce((t, r) => {
    Object.keys(r).forEach((k) => {
      if (typeof r[k] === 'number') t[k] = (t[k] || 0) + r[k];
    });
    return t;
  }, {});
  const fm = (m: number) => (m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm');

  return (
    <section className="bg-[#14213f] border border-slate-700 rounded-2xl overflow-hidden">
      <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700">
        <div>
          <h2 className="text-sm font-black text-white uppercase tracking-wide">Weekly Record</h2>
          {weekly && weekly.success && (
            <div className="text-xs text-slate-300">
              From {weekly.from} &middot; {weekly.shiftCount} shift(s) recorded
            </div>
          )}
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30].map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => setWeekDays(d)}
              className={
                'min-h-[44px] px-3 py-1.5 rounded-xl text-sm font-bold border transition ' +
                (weekDays === d
                  ? 'bg-[#FEEE00] text-[#14213f] border-[#FEEE00]'
                  : 'bg-[#0b1530] text-slate-200 border-slate-600')
              }
            >
              {d} days
            </button>
          ))}
        </div>
      </div>
      {weekly === null ? (
        <div className="p-6 text-center text-sm text-slate-300">Loading...</div>
      ) : !weekly.success ? (
        <div className="p-6 text-center text-sm text-rose-400">{weekly.error || 'Could not load.'}</div>
      ) : rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-slate-300">No shifts recorded in this period yet.</div>
      ) : (
        <>
          <div className="md:hidden divide-y divide-slate-800">
            {rows.map((r) => (
              <div key={r.id} className="p-3.5 text-sm space-y-1">
                <div className="font-bold text-white">{r.name}</div>
                <div className="text-xs text-slate-300 grid grid-cols-2 gap-1">
                  <span>Duty: {r.daysOnDuty}d</span>
                  <span>Absent: {r.absent}</span>
                  <span>
                    Late: {r.lateCount} ({r.lateMins}m)
                  </span>
                  <span>Early out: {r.earlyOuts}</span>
                  <span>
                    Helper: {r.helperSessions} ({fm(r.helperMins)})
                  </span>
                  <span>
                    Overstay: {r.overstayCount} ({r.overstayMins}m)
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#0b1530] text-slate-300 text-xs uppercase">
                <tr>
                  {[
                    'Name',
                    'On duty',
                    'Absent',
                    'Late (days)',
                    'Late (min)',
                    'Early outs',
                    'Helper time',
                    'Helper sessions',
                    'Overstay (count)',
                    'Overstay (min)',
                  ].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800 hover:bg-[#0b1530]/60">
                    <td className="px-3 py-2 font-bold text-white">{r.name}</td>
                    <td className="px-3 py-2">{r.daysOnDuty}</td>
                    <td className="px-3 py-2">{r.absent}</td>
                    <td className="px-3 py-2">{r.lateCount}</td>
                    <td className="px-3 py-2">{r.lateMins}</td>
                    <td className="px-3 py-2">{r.earlyOuts}</td>
                    <td className="px-3 py-2">{fm(r.helperMins)}</td>
                    <td className="px-3 py-2">{r.helperSessions}</td>
                    <td className="px-3 py-2">{r.overstayCount}</td>
                    <td className="px-3 py-2">{r.overstayMins}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-600 bg-[#0b1530] font-black text-[#FEEE00]">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5">{tot.daysOnDuty || 0}</td>
                  <td className="px-3 py-2.5">{tot.absent || 0}</td>
                  <td className="px-3 py-2.5">{tot.lateCount || 0}</td>
                  <td className="px-3 py-2.5">{tot.lateMins || 0}</td>
                  <td className="px-3 py-2.5">{tot.earlyOuts || 0}</td>
                  <td className="px-3 py-2.5">{fm(tot.helperMins || 0)}</td>
                  <td className="px-3 py-2.5">{tot.helperSessions || 0}</td>
                  <td className="px-3 py-2.5">{tot.overstayCount || 0}</td>
                  <td className="px-3 py-2.5">{tot.overstayMins || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};

const DashModalDispatcher: React.FC<{
  modal: any;
  setModal: (m: any) => void;
  S: LiveState;
  token: string;
  emps: Employee[];
  att: Record<string, string>;
  asg: LiveState['assignments'];
  defs: LiveState['taskDefinitions'];
  run: (op: string, payload?: Record<string, unknown>, okMsg?: string) => void;
  callApiFn: (name: string, args: unknown[], okMsg?: string, after?: () => void) => void;
  busy: boolean;
  toast: (m: string) => void;
  nowSrv: () => number;
  onRequireAuth: () => void;
}> = ({
  modal,
  setModal,
  S,
  token,
  emps,
  att,
  asg,
  defs,
  run,
  callApiFn,
  busy,
  toast,
  nowSrv,
  onRequireAuth,
}) => {
  const close = () => setModal(null);
  const [text, setText] = useState(modal.preset || '');
  const [target, setTarget] = useState('ALL');
  const [time, setTime] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Riyadh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(nowSrv()));
    } catch {
      return '';
    }
  });
  const [tcode, setTcode] = useState('');
  const [tname, setTname] = useState('');
  const [color, setColor] = useState(0);
  const [jn, setJn] = useState('');
  const [jid, setJid] = useState('');
  const [jtask, setJtask] = useState('PK');
  const [jwo, setJwo] = useState('');
  const [jpw, setJpw] = useState('');
  const lines = Object.keys(defs).filter((c) => !(S.disabledTasks || {})[c]);

  if (modal.type === 'nonsort') return <NsPopup S={S} busy={busy} run={run} close={close} />;
  if (modal.type === 'helplog') return <HelpLogPopup S={S} close={close} />;
  if (modal.type === 'lineinfo') return <LineInfoPopup S={S} code={modal.code} nowSrv={nowSrv} close={close} />;
  if (modal.type === 'report')
    return (
      <ReportPopup S={S} token={token} close={close} nowSrv={nowSrv} toast={toast} onRequireAuth={onRequireAuth} />
    );
  if (modal.type === 'late')
    return <LatePopup S={S} token={token} close={close} onRequireAuth={onRequireAuth} />;
  if (modal.type === 'broadcast')
    return (
      <BroadcastPopup
        S={S}
        token={token}
        close={close}
        callApiFn={callApiFn}
        busy={busy}
        toast={toast}
        onRequireAuth={onRequireAuth}
      />
    );
  if (modal.type === 'prod')
    return (
      <ProductivityPopup
        token={token}
        close={close}
        ver={(S.prodVer || {}).v || (S.prodVer || {}).rows}
        onRequireAuth={onRequireAuth}
      />
    );

  if (modal.type === 'line') {
    const e = modal.emp;
    const isHelper = modal.mode === 'helper';
    return (
      <Modal title={(isHelper ? 'Deploy helper: ' : 'Swap line: ') + e.name} onClose={close}>
        <p className="text-sm text-slate-300 mb-3">
          {isHelper
            ? 'Temporary help. Their time on the other line is recorded.'
            : 'Permanently moves them to the chosen line for today.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {lines.map((c) => (
            <button
              type="button"
              key={c}
              disabled={busy}
              onClick={() => {
                close();
                run(isHelper ? 'helperDeploy' : 'swap', { empId: e.id, target: c }, e.name + ' → ' + c);
              }}
              className="min-h-[48px] text-left border border-slate-600 bg-[#0b1530] rounded-xl px-3 py-2 text-sm font-bold text-white hover:border-[#FEEE00]"
            >
              <span
                className={
                  'inline-block text-xs font-black text-white px-2 py-0.5 rounded-md mr-2 ' +
                  (defs[c].headerBg || 'bg-slate-600')
                }
              >
                {c}
              </span>
              {defs[c].name}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  if (modal.type === 'call') {
    const e = modal.emp;
    return (
      <Modal title={'Call ' + e.name} onClose={close}>
        <p className="text-sm text-slate-300 mb-2.5">Their PDA will buzz until they acknowledge.</p>
        <div className="space-y-2 mb-3">
          {SUMMON_PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setText(p)}
              className={
                'w-full min-h-[44px] text-left border rounded-xl px-3 py-2 text-sm font-semibold ' +
                (text === p
                  ? 'border-[#FEEE00] bg-[#FEEE00] text-[#14213f] font-bold'
                  : 'border-slate-600 bg-[#0b1530] text-slate-100 hover:border-slate-400')
              }
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          maxLength={120}
          placeholder="Or type a reason"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:border-[#FEEE00]"
        />
        <Btn
          tone="yellow"
          disabled={busy || !text.trim()}
          onClick={() => {
            close();
            run('ring', { empId: e.id, message: text.trim() }, 'Bell rung: ' + e.name);
          }}
          className="w-full"
        >
          🔔 Ring bell
        </Btn>
      </Modal>
    );
  }

  if (modal.type === 'announce') {
    return (
      <Modal title="Announcement" onClose={close}>
        <label className="text-xs font-bold uppercase text-slate-300">Send to</label>
        <select
          value={target}
          onChange={(ev) => setTarget(ev.target.value)}
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3 mt-1"
        >
          <option value="ALL">Everyone</option>
          {Object.keys(defs).map((c) => (
            <option key={c} value={c}>
              {c} - {defs[c].name}
            </option>
          ))}
        </select>
        <textarea
          rows={4}
          maxLength={240}
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder="Message (max 240 characters)"
          className="w-full border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FEEE00]"
        />
        <div className="text-right text-xs text-slate-400 mb-3">{text.length} / 240</div>
        <Btn
          tone="yellow"
          disabled={busy || !text.trim()}
          onClick={() => {
            close();
            run('announce', { target, message: text.trim() }, 'Announcement sent');
          }}
          className="w-full"
        >
          Send Announcement
        </Btn>
      </Modal>
    );
  }

  if (modal.type === 'time') {
    const e = modal.emp;
    const early = modal.kind === 'early';
    return (
      <Modal title={(early ? 'Early out: ' : 'Late arrival: ') + e.name} onClose={close}>
        <p className="text-sm text-slate-300 mb-3">
          {early
            ? 'Time they left. They are removed from their line.'
            : 'Time they arrived. Late minutes are counted from 12:00 AM.'}
        </p>
        <input
          type="time"
          value={time}
          onChange={(ev) => setTime(ev.target.value)}
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3"
        />
        <Btn
          tone="yellow"
          disabled={busy || !time}
          onClick={() => {
            close();
            run(
              'attendance',
              { empId: e.id, kind: modal.kind, time },
              e.name + (early ? ' left at ' : ' arrived at ') + time
            );
          }}
          className="w-full"
        >
          Save
        </Btn>
      </Modal>
    );
  }

  if (modal.type === 'addTask') {
    return (
      <Modal title="Add workstation" onClose={close}>
        <input
          value={tcode}
          onChange={(ev) => setTcode(ev.target.value.toUpperCase())}
          maxLength={6}
          placeholder="Code (e.g. QC)"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-2.5"
        />
        <input
          value={tname}
          onChange={(ev) => setTname(ev.target.value)}
          maxLength={40}
          placeholder="Name (e.g. Quality Check)"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3"
        />
        <div className="flex gap-2 mb-4 flex-wrap">
          {COLOR_CHOICES.map((c, i) => (
            <button
              type="button"
              key={c.label}
              onClick={() => setColor(i)}
              className={
                'min-h-[44px] px-3 py-1.5 rounded-xl text-sm text-white font-bold ' +
                c.headerBg +
                (i === color ? ' ring-2 ring-[#FEEE00]' : '')
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <Btn
          tone="yellow"
          disabled={busy || !tcode.trim()}
          onClick={() => {
            const c = COLOR_CHOICES[color];
            close();
            run(
              'addTask',
              { code: tcode.trim(), name: tname.trim(), headerBg: c.headerBg, pillBg: c.pillBg },
              'Workstation added'
            );
          }}
          className="w-full"
        >
          Add Workstation
        </Btn>
      </Modal>
    );
  }

  if (modal.type === 'joiner') {
    return (
      <Modal title="Add joiner (writes to the Roster sheet)" onClose={close}>
        <input
          value={jn}
          onChange={(ev) => setJn(ev.target.value)}
          placeholder="Full name"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-2.5"
        />
        <input
          value={jid}
          onChange={(ev) => setJid(ev.target.value)}
          placeholder="ID (leave empty to auto-create)"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-2.5"
        />
        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <select
            value={jtask}
            onChange={(ev) => setJtask(ev.target.value)}
            className="min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm"
          >
            {Object.keys(defs).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={jwo}
            onChange={(ev) => setJwo(ev.target.value)}
            className="min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm"
          >
            <option value="">Week off: none</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                Week off: {d}
              </option>
            ))}
          </select>
        </div>
        <input
          value={jpw}
          onChange={(ev) => setJpw(ev.target.value)}
          placeholder="PDA password (optional)"
          className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3"
        />
        <Btn
          tone="yellow"
          disabled={busy || !jn.trim()}
          onClick={() => {
            close();
            callApiFn('addRosterEmployee', [jn.trim(), jid.trim(), jtask, jwo, jpw], 'Joiner added');
          }}
          className="w-full"
        >
          Add to roster
        </Btn>
      </Modal>
    );
  }

  if (modal.type === 'delete') {
    const e = modal.emp;
    return (
      <Modal title="Remove from roster" onClose={close}>
        <p className="text-sm text-slate-200 mb-4">
          Delete <b>{e.name}</b> ({e.id}) from the Roster sheet? This cannot be undone from here.
        </p>
        <div className="flex gap-2">
          <Btn onClick={close} className="flex-1">
            Cancel
          </Btn>
          <Btn
            tone="rose"
            disabled={busy}
            onClick={() => {
              close();
              callApiFn('removeRosterEmployee', [e.id], 'Removed ' + e.name);
            }}
            className="flex-1"
          >
            Delete
          </Btn>
        </div>
      </Modal>
    );
  }

  if (modal.type === 'helpHelper') {
    const req = modal.req;
    const list = emps.filter(
      (w) => att[w.id] === 'Present' && !(asg[w.id] || {}).onBreak && lc(w.id) !== lc(req.empId)
    );
    return (
      <Modal title={'Send helper to ' + req.empName} onClose={close}>
        <p className="text-sm text-slate-300 mb-2.5">
          {req.location} ({req.station})
        </p>
        <div className="divide-y divide-slate-800 border border-slate-700 bg-[#0b1530] rounded-xl max-h-72 overflow-y-auto">
          {list.length === 0 && <div className="p-4 text-sm text-slate-400 text-center">No helpers available.</div>}
          {list.map((w) => (
            <button
              type="button"
              key={w.id}
              disabled={busy}
              onClick={() => {
                close();
                callApiFn('dispatchHelperToHelpCall', [req.id, w.id], 'Helper sent');
              }}
              className="w-full min-h-[44px] text-left px-3 py-2.5 text-sm hover:bg-[#14213f] flex justify-between items-center gap-2"
            >
              <span className="font-bold text-white truncate">{w.name}</span>
              <span className="text-xs font-bold text-[#FEEE00] shrink-0">{curStation(asg[w.id], '')}</span>
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  return null;
};
