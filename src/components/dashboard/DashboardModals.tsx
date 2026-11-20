import React, { useEffect, useRef, useState } from 'react';
import { gs } from '../../api/appsScript';
import { LiveState } from '../../types/shift';
import { shrinkImage } from '../../utils/image';

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const COLOR_CHOICES = [
  { label: 'Slate', headerBg: 'bg-slate-600', pillBg: 'bg-slate-800 text-slate-100 border-slate-600' },
  { label: 'Blue', headerBg: 'bg-sky-700', pillBg: 'bg-sky-900/60 text-sky-200 border-sky-700' },
  { label: 'Emerald', headerBg: 'bg-emerald-700', pillBg: 'bg-emerald-900/60 text-emerald-200 border-emerald-700' },
  { label: 'Amber', headerBg: 'bg-amber-600', pillBg: 'bg-amber-900/60 text-amber-200 border-amber-700' },
  { label: 'Rose', headerBg: 'bg-rose-700', pillBg: 'bg-rose-900/60 text-rose-200 border-rose-700' },
  { label: 'Violet', headerBg: 'bg-violet-700', pillBg: 'bg-violet-900/60 text-violet-200 border-violet-700' },
];

export const SUMMON_PRESETS = [
  'Report to TL desk immediately',
  'Check your line right now',
  'Break ended - return to line',
  'Call your Floor Lead now',
];

export const lc = (s: unknown) => String(s == null ? '' : s).trim().toLowerCase();

export function fmtMMSS(ms: number): string {
  ms = Math.max(0, ms);
  let s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  s = s % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function fmt12(ms: number): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(ms));
  } catch {
    return '';
  }
}

export function curStation(a: { activeStation?: string; task1?: string } | undefined, plan?: string): string {
  if (!a) return plan || '';
  if (a.activeStation && a.activeStation !== 'None') return a.activeStation;
  if (a.task1 && a.task1 !== 'None') return a.task1;
  return plan || '';
}

export function fmtSecsShort(n: number): string {
  n = Math.round(Number(n) || 0);
  return n >= 60 ? Math.floor(n / 60) + 'm ' + (n % 60) + 's' : n + 's';
}

export function lateList(S: LiveState) {
  const det = S.attendanceDetail || {};
  return (S.employees || [])
    .filter((e) => det[e.id] && det[e.id].late)
    .map((e) => ({
      id: e.id,
      name: e.name,
      time: det[e.id].late!.time,
      mins: det[e.id].late!.mins,
    }))
    .sort((a, b) => b.mins - a.mins);
}

export const HELP_ICON: Record<string, string> = {
  raised: '🆘',
  accepted: '🤝',
  dispatched: '🚶',
  cleared: '✅',
};

export function actorLabel(h: { by: string; byRole: string }): string {
  return h.byRole === 'Dashboard' ? 'Supervisor (Dashboard)' : h.by + ' (' + h.byRole + ')';
}

export function helpEventText(h: {
  type: string;
  empName: string;
  location: string;
  station?: string;
  by: string;
  byRole: string;
  helperName?: string;
}): string {
  const where = h.empName + ' at ' + h.location + (h.station ? ' (' + h.station + ')' : '');
  if (h.type === 'raised') return where + ' asked for help';
  if (h.type === 'accepted') return actorLabel(h) + ' accepted: ' + where;
  if (h.type === 'dispatched') return actorLabel(h) + ' sent ' + (h.helperName || 'a helper') + ' to ' + where;
  return actorLabel(h) + ' cleared: ' + where;
}

export const Modal: React.FC<{
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
  size?: 'xl' | 'xxl';
}> = ({ title, onClose, children, wide, size }) => (
  <div
    className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4 overflow-hidden"
    onClick={onClose}
  >
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={
        'bg-[#14213f] text-slate-100 border-0 md:border md:border-slate-600/80 shadow-2xl w-full h-full md:h-auto md:max-h-[90vh] flex flex-col overflow-hidden md:rounded-2xl ' +
        (size === 'xxl' || size === 'xl'
          ? 'md:max-w-[900px]'
          : wide
          ? 'md:max-w-[700px]'
          : 'md:max-w-md')
      }
      onClick={(e) => e.stopPropagation()}
    >
      <div className="shrink-0 sticky top-0 z-10 bg-[#0b1530] border-b border-slate-700 px-4 py-3 flex items-center justify-between gap-3">
        <h3 className="text-base font-black text-white truncate min-w-0">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FEEE00] text-[#14213f] text-sm font-black shrink-0 shadow active:scale-95"
        >
          Close
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 text-sm">{children}</div>
    </div>
  </div>
);

export const Btn: React.FC<{
  onClick?: () => void;
  children: React.ReactNode;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'ghost' | 'yellow';
  disabled?: boolean;
  small?: boolean;
  title?: string;
  className?: string;
}> = ({ onClick, children, tone = 'slate', disabled, small, title, className = '' }) => {
  const tones = {
    slate: 'bg-[#0b1530] text-slate-100 border-slate-600 hover:border-slate-400 hover:bg-slate-800/80',
    yellow: 'bg-[#FEEE00] text-[#14213f] border-[#FEEE00] hover:brightness-95',
    blue: 'bg-sky-600 text-white border-sky-500 hover:bg-sky-500',
    green: 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500',
    amber: 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400',
    rose: 'bg-rose-600 text-white border-rose-500 hover:bg-rose-500',
    ghost: 'bg-transparent text-slate-200 border-transparent hover:bg-slate-800/70',
  };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={
        'border rounded-xl font-bold transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ' +
        (small ? 'min-h-[44px] px-3 py-2 text-sm' : 'min-h-[44px] px-4 py-2.5 text-sm') +
        ' ' +
        tones[tone] +
        (className ? ' ' + className : '')
      }
    >
      {children}
    </button>
  );
};

export const LinkBtn: React.FC<{
  onClick: () => void;
  tone?: string;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, tone = 'text-slate-300', disabled, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={
      'min-h-[44px] px-2.5 py-2 text-sm font-bold rounded-lg hover:bg-slate-800/70 disabled:opacity-40 ' +
      tone
    }
  >
    {children}
  </button>
);

const CHIP_TONES = {
  slate: 'bg-[#0b1530] border-slate-700 text-slate-200',
  emerald: 'bg-emerald-950/70 border-emerald-600/60 text-emerald-200',
  rose: 'bg-rose-950/80 border-rose-600/70 text-rose-200',
  amber: 'bg-amber-950/70 border-amber-500/60 text-amber-200',
  sky: 'bg-sky-950/70 border-sky-600/60 text-sky-200',
};

export const Chip: React.FC<{
  tone?: keyof typeof CHIP_TONES;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'slate', children, className = '' }) => (
  <span
    className={
      'inline-flex items-center gap-1.5 text-sm font-semibold border rounded-xl px-3 py-1.5 ' +
      CHIP_TONES[tone] +
      ' ' +
      className
    }
  >
    {children}
  </span>
);

export const PhotoThumb: React.FC<{ url?: string; h?: string }> = ({ url, h }) => {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <span className="inline-block align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border-2 border-white/70 overflow-hidden bg-slate-900 cursor-zoom-in"
        title="Tap to enlarge photo"
      >
        <img src={url} alt="help photo" className={'object-cover ' + (h || 'h-11 w-11')} />
      </button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[300] bg-black/95 flex flex-col items-center justify-center p-4 gap-4 cursor-zoom-out"
        >
          <img src={url} alt="Help attachment enlarged" className="max-w-full max-h-[82vh] rounded-xl shadow-2xl" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="min-h-[44px] px-6 py-2 rounded-xl bg-[#FEEE00] text-[#14213f] font-black text-sm"
          >
            Close Photo
          </button>
        </div>
      )}
    </span>
  );
};

// ---------- Non Sort popup ----------
const NsReqCard: React.FC<{
  r: NonNullable<LiveState['nonSortRequests']>[number];
  busy: boolean;
  run: (op: string, payload: Record<string, unknown>, okMsg?: string) => void;
}> = ({ r, busy, run }) => {
  const [qty, setQty] = useState('');
  const valid = parseInt(qty, 10) >= 1;
  const send = () => {
    if (valid && !busy) {
      run('nsSetCount', { id: r.id, count: parseInt(qty, 10) }, 'Count ' + qty + ' sent to ' + r.empName);
    }
  };
  return (
    <div
      className={
        'rounded-xl border px-3.5 py-3 ' +
        (r.status === 'pending'
          ? 'bg-[#0b1530] border-sky-500/60'
          : 'bg-emerald-950/50 border-emerald-500/60')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{r.empName}</div>
          <div className="text-sm font-mono text-slate-300 break-all">AWB {r.awb}</div>
          <div className="text-xs text-slate-400">{r.timeStr}</div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('nsCancel', { id: r.id }, 'Request removed')}
          title="Remove request"
          className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:text-rose-400 hover:bg-rose-950/50 text-lg font-black leading-none flex items-center justify-center disabled:opacity-40"
        >
          &times;
        </button>
      </div>
      {r.status === 'pending' ? (
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send();
            }}
            placeholder="Enter Qty"
            className="flex-1 min-w-[120px] min-h-[44px] border border-slate-600 rounded-xl px-3 py-2 text-sm bg-[#14213f] text-white outline-none focus:border-[#FEEE00]"
          />
          <Btn tone="yellow" disabled={busy || !valid} onClick={send}>
            Send count
          </Btn>
        </div>
      ) : (
        <div className="mt-2 text-sm font-semibold text-emerald-300">
          Count sent: <b>{r.count} Qty</b> &middot; waiting for {r.empName} to confirm putaway
        </div>
      )}
    </div>
  );
};

export const NsPopup: React.FC<{
  S: LiveState;
  busy: boolean;
  run: (op: string, payload: Record<string, unknown>, okMsg?: string) => void;
  close: () => void;
}> = ({ S, busy, run, close }) => {
  const reqs = S.nonSortRequests || [];
  const board = S.sheetLeaderboard || [];
  const pending = reqs.filter((r) => r.status === 'pending');
  const ready = reqs.filter((r) => r.status !== 'pending');
  const totalAwb = board.reduce((n, x) => n + (x.awbs || 0), 0);
  const totalQty = board.reduce((n, x) => n + (x.totalCount || 0), 0);
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1));

  return (
    <Modal title="📦 Non Sort" onClose={close} size="xl">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div
          className={
            'rounded-xl border px-3 py-2.5 ' +
            (pending.length ? 'bg-rose-950/70 border-rose-500/70' : 'bg-[#0b1530] border-slate-700')
          }
        >
          <div className="text-xs uppercase font-bold text-slate-300">Need count</div>
          <div className={'text-xl font-black ' + (pending.length ? 'text-rose-300' : 'text-white')}>
            {pending.length}
          </div>
        </div>
        <div className="rounded-xl border bg-[#0b1530] border-indigo-500/50 px-3 py-2.5">
          <div className="text-xs uppercase font-bold text-slate-300">AWBs today</div>
          <div className="text-xl font-black text-sky-300">{totalAwb}</div>
        </div>
        <div className="rounded-xl border bg-[#0b1530] border-emerald-500/50 px-3 py-2.5">
          <div className="text-xs uppercase font-bold text-slate-300">Qty today</div>
          <div className="text-xl font-black text-emerald-300">{totalQty}</div>
        </div>
      </div>

      <h4 className="text-xs font-black uppercase tracking-wide text-[#FEEE00] mb-2">
        Waiting for your count ({pending.length})
      </h4>
      <div className="space-y-2 mb-4">
        {pending.length === 0 && (
          <div className="text-sm text-slate-400 italic border border-dashed border-slate-700 rounded-xl text-center py-4 px-3">
            No requests right now. When a CC scans an AWB it appears here.
          </div>
        )}
        {pending.map((r) => (
          <NsReqCard key={r.id} r={r} busy={busy} run={run} />
        ))}
      </div>

      {ready.length > 0 && (
        <>
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-300 mb-2">
            Count sent, waiting for putaway ({ready.length})
          </h4>
          <div className="space-y-2 mb-4">
            {ready.map((r) => (
              <NsReqCard key={r.id} r={r} busy={busy} run={run} />
            ))}
          </div>
        </>
      )}

      <h4 className="text-xs font-black uppercase tracking-wide text-[#FEEE00] mb-2">
        Leaderboard (today)
      </h4>
      {board.length === 0 ? (
        <div className="text-sm text-slate-400 italic">No Non Sort putaways yet today.</div>
      ) : (
        <div className="border border-slate-700 rounded-xl overflow-hidden bg-[#0b1530]">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-300 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2 w-10">#</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-right px-3 py-2">AWBs</th>
                <th className="text-right px-3 py-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {board.map((it, i) => (
                <tr key={it.empName} className="border-t border-slate-800">
                  <td className="px-3 py-2">{medal(i)}</td>
                  <td className="px-3 py-2 font-bold text-white break-words">{it.empName}</td>
                  <td className="px-3 py-2 text-right text-sky-300 font-bold">{it.awbs}</td>
                  <td className="px-3 py-2 text-right text-emerald-300 font-black">{it.totalCount}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-900/90 font-black">
              <tr className="border-t border-slate-700">
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2 text-white">Total</td>
                <td className="px-3 py-2 text-right text-sky-300">{totalAwb}</td>
                <td className="px-3 py-2 text-right text-emerald-300">{totalQty}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="text-xs text-slate-400 mt-2">Synced with the "non sort" sheet.</div>
    </Modal>
  );
};

// ---------- Shift report ----------
const pctTxt = (a: number | null | undefined) => (a == null ? '-' : Math.round(a * 100) + '%');

function prodLine(r: any): string {
  if (!r || !r.success || !r.found) return '';
  const ppl = (r.people || []).filter((p: any) => p.hours >= 2 && p.ach != null);
  if (!ppl.length) return '';
  const by = ppl.slice().sort((a: any, b: any) => b.ach - a.ach);
  const top = by[0];
  const low = by.filter((p: any) => p.ok === false).slice(-3).reverse();
  const on = ppl.filter((p: any) => p.ok).length;
  return (
    'Productivity ' +
    r.date +
    ': top ' +
    top.name +
    ' (' +
    top.tph +
    ' TPH, ' +
    pctTxt(top.ach) +
    ' of target) | on target ' +
    on +
    '/' +
    ppl.length +
    (low.length ? ' | lowest: ' + low.map((p: any) => p.name + ' ' + pctTxt(p.ach)).join(', ') : '')
  );
}

function buildReport(S: LiveState, nowMs: number, prodRep: any): string {
  const emps = S.employees || [];
  const att = S.attendance || {};
  const asg = S.assignments || {};
  const cnt = { p: 0, a: 0, eo: 0, wo: 0 };
  emps.forEach((e) => {
    const x = att[e.id];
    if (x === 'Present') cnt.p++;
    else if (x === 'AB' || x === 'LV') cnt.a++;
    else if (x === 'EO') cnt.eo++;
    else if (x === 'WO') cnt.wo++;
  });
  const done = emps.filter((e) => asg[e.id] && asg[e.id].breakStatus === 'completed').length;
  const pend = emps.filter((e) => att[e.id] === 'Present' && asg[e.id] && asg[e.id].breakStatus === 'pending').length;
  const brkNow = emps.filter((e) => att[e.id] === 'Present' && asg[e.id] && asg[e.id].onBreak).length;
  const late = lateList(S);
  const absent = emps.filter((e) => att[e.id] === 'AB' || att[e.id] === 'LV').map((e) => e.name);
  const hs = S.helpStats || { raised: 0, accepted: 0, totalMs: 0, maxMs: 0, escalated: 0 };
  const avg = hs.accepted ? fmtSecsShort(hs.totalMs / hs.accepted / 1000) : '-';
  const ov = (S.overstayDone || 0) + (S.overstayBreaks || []).length;
  const L: string[] = [];
  L.push('*' + (S.shiftName || 'Shift A') + ' - ' + S.currentRealDay + ' ' + (S.currentDateStr || '') + '*  (' + fmt12(nowMs) + ')');
  L.push('Present ' + cnt.p + ' | Absent ' + cnt.a + ' | Week off ' + cnt.wo + ' | Early out ' + cnt.eo);
  L.push('Breaks: ' + done + ' done, ' + pend + ' pending, ' + brkNow + ' on break now');
  L.push('Break overstays: ' + ov + ((S.overstayBreaks || []).length ? ' (' + S.overstayBreaks!.length + ' still over)' : ''));
  L.push('Help calls: raised ' + (hs.raised || 0) + ', accepted ' + (hs.accepted || 0) + ', avg response ' + avg + ', slowest ' + fmtSecsShort((hs.maxMs || 0) / 1000) + ', not accepted in 3+ min ' + (hs.escalated || 0));
  L.push('Late (' + late.length + '): ' + (late.length ? late.map((l) => l.name + ' ' + l.time + ' (+' + l.mins + 'm)').join(', ') : 'none'));
  L.push('Absent/Leave (' + absent.length + '): ' + (absent.length ? absent.join(', ') : 'none'));
  const br = S.minStaffBreaches || [];
  L.push('Min-staff breaches now: ' + (br.length ? br.map((b) => b.code + ' ' + b.active + '/' + b.min).join(', ') : 'none'));
  const lines = Object.keys(S.taskDefinitions || {})
    .map((c) => {
      const n = emps.filter((e) => att[e.id] === 'Present' && curStation(asg[e.id], '') === c).length;
      return n ? c + ' ' + n : '';
    })
    .filter(Boolean);
  L.push('Active by line: ' + lines.join(' | '));
  const pl = prodLine(prodRep);
  if (pl) L.push(pl);
  return L.join('\n');
}

function copyText(t: string, done: (ok: boolean) => void): void {
  const fb = () => {
    try {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!ok);
    } catch {
      done(false);
    }
  };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => done(true), fb);
      return;
    }
  } catch {
    // fallback
  }
  fb();
}

export const ReportPopup: React.FC<{
  S: LiveState;
  token: string;
  close: () => void;
  nowSrv: () => number;
  toast: (m: string) => void;
  onRequireAuth?: () => void;
}> = ({ S, token, close, nowSrv, toast, onRequireAuth }) => {
  const [prodRep, setProdRep] = useState<any>(null);
  useEffect(() => {
    gs(
      'getProductivityReport',
      [token, '', false],
      (r: any) => {
        if (r && (r.code === 'AUTH' || r.authRequired)) {
          onRequireAuth?.();
          return;
        }
        setProdRep(r);
      },
      () => {}
    );
  }, [token, onRequireAuth]);
  const txt = buildReport(S, nowSrv(), prodRep);

  return (
    <Modal title="📋 Shift report" onClose={close} wide>
      <div className="print-area">
        <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed font-sans bg-[#0b1530] text-slate-100 border border-slate-700 rounded-xl p-3.5">
          {txt.replace(/\*/g, '')}
        </pre>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <Btn
          tone="yellow"
          onClick={() => copyText(txt, (ok) => toast(ok ? 'Report copied - paste it in WhatsApp' : 'Could not copy'))}
        >
          Copy text
        </Btn>
        <Btn
          tone="green"
          onClick={() => {
            try {
              const a = document.createElement('a');
              a.href = 'https://wa.me/?text=' + encodeURIComponent(txt);
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.click();
            } catch {
              toast('Could not open WhatsApp');
            }
          }}
        >
          WhatsApp
        </Btn>
        <Btn
          onClick={() => {
            try {
              window.print();
            } catch {
              toast('Print is not available here');
            }
          }}
        >
          Print / Save PDF
        </Btn>
      </div>
    </Modal>
  );
};

export const LatePopup: React.FC<{
  S: LiveState;
  token: string;
  close: () => void;
  onRequireAuth?: () => void;
}> = ({ S, token, close, onRequireAuth }) => {
  const late = lateList(S);
  const [trend, setTrend] = useState<any>(null);
  useEffect(() => {
    gs(
      'getAttendanceTrend',
      [token, 7],
      (r: any) => {
        if (r && (r.code === 'AUTH' || r.authRequired)) {
          onRequireAuth?.();
          return;
        }
        setTrend(r || { success: false });
      },
      () => setTrend({ success: false })
    );
  }, [token, onRequireAuth]);
  const rows = (trend && trend.rows) || [];
  const mx = Math.max(1, ...rows.map((r: any) => r.present + r.absent + r.weekOff));

  return (
    <Modal title={'⏰ Late today (' + late.length + ')'} onClose={close} wide>
      {late.length === 0 && (
        <div className="text-sm text-slate-400 italic text-center py-4">Nobody is marked late today.</div>
      )}
      <div className="space-y-2">
        {late.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-2 border border-amber-500/60 bg-amber-950/50 rounded-xl px-3.5 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <b className="text-white">{l.name}</b> <span className="text-slate-400 font-mono text-xs">{l.id}</span>
            </div>
            <div className="font-bold text-amber-300 whitespace-nowrap">
              arrived {l.time} &middot; +{l.mins} min
            </div>
          </div>
        ))}
      </div>
      <h4 className="text-xs font-black uppercase text-[#FEEE00] mt-5 mb-2">
        Attendance trend (last 7 days)
      </h4>
      {trend === null ? (
        <div className="text-sm text-slate-400">Loading...</div>
      ) : !trend.success ? (
        <div className="text-sm text-rose-400">{trend.error || 'Could not load the trend.'}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400 italic">
          No archived days yet - the trend fills in after each shift closes.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => (
            <div key={r.date} className="bg-[#0b1530] border border-slate-700 rounded-xl p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-slate-300 font-mono font-bold">{String(r.date).slice(5)}</span>
                <span className="text-slate-300 text-xs font-semibold">
                  P {r.present} &middot; A {r.absent} &middot; Late {r.late}
                </span>
              </div>
              <div className="w-full flex h-3 rounded-full overflow-hidden bg-slate-800">
                <div className="bg-emerald-500" style={{ width: (r.present / mx) * 100 + '%' }} title={'Present ' + r.present}></div>
                <div className="bg-rose-500" style={{ width: (r.absent / mx) * 100 + '%' }} title={'Absent ' + r.absent}></div>
                <div className="bg-slate-400" style={{ width: (r.weekOff / mx) * 100 + '%' }} title={'Week off ' + r.weekOff}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

// ---------- Line details popup ----------
export const LineInfoPopup: React.FC<{
  S: LiveState;
  code: string;
  nowSrv: () => number;
  close: () => void;
}> = ({ S, code, nowSrv, close }) => {
  const emps = S.employees || [];
  const att = S.attendance || {};
  const asg = S.assignments || {};
  const defs = S.taskDefinitions || {};
  const d = defs[code] || { name: code };
  const now = nowSrv();
  const realDay = S.currentRealDay;
  const planOf = (e: LiveState['employees'][number]) => (e.plan && e.plan[realDay]) || 'PK';
  const here = emps.filter((e) => att[e.id] === 'Present' && curStation(asg[e.id], '') === code);
  const working = here.filter((e) => !(asg[e.id] || {}).onBreak);
  const onBrk = here.filter((e) => (asg[e.id] || {}).onBreak);
  const planned = emps.filter((e) => planOf(e) === code && att[e.id] !== 'WO');
  const missing = planned.filter((e) => !here.some((h) => h.id === e.id));
  const helpers = emps.filter(
    (e) => att[e.id] === 'Present' && (asg[e.id] || {}).isHelping && (asg[e.id] || {}).originalStation === code
  );
  const pend = here.filter((e) => (asg[e.id] || {}).breakStatus === 'pending' && !(asg[e.id] || {}).onBreak).length;
  const done = here.filter((e) => (asg[e.id] || {}).breakStatus === 'completed').length;
  const mn = (S.minStaff || {})[code] || 0;
  const calls = (S.activeHelpRequests || []).filter((r) => r.station === code);
  const det = S.attendanceDetail || {};
  const lbl: Record<string, string> = { AB: 'Absent', LV: 'Leave', EO: 'Early out', WO: 'Week off' };

  const Stat = ({ k, v, tone }: { k: string; v: string | number; tone?: string }) => (
    <div className={'rounded-xl border px-2.5 py-2 text-center ' + (tone || 'bg-[#0b1530] border-slate-700')}>
      <div className="text-lg font-black leading-tight text-white">{v}</div>
      <div className="text-xs text-slate-300 font-semibold mt-0.5">{k}</div>
    </div>
  );

  return (
    <Modal title={code + ' - ' + (d.name || code)} onClose={close} wide>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        <Stat k="Planned" v={planned.length} />
        <Stat
          k="Working"
          v={working.length}
          tone={
            working.length < planned.length - onBrk.length
              ? 'bg-rose-950/70 border-rose-500/70'
              : 'bg-emerald-950/60 border-emerald-500/70'
          }
        />
        <Stat k="On break" v={onBrk.length} tone="bg-amber-950/60 border-amber-500/70" />
        <Stat k="Breaks done" v={done} />
        <Stat k="Breaks pending" v={pend} />
        <Stat k="Min alarm" v={mn || '-'} />
      </div>
      {calls.length > 0 && (
        <div className="mb-4 space-y-1.5">
          {calls.map((r) => (
            <div
              key={r.id}
              className={
                'text-sm rounded-xl px-3 py-2 border flex flex-wrap items-center justify-between gap-2 ' +
                (r.escalated ? 'bg-rose-700 text-white border-rose-400' : 'bg-rose-950/80 border-rose-500 text-rose-100')
              }
            >
              <div className="min-w-0">
                &#128680; <b>{r.empName}</b> needs help at {r.location}
                {r.reason ? ' - ' + r.reason : ''} &middot;{' '}
                {r.status === 'accepted'
                  ? 'accepted by ' + r.acceptedBy
                  : 'waiting ' + Math.floor((r.waitMs || 0) / 60000) + ' min'}
              </div>
              {r.imageUrl ? <PhotoThumb url={r.imageUrl} h="h-10 w-10" /> : null}
            </div>
          ))}
        </div>
      )}
      <h4 className="text-xs font-black uppercase text-[#FEEE00] mb-1.5">Working now ({working.length})</h4>
      <div className="space-y-1.5 mb-4">
        {working.length === 0 && (
          <div className="text-sm text-slate-400 italic">Nobody is working on this line right now.</div>
        )}
        {working.map((e) => {
          const a = asg[e.id] || {};
          const l = (det[e.id] || {}).late;
          return (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 border border-slate-700 bg-[#0b1530] rounded-xl px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <b className="text-white">{e.name}</b> <span className="text-slate-400 font-mono text-xs">{e.id}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {a.isHelping ? (
                  <span className="px-2 py-0.5 rounded-md bg-amber-900/70 text-amber-200 border border-amber-500/60 text-xs font-bold">
                    Helper (base {a.originalStation})
                  </span>
                ) : a.swappedFrom ? (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-900/70 text-indigo-200 border border-indigo-500/60 text-xs font-bold">
                    Covering (plan {a.swappedFrom})
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-600 text-xs font-semibold">
                    Primary
                  </span>
                )}
                {l && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-900/70 text-amber-200 border border-amber-500/60 text-xs font-bold">
                    Late {l.mins}m
                  </span>
                )}
                <span
                  className={
                    'px-2 py-0.5 rounded-md border text-xs font-semibold ' +
                    (a.breakStatus === 'completed'
                      ? 'bg-emerald-950/70 text-emerald-300 border-emerald-600/60'
                      : 'bg-slate-800 text-slate-300 border-slate-600')
                  }
                >
                  {a.breakStatus === 'completed' ? 'Break done' : 'Break pending'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {onBrk.length > 0 && (
        <>
          <h4 className="text-xs font-black uppercase text-amber-300 mb-1.5">On break ({onBrk.length})</h4>
          <div className="space-y-1.5 mb-4">
            {onBrk.map((e) => {
              const a = asg[e.id] || {};
              const diff = (a.breakEndTime || 0) - now;
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 border border-amber-500/60 bg-amber-950/40 rounded-xl px-3 py-2 text-sm"
                >
                  <div>
                    <b className="text-white">{e.name}</b> <span className="text-slate-400 font-mono text-xs">{e.id}</span>
                  </div>
                  <div className={'font-mono font-black ' + (diff < 0 ? 'text-rose-400' : 'text-amber-300')}>
                    {diff < 0 ? 'overstay +' : ''}
                    {fmtMMSS(Math.abs(diff))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {missing.length > 0 && (
        <>
          <h4 className="text-xs font-black uppercase text-slate-300 mb-1.5">
            Planned for {code} but not here ({missing.length})
          </h4>
          <div className="space-y-1.5 mb-4">
            {missing.map((e) => {
              const st = att[e.id];
              const a = asg[e.id] || {};
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-slate-700 bg-[#0b1530] rounded-xl px-3 py-2 text-sm"
                >
                  <div>
                    <b className="text-white">{e.name}</b> <span className="text-slate-400 font-mono text-xs">{e.id}</span>
                  </div>
                  <div className="text-slate-300 font-semibold">
                    {st === 'Present'
                      ? 'now on ' + curStation(a, '') + (a.isHelping ? ' (helper)' : '')
                      : lbl[st] || st}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {helpers.length > 0 && (
        <>
          <h4 className="text-xs font-black uppercase text-slate-300 mb-1.5">
            Sent out as helpers ({helpers.length})
          </h4>
          <div className="space-y-1.5">
            {helpers.map((e) => (
              <div key={e.id} className="text-sm border border-slate-700 bg-[#0b1530] rounded-xl px-3 py-2">
                <b className="text-white">{e.name}</b> &rarr; {curStation(asg[e.id], '')}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
};

// ---------- Productivity popup ----------
const prettyType = (t: string) => String(t || '').replace(/_/g, ' ');
const hourLbl = (h: number) => String(h).padStart(2, '0') + ':00';
function shiftDateStr(d: string, n: number): string {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
const okCls = (ok: boolean | null | undefined) =>
  ok === false ? 'text-rose-400' : ok === true ? 'text-emerald-300' : 'text-slate-200';

function useProd(
  op: string,
  key: string,
  args: unknown[],
  ver: unknown,
  enabled: boolean,
  onRequireAuth?: () => void
) {
  const [data, setData] = useState<any>(null);
  const keyRef = useRef('');
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    if (keyRef.current !== key) {
      setData(null);
      keyRef.current = key;
    }
    gs(
      op,
      args,
      (r: any) => {
        if (!live) return;
        if (r && (r.code === 'AUTH' || r.authRequired)) {
          onRequireAuth?.();
          return;
        }
        setData(r || { success: false });
      },
      () => {
        if (live) setData((cur: any) => (cur && cur.success ? cur : { success: false, error: 'Network problem.' }));
      }
    );
    return () => {
      live = false;
    };
  }, [key, ver, enabled]);
  return data;
}

function gapVerdict(p: any): string {
  const g = (p.gaps || []).length;
  if (!g) return '';
  const b = p.brk;
  if (!b) return 'no break data for this day';
  const cover = (b.breakMins || 0) + (b.overstayMins || 0) + (b.lateMins || 0);
  if (g * 60 <= cover + 20) return 'gap is about the same as break / late time';
  return 'gap is MORE than break + late (' + cover + 'm) - check the reason';
}

export const ProductivityPopup: React.FC<{
  token: string;
  close: () => void;
  ver: unknown;
  onRequireAuth?: () => void;
}> = ({ token, close, ver, onRequireAuth }) => {
  const [date, setDate] = useState('');
  const [allShifts, setAllShifts] = useState(false);
  const [sortBy, setSortBy] = useState<'qty' | 'tph'>('qty');
  const [tab, setTab] = useState<'tasks' | 'people' | 'board'>('tasks');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState('');
  const [task, setTask] = useState('');
  const [period, setPeriod] = useState<7 | 30>(7);

  const data = useProd(
    'getProductivityReport',
    'r|' + date + '|' + allShifts,
    [token, date, allShifts],
    ver,
    true,
    onRequireAuth
  );
  const curDate = date || (data && data.date) || '';
  const board = useProd(
    'getProductivityBoard',
    'b|' + curDate + '|' + allShifts + '|' + period,
    [token, curDate, period, allShifts],
    ver,
    tab === 'board',
    onRequireAuth
  );

  const Row = ({
    k,
    rank,
    name,
    qty,
    hours,
    tph,
    ok,
    badge,
    hoursList,
    sub,
  }: {
    k: string;
    rank: number;
    name: string;
    qty: number;
    hours: number;
    tph: number;
    ok: boolean | null;
    badge?: React.ReactNode;
    hoursList: React.ReactNode;
    sub?: React.ReactNode;
  }) => (
    <div
      className={
        'border rounded-xl overflow-hidden bg-[#0b1530] ' +
        (ok === false ? 'border-rose-500/70' : 'border-slate-700')
      }
    >
      <button
        type="button"
        onClick={() => setOpen(open === k ? '' : k)}
        className="w-full min-h-[44px] flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-sm text-left hover:bg-slate-800/60 transition-colors"
      >
        <span className="w-6 text-center font-black text-slate-400 shrink-0">{rank}</span>
        <span className="flex-1 min-w-[110px] truncate font-bold text-white">
          {name} {badge}
        </span>
        <span className="font-black text-[#FEEE00] whitespace-nowrap">{qty}</span>
        <span className="text-slate-400 whitespace-nowrap text-xs">{hours}h</span>
        <span className={'font-black whitespace-nowrap ' + okCls(ok)}>
          {tph} <span className="text-[11px] font-bold text-slate-400">TPH</span>
        </span>
      </button>
      {open === k && (
        <div className="bg-slate-900/90 border-t border-slate-700 px-3 py-2.5">
          {sub}
          <div className="text-xs font-bold uppercase text-slate-400 mb-1.5">Hour by hour</div>
          <div className="flex flex-wrap gap-1.5">{hoursList}</div>
        </div>
      )}
    </div>
  );

  const hourChips = (list: any[], showBy: boolean, gaps?: number[]) => {
    const items = list
      .map((x) => ({ h: x.h, x, gap: false }))
      .concat((gaps || []).map((h) => ({ h, x: null, gap: true })))
      .sort((a, b) => a.h - b.h);
    return items.map((it) =>
      it.gap ? (
        <div
          key={'g' + it.h}
          className="bg-rose-950/70 border border-dashed border-rose-500 rounded-lg px-2.5 py-1 text-xs text-rose-300"
        >
          <b>{hourLbl(it.h)}</b> <span className="font-black">gap</span>
        </div>
      ) : (
        <div key={it.h} className="bg-[#14213f] border border-slate-700 rounded-lg px-2.5 py-1 text-xs">
          <b className="text-slate-200">{hourLbl(it.h)}</b>{' '}
          <span className="font-black text-[#FEEE00]">{it.x.qty}</span>
          {showBy && it.x.by && Object.keys(it.x.by).length > 1 ? (
            <div className="text-[11px] text-slate-400">
              {Object.keys(it.x.by)
                .map((t) => prettyType(t) + ' ' + it.x.by[t])
                .join(' · ')}
            </div>
          ) : null}
        </div>
      )
    );
  };

  const people = ((data && data.people) || []).filter(
    (p: any) => !q.trim() || (p.name + ' ' + p.id).toLowerCase().includes(q.trim().toLowerCase())
  );
  const taskObj = task && data && data.tasks ? data.tasks.filter((t: any) => t.type === task)[0] : null;

  const taskHead = (t: any, clickable: boolean) => (
    <div className="mb-2">
      <button
        type="button"
        disabled={!clickable}
        onClick={() => {
          setTask(t.type);
          setOpen('');
        }}
        className={
          'w-full min-h-[44px] flex flex-wrap items-center justify-between gap-2 text-left ' +
          (clickable ? 'hover:text-[#FEEE00]' : '')
        }
      >
        <b className="text-base capitalize text-white">
          {prettyType(t.type)}
          {clickable ? ' ›' : ''}
        </b>
        <span className="text-xs font-semibold text-slate-300">
          {t.total} units &middot; {t.people} people
        </span>
      </button>
      {t.target ? (
        <div className="text-xs text-slate-300">
          Target {t.target}/hr &middot;{' '}
          <b className={t.onTarget === t.people ? 'text-emerald-300' : 'text-rose-400'}>
            {t.onTarget} of {t.people} on target
          </b>
        </div>
      ) : null}
    </div>
  );

  const BoardCol = ({ title, list, kind }: { title: string; list: any[]; kind: 'qty' | 'ach' }) => (
    <div className="border border-slate-700 bg-[#0b1530] rounded-xl p-3">
      <div className="text-sm font-black text-white mb-2">{title}</div>
      <div className="space-y-1.5">
        {list.length === 0 && <div className="text-sm text-slate-400 italic">Not enough data yet.</div>}
        {list.map((p, i) => (
          <div
            key={p.id}
            className={
              'flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl text-sm ' +
              (i === 0 ? 'bg-amber-950/60 border border-[#FEEE00]/70' : 'bg-[#14213f] border border-slate-700')
            }
          >
            <span className="w-6 text-center text-base">
              {['🥇', '🥈', '🥉'][i] || <span className="text-xs font-black text-slate-400">{i + 1}</span>}
            </span>
            <span className="flex-1 min-w-[100px] truncate font-bold text-white">{p.name}</span>
            <span className="text-xs text-slate-300 whitespace-nowrap">
              {p.days}d &middot; {p.hours}h &middot; {p.tph} TPH
            </span>
            <span className={'font-black whitespace-nowrap ' + (kind === 'ach' ? okCls(p.ach >= 1) : 'text-[#FEEE00]')}>
              {kind === 'ach' ? pctTxt(p.ach) : p.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Modal title={'📈 Productivity - ' + (data && data.date ? data.date : '...')} onClose={close} size="xxl">
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
        <div className="flex items-center gap-1.5">
          <Btn small onClick={() => curDate && setDate(shiftDateStr(curDate, -1))}>
            &#9664;
          </Btn>
          <input
            type="date"
            value={curDate}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="min-h-[44px] border border-slate-600 rounded-xl px-2.5 py-2 text-sm bg-[#0b1530] text-white"
          />
          <Btn small onClick={() => curDate && setDate(shiftDateStr(curDate, 1))}>
            &#9654;
          </Btn>
        </div>
        <label className="min-h-[44px] flex items-center gap-2 px-2 text-slate-200 font-semibold">
          <input
            type="checkbox"
            checked={allShifts}
            onChange={(e) => setAllShifts(e.target.checked)}
            className="w-4 h-4 accent-[#FEEE00]"
          />{' '}
          All shifts
        </label>
        <div className="w-full md:w-auto md:ml-auto grid grid-cols-3 gap-1.5">
          <Btn
            small
            tone={tab === 'tasks' ? 'yellow' : 'slate'}
            onClick={() => {
              setTab('tasks');
              setTask('');
            }}
          >
            Top 5
          </Btn>
          <Btn small tone={tab === 'people' ? 'yellow' : 'slate'} onClick={() => setTab('people')}>
            Everyone
          </Btn>
          <Btn small tone={tab === 'board' ? 'yellow' : 'slate'} onClick={() => setTab('board')}>
            🏆 Best
          </Btn>
        </div>
      </div>

      {data === null && tab !== 'board' && <div className="text-sm text-slate-400 py-6 text-center">Loading...</div>}
      {data && !data.success && tab !== 'board' && (
        <div className="text-sm text-rose-400 py-4 text-center">{data.error || 'Could not load productivity.'}</div>
      )}
      {data && data.success && !data.found && tab !== 'board' && (
        <div className="text-sm text-slate-400 italic py-6 text-center">
          No productivity data for {data.date}
          {allShifts ? '' : ' (my shift)'}.
        </div>
      )}

      {data && data.success && data.found && tab === 'tasks' && !taskObj && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-slate-300">
            <span className="font-bold">Rank by:</span>
            <Btn small tone={sortBy === 'qty' ? 'yellow' : 'slate'} onClick={() => setSortBy('qty')}>
              Quantity
            </Btn>
            <Btn small tone={sortBy === 'tph' ? 'yellow' : 'slate'} onClick={() => setSortBy('tph')}>
              TPH (min 2h)
            </Btn>
            <span className="md:ml-auto">
              <span className="text-rose-400 font-bold">Red</span> = below target &middot; tap a task for everyone
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.tasks.map((t: any) => {
              const list = sortBy === 'qty' ? t.topQty : t.topTph;
              return (
                <div key={t.type} className="border border-slate-700 bg-[#0b1530]/60 rounded-xl p-3">
                  {taskHead(t, true)}
                  <div className="space-y-1.5">
                    {list.length === 0 && (
                      <div className="text-sm text-slate-400 italic">Nobody with 2+ active hours on this task.</div>
                    )}
                    {list.map((p: any, i: number) => (
                      <Row
                        key={t.type + p.id}
                        k={t.type + p.id}
                        rank={i + 1}
                        name={p.name}
                        qty={p.qty}
                        hours={p.hours}
                        tph={p.tph}
                        ok={p.ok}
                        hoursList={hourChips(p.perHour, false)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && data.success && data.found && tab === 'tasks' && taskObj && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-slate-300">
            <Btn
              small
              onClick={() => {
                setTask('');
                setOpen('');
              }}
            >
              &larr; All tasks
            </Btn>
            <span>Sort:</span>
            <Btn small tone={sortBy === 'qty' ? 'yellow' : 'slate'} onClick={() => setSortBy('qty')}>
              Quantity
            </Btn>
            <Btn small tone={sortBy === 'tph' ? 'yellow' : 'slate'} onClick={() => setSortBy('tph')}>
              TPH
            </Btn>
          </div>
          <div className="border border-slate-700 bg-[#0b1530]/60 rounded-xl p-3">
            {taskHead(taskObj, false)}
            <div className="space-y-1.5">
              {taskObj.all
                .slice()
                .sort((a: any, b: any) => (sortBy === 'tph' ? b.tph - a.tph : b.qty - a.qty))
                .map((p: any, i: number) => (
                  <Row
                    key={'a' + p.id}
                    k={'a' + p.id}
                    rank={i + 1}
                    name={p.name}
                    qty={p.qty}
                    hours={p.hours}
                    tph={p.tph}
                    ok={p.ok}
                    hoursList={hourChips(p.perHour, false)}
                  />
                ))}
            </div>
          </div>
        </div>
      )}

      {data && data.success && data.found && tab === 'people' && (
        <div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or ID..."
            className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-3 outline-none focus:border-[#FEEE00]"
          />
          <div className="space-y-1.5">
            {people.map((p: any, i: number) => (
              <Row
                key={'p' + p.id}
                k={'p' + p.id}
                rank={i + 1}
                name={p.name}
                qty={p.total}
                hours={p.hours}
                tph={p.tph}
                ok={p.ok}
                badge={
                  <span>
                    {p.ach != null ? (
                      <span className={'text-xs font-black ' + okCls(p.ok)}>{pctTxt(p.ach)}</span>
                    ) : null}
                    {(p.gaps || []).length ? (
                      <span className="ml-1 text-xs font-black text-rose-400">⚠ {p.gaps.length} gap</span>
                    ) : null}
                  </span>
                }
                hoursList={hourChips(p.perHour, true, p.gaps)}
                sub={
                  <div className="mb-2 space-y-1">
                    <div className="space-y-1">
                      {p.types.map((t: any) => (
                        <div key={t.type} className="flex flex-wrap justify-between gap-2 text-xs text-slate-200">
                          <span className="capitalize">
                            {prettyType(t.type)}
                            {t.target ? <span className="text-slate-400"> (target {t.target}/h)</span> : null}
                          </span>
                          <span>
                            <b>{t.qty}</b> in {t.hours}h &middot; <b className={okCls(t.ok)}>{t.tph}</b> TPH
                          </span>
                        </div>
                      ))}
                    </div>
                    {(p.gaps || []).length > 0 && (
                      <div className="text-xs text-rose-300 font-bold">
                        ⚠ No entries at {p.gaps.map(hourLbl).join(', ')}{' '}
                        <span className="font-normal text-slate-300">- {gapVerdict(p)}</span>
                      </div>
                    )}
                    {p.brk && (
                      <div className="text-xs text-slate-300">
                        Break {p.brk.breakMins}m
                        {p.brk.overstayMins > 0 ? (
                          <b className="text-rose-400"> (+{p.brk.overstayMins}m over)</b>
                        ) : null}
                        {p.brk.lateMins > 0 ? <span> &middot; arrived late {p.brk.lateMins}m</span> : null}
                      </div>
                    )}
                  </div>
                }
              />
            ))}
            {people.length === 0 && <div className="text-sm text-slate-400 italic text-center py-4">No match.</div>}
          </div>
        </div>
      )}

      {tab === 'board' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-slate-300">
            <Btn small tone={period === 7 ? 'yellow' : 'slate'} onClick={() => setPeriod(7)}>
              Last 7 days
            </Btn>
            <Btn small tone={period === 30 ? 'yellow' : 'slate'} onClick={() => setPeriod(30)}>
              Last 30 days
            </Btn>
            {board && board.success && (
              <span className="md:ml-auto text-xs">
                {board.from} to {board.to} &middot; {board.people} people
              </span>
            )}
          </div>
          {board === null && <div className="text-sm text-slate-400 py-6 text-center">Loading...</div>}
          {board && !board.success && (
            <div className="text-sm text-rose-400 py-4 text-center">{board.error || 'Could not load.'}</div>
          )}
          {board && board.success && board.people === 0 && (
            <div className="text-sm text-slate-400 italic py-6 text-center">No productivity data in this period.</div>
          )}
          {board && board.success && board.people > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <BoardCol title="🏆 Most units" list={board.topQty} kind="qty" />
              <BoardCol title="🎯 Best vs target (4+ active hours)" list={board.topAch} kind="ach" />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

// ---------- Broadcast popup ----------
export const BroadcastPopup: React.FC<{
  S: LiveState;
  token: string;
  close: () => void;
  callApiFn: (name: string, args: unknown[], okMsg?: string, after?: () => void) => void;
  busy: boolean;
  toast: (m: string) => void;
  onRequireAuth?: () => void;
}> = ({ S, token, close, callApiFn, busy, toast, onRequireAuth }) => {
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [prio, setPrio] = useState<'normal' | 'urgent'>('normal');
  const [expiry, setExpiry] = useState('shift');
  const [lines, setLines] = useState<Record<string, boolean>>({});
  const [ids, setIds] = useState<Record<string, boolean>>({});
  const [people, setPeople] = useState(false);
  const [q, setQ] = useState('');
  const [img, setImg] = useState({ data: '', id: '', up: '' });
  const [openUn, setOpenUn] = useState<Record<string, boolean>>({});

  const defs = S.taskDefinitions || {};
  const att = S.attendance || {};
  const chosenLines = Object.keys(lines).filter((k) => lines[k]);
  const chosenIds = Object.keys(ids).filter((k) => ids[k]);
  const all = !chosenLines.length && !chosenIds.length;
  const emps = S.employees || [];
  const nm: Record<string, string> = {};
  emps.forEach((w) => {
    nm[w.id] = w.name;
  });
  const act = S.broadcasts || [];
  const hist = S.bcHistory || [];

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setImg({ data: '', id: '', up: 'busy' });
    shrinkImage(
      f,
      (data) => {
        setImg({ data, id: '', up: 'busy' });
        gs(
          'uploadBroadcastImage',
          [token, data],
          (res: any) => {
            if (res && (res.code === 'AUTH' || res.authRequired)) {
              onRequireAuth?.();
              return;
            }
            if (res && res.success) setImg({ data, id: res.imageId, up: 'ok' });
            else {
              setImg({ data, id: '', up: 'err' });
              toast((res && res.error) || 'Photo upload failed.');
            }
          },
          () => {
            setImg({ data, id: '', up: 'err' });
            toast('Photo upload failed.');
          }
        );
      },
      () => {
        setImg({ data: '', id: '', up: 'err' });
        toast('Could not read that photo.');
      }
    );
    e.target.value = '';
  };

  const send = () => {
    if (img.up === 'busy') {
      toast('Photo is still uploading...');
      return;
    }
    if (!msg.trim() && !img.id) {
      toast('Write a message or add a photo first.');
      return;
    }
    callApiFn(
      'sendBroadcast',
      [
        {
          title: title.trim(),
          message: msg.trim(),
          imageId: img.id,
          priority: prio,
          all,
          lines: chosenLines,
          ids: chosenIds,
          expiry,
        },
      ],
      'Message sent to the group',
      () => {
        setTitle('');
        setMsg('');
        setPrio('normal');
        setExpiry('shift');
        setLines({});
        setIds({});
        setPeople(false);
        setImg({ data: '', id: '', up: '' });
      }
    );
  };

  const chip = (on: boolean, label: string, onClick: () => void, key?: string) => (
    <button
      type="button"
      key={key || label}
      onClick={onClick}
      className={
        'min-h-[44px] px-3 py-1.5 rounded-xl border text-sm font-bold transition-colors ' +
        (on
          ? 'bg-[#FEEE00] border-[#FEEE00] text-[#14213f]'
          : 'bg-[#0b1530] border-slate-600 text-slate-200 hover:border-slate-400')
      }
    >
      {label}
    </button>
  );

  const peopleList = emps.filter(
    (w) =>
      (att[w.id] || 'Present') === 'Present' &&
      (!q.trim() || (w.name + ' ' + w.id).toLowerCase().includes(q.trim().toLowerCase()))
  );

  return (
    <Modal title="📢 Broadcast to the group" onClose={close} size="xxl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-3 min-w-0">
          <input
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[#FEEE00]"
          />
          <div>
            <textarea
              value={msg}
              maxLength={800}
              onChange={(e) => setMsg(e.target.value)}
              rows={4}
              placeholder="Write the important message..."
              className="w-full border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FEEE00]"
            />
            <div className="text-right text-xs text-slate-400">{msg.length} / 800</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="min-h-[44px] inline-flex items-center cursor-pointer px-3 py-2 border border-dashed border-slate-500 bg-[#0b1530] rounded-xl text-sm font-bold text-slate-200 hover:border-[#FEEE00]">
              📷 Add photo
              <input type="file" accept="image/*" className="hidden" onChange={pickFile} />
            </label>
            {img.up === 'busy' && <span className="text-xs text-amber-300 font-bold">Uploading photo...</span>}
            {img.up === 'ok' && <span className="text-xs text-emerald-300 font-bold">✔ Photo ready</span>}
            {img.up === 'err' && <span className="text-xs text-rose-400 font-bold">Upload failed</span>}
            {img.data && (
              <button
                type="button"
                onClick={() => setImg({ data: '', id: '', up: '' })}
                className="min-h-[44px] px-2 text-sm text-rose-400 font-bold"
              >
                ✕ Remove
              </button>
            )}
          </div>
          {img.data && <img src={img.data} alt="" className="max-h-44 rounded-xl border border-slate-600" />}
          <div className="text-xs font-black uppercase text-[#FEEE00]">Send to</div>
          <div className="flex flex-wrap gap-1.5">
            {chip(all, 'Everyone', () => {
              setLines({});
              setIds({});
              setPeople(false);
            })}
            {Object.keys(defs).map((c) =>
              chip(
                !!lines[c],
                c,
                () => setLines((l) => ({ ...l, [c]: !l[c] })),
                'l' + c
              )
            )}
            {chip(
              people || chosenIds.length > 0,
              '👤 People' + (chosenIds.length ? ' (' + chosenIds.length + ')' : ''),
              () => setPeople((v) => !v)
            )}
          </div>
          {people && (
            <div>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name..."
                className="w-full min-h-[44px] border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm mb-2 outline-none focus:border-[#FEEE00]"
              />
              <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {peopleList.map((w) => (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => setIds((m) => ({ ...m, [w.id]: !m[w.id] }))}
                    className={
                      'min-h-[44px] text-left px-3 py-2 rounded-xl border text-sm truncate ' +
                      (ids[w.id]
                        ? 'bg-[#FEEE00] border-[#FEEE00] text-[#14213f] font-bold'
                        : 'bg-[#0b1530] border-slate-700 text-slate-200')
                    }
                  >
                    {ids[w.id] ? '✓ ' : ''}
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {chip(prio === 'normal', 'Normal', () => setPrio('normal'))}
            {chip(prio === 'urgent', '🚨 Urgent', () => setPrio('urgent'))}
            <select
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="min-h-[44px] sm:ml-auto border border-slate-600 bg-[#0b1530] text-white rounded-xl px-3 py-2 text-sm font-bold"
            >
              <option value="shift">Until shift ends</option>
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="manual">Until I remove it</option>
            </select>
          </div>
          <Btn tone="yellow" disabled={busy || img.up === 'busy'} onClick={send} className="w-full sm:w-auto">
            📢 Send Broadcast
          </Btn>
          <p className="text-xs text-slate-400">
            Everyone chosen gets a full-screen popup on their PDA with a buzz until they tap "Got it".
          </p>
        </div>

        <div className="space-y-2.5 min-w-0">
          <div className="text-xs font-black uppercase text-[#FEEE00]">Active messages ({act.length})</div>
          {act.length === 0 && <div className="text-sm text-slate-400 italic">Nothing active.</div>}
          {act.map((b) => {
            const pct = b.total ? Math.round((b.ackedCount / b.total) * 100) : 0;
            const unclear = Object.keys(b.reply || {})
              .filter((k) => b.reply![k] === 'unclear')
              .map((k) => nm[k] || k);
            return (
              <div
                key={b.id}
                className={
                  'border rounded-xl p-3 space-y-2 bg-[#0b1530] ' +
                  (b.priority === 'urgent' ? 'border-rose-500' : 'border-slate-700')
                }
              >
                <div className="flex gap-2.5">
                  {b.imageUrl && (
                    <img src={b.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white break-words">
                      {b.priority === 'urgent' ? '🚨 ' : ''}
                      {b.title || b.message || 'Photo'}
                    </div>
                    {b.title && b.message && (
                      <div className="text-xs text-slate-300 break-words">{String(b.message).slice(0, 90)}</div>
                    )}
                    <div className="text-xs text-slate-400">
                      {b.sender} &middot; {b.timeStr}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                    <span>
                      Seen {b.ackedCount} of {b.total}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={'h-full ' + (pct === 100 ? 'bg-emerald-500' : 'bg-[#FEEE00]')}
                      style={{ width: pct + '%' }}
                    />
                  </div>
                </div>
                {unclear.length > 0 && (
                  <div className="text-xs font-bold text-amber-300 break-words">❓ Not clear: {unclear.join(', ')}</div>
                )}
                {b.unseen && b.unseen.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setOpenUn((o) => ({ ...o, [b.id]: !o[b.id] }))}
                      className="min-h-[44px] text-sm font-bold text-rose-400"
                    >
                      {openUn[b.id] ? '▾' : '▸'} Not seen yet ({b.unseen.length})
                    </button>
                    {openUn[b.id] && (
                      <div className="text-xs text-slate-300 leading-relaxed break-words">
                        {b.unseen.map((u) => u.name).join(', ')}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Btn small disabled={busy} onClick={() => callApiFn('remindBroadcast', [b.id], 'Reminder sent')}>
                    🔔 Remind unseen
                  </Btn>
                  <Btn small tone="rose" disabled={busy} onClick={() => callApiFn('endBroadcast', [b.id], 'Message ended')}>
                    🗑 End
                  </Btn>
                </div>
              </div>
            );
          })}
          {hist.length > 0 && <div className="text-xs font-black uppercase text-slate-300 pt-2">Earlier messages</div>}
          {hist.map((b) => (
            <div key={b.id} className="px-3 py-2 rounded-xl bg-[#0b1530] border border-slate-700 text-xs">
              <div className="font-bold text-white truncate">
                {b.imageUrl ? '📷 ' : ''}
                {b.title || b.message || 'Photo'}
              </div>
              <div className="text-slate-400">
                {b.sender} &middot; {b.timeStr} &middot; seen {b.ackedCount}/{b.total} &middot; {b.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

// ---------- Help call activity ----------
export const HelpLogPopup: React.FC<{ S: LiveState; close: () => void }> = ({ S, close }) => {
  const log = S.helpLog || [];
  return (
    <Modal title="🆘 Help call activity" onClose={close} wide>
      {log.length === 0 && (
        <div className="text-sm text-slate-400 italic text-center py-6">No help calls yet today.</div>
      )}
      <div className="space-y-2">
        {log.map((h) => (
          <div
            key={h.id}
            className={
              'flex flex-wrap items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm ' +
              (h.type === 'cleared'
                ? 'bg-emerald-950/50 border-emerald-600/60'
                : h.type === 'raised'
                ? 'bg-rose-950/60 border-rose-600/70'
                : 'bg-[#0b1530] border-sky-600/60')
            }
          >
            <span className="text-base leading-none">{HELP_ICON[h.type]}</span>
            <div className="min-w-0 flex-1 font-semibold text-white break-words">
              {helpEventText(h)}
              {h.imageUrl ? (
                <div className="mt-1.5">
                  <PhotoThumb url={h.imageUrl} h="h-14 w-14" />
                </div>
              ) : null}
            </div>
            <span className="text-xs text-slate-300 whitespace-nowrap">{h.timeStr}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-slate-400 mt-3">Showing the latest {log.length} events.</div>
    </Modal>
  );
};
