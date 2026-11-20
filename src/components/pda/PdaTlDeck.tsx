import React, { useEffect, useState } from 'react';
import { gs } from '../../api/appsScript';
import { Employee, HelpRequest, LiveState } from '../../types/shift';
import { shrinkImage } from '../../utils/image';
import { PdaLang, T, trStr } from '../../utils/pdaI18n';
import { RING_REASONS } from './PdaModals';

const lc = (s: unknown) => String(s == null ? '' : s).trim().toLowerCase();

function curStation(a: { activeStation?: string; task1?: string } | undefined, plan?: string): string {
  if (!a) return plan || '';
  if (a.activeStation && a.activeStation !== 'None') return a.activeStation;
  if (a.task1 && a.task1 !== 'None') return a.task1;
  return plan || '';
}

function stationName(st: LiveState, code: string): string {
  const d = st.taskDefinitions && st.taskDefinitions[code];
  return d && d.name ? d.name : code;
}

export function sortHelps(list: HelpRequest[], empId: string): HelpRequest[] {
  return list.slice().sort((x, y) => {
    if (!!x.escalated !== !!y.escalated) return x.escalated ? -1 : 1;
    const dx = x.flDist && x.flDist[empId] != null ? x.flDist[empId]! : 999;
    const dy = y.flDist && y.flDist[empId] != null ? y.flDist[empId]! : 999;
    return dx - dy || x.timestamp - y.timestamp;
  });
}

export const PdaHelpCard: React.FC<{
  r: HelpRequest;
  empId: string;
  tl: boolean;
  lang: PdaLang;
  onAccept: (id: string) => void;
  onClear: (id: string) => void;
  onOpenSendHelper?: (id: string) => void;
  onPhotoOpen: (url: string) => void;
}> = ({ r, empId, tl, lang, onAccept, onClear, onOpenSendHelper, onPhotoOpen }) => {
  const tr = (s: string) => trStr(s, lang);
  const accepted = r.status === 'accepted';
  const who = r.helperName
    ? r.helperName + ' is coming'
    : accepted
    ? 'Accepted by ' +
      (r.acceptedBy || '') +
      (r.acceptedByRole ? ' (' + r.acceptedByRole + ')' : '') +
      (r.acceptedAtStr ? ' at ' + r.acceptedAtStr : '')
    : '';

  const mineNearest = !accepted && r.nearestFlId && lc(r.nearestFlId) === lc(empId);
  const d = r.flDist ? r.flDist[empId] : null;
  let dist = '';
  if (d != null) dist = d === 0 ? T('same_aisle', lang) : d + T('aisles_away', lang);
  const mins = Math.floor((r.waitMs || 0) / 60000);
  const esc3 = !!r.escalated;

  return (
    <div
      className={`p-3 bg-slate-950/90 border-2 ${
        esc3
          ? 'border-rose-400 animate-pulse-alert'
          : accepted
          ? 'border-emerald-600'
          : mineNearest
          ? 'border-amber-400'
          : 'border-rose-500'
      } rounded-2xl text-xs`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-black text-white truncate">
            {r.empName}
            {esc3 && (
              <span className="text-rose-300 ml-1">
                &#9200; {tr(`${T('waiting', lang)}${mins}m`)}
              </span>
            )}
          </div>
          <div className="text-[11px] font-bold text-amber-300">
            &#128205; {r.location} ({r.station}) &bull; {r.timeStr}
            {dist ? ' • ' + dist : ''}
          </div>
          {r.reason && (
            <div className="mt-1">
              <span className="text-[10px] font-black text-rose-100 bg-rose-700/70 rounded px-1.5 py-0.5">
                &#9888; {T('r_' + r.reason, lang)}
              </span>
            </div>
          )}
          {r.imageUrl && (
            <button type="button" onClick={() => onPhotoOpen(r.imageUrl!)} className="mt-1.5 block text-left">
              <img
                src={r.imageUrl}
                alt=""
                className="h-20 rounded-lg border border-slate-600 object-cover"
              />
              <span className="text-[9px] text-sky-300 font-bold">{tr('📷 Tap to enlarge')}</span>
            </button>
          )}
          {!accepted && mineNearest && (
            <div className="mt-1">
              <span className="text-[10px] font-black text-slate-950 bg-amber-400 rounded px-1.5 py-0.5">
                {T('nearest_you', lang)}
              </span>
            </div>
          )}
          {!accepted && !mineNearest && r.nearestFlName && (
            <div className="mt-1">
              <span className="text-[10px] font-bold text-slate-400">
                {T('nearest_other', lang)}
                {r.nearestFlName}
              </span>
            </div>
          )}
          {who && (
            <div className="text-[10px] font-black text-emerald-400 mt-0.5">
              &#10004; {tr(who)}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {!accepted && (
          <button
            type="button"
            onClick={() => onAccept(r.id)}
            className="px-2.5 py-1.5 bg-amber-500 text-slate-950 font-black rounded-lg text-[10px]"
          >
            {T('accept', lang)}
          </button>
        )}
        {tl && onOpenSendHelper && (
          <button
            type="button"
            onClick={() => onOpenSendHelper(r.id)}
            className="px-2.5 py-1.5 bg-sky-700 text-white font-black rounded-lg text-[10px]"
          >
            {T('send_helper', lang)}
          </button>
        )}
        <button
          type="button"
          onClick={() => onClear(r.id)}
          className="px-2.5 py-1.5 bg-emerald-700 text-white font-black rounded-lg text-[10px]"
        >
          {T('clear', lang)}
        </button>
      </div>
    </div>
  );
};

interface PdaTlDeckProps {
  st: LiveState;
  me: Employee;
  token: string;
  active: boolean;
  nowSrvMs: number;
  lang: PdaLang;
  toast: (m: string) => void;
  applyState: (st: LiveState) => void;
  onAuthFail: () => void;
  onAct: (fn: string, args: unknown[], okMsg?: string | ((r: any) => string), key?: string) => void;
  onOpenCcSheet: (id: string) => void;
  onOpenSendHelper: (helpId: string) => void;
  onOpenProd: () => void;
  onPhotoOpen: (url: string) => void;
}

export const PdaTlDeck: React.FC<PdaTlDeckProps> = ({
  st,
  me,
  token,
  active,
  nowSrvMs,
  lang,
  toast,
  applyState,
  onAuthFail,
  onAct,
  onOpenCcSheet,
  onOpenSendHelper,
  onOpenProd,
  onPhotoOpen,
}) => {
  const tr = (s: string) => trStr(s, lang);
  const [tlTab, setTlTab] = useState<'floor' | 'help' | 'bc' | 'team'>('floor');

  // Floor selects
  const [summonTarget, setSummonTarget] = useState('');
  const [summonReason, setSummonReason] = useState(RING_REASONS[0]);
  const [helperWorker, setHelperWorker] = useState('');
  const [helperTask, setHelperTask] = useState('');

  // Non-sort inputs map
  const [nsCounts, setNsCounts] = useState<Record<string, string>>({});

  // Broadcast compose
  const [bcTitle, setBcTitle] = useState('');
  const [bcMsg, setBcMsg] = useState('');
  const [bcAll, setBcAll] = useState(true);
  const [bcLines, setBcLines] = useState<Record<string, boolean>>({});
  const [bcIds, setBcIds] = useState<Record<string, boolean>>({});
  const [bcPeopleOpen, setBcPeopleOpen] = useState(false);
  const [bcPeopleQ, setBcPeopleQ] = useState('');
  const [bcPrio, setBcPrio] = useState<'normal' | 'urgent'>('normal');
  const [bcExpiry, setBcExpiry] = useState<'shift' | '24h' | '3d' | 'manual'>('shift');
  const [bcImgData, setBcImgData] = useState('');
  const [bcImgId, setBcImgId] = useState('');
  const [bcUpState, setBcUpState] = useState<'' | 'busy' | 'ok' | 'err'>('');
  const [bcBusy, setBcBusy] = useState(false);
  const [unseenOpen, setUnseenOpen] = useState<Record<string, boolean>>({});

  // Attendance
  const [attEmp, setAttEmp] = useState('');
  const [attKind, setAttKind] = useState('Present');
  const [attTime, setAttTime] = useState('');

  const emps = st.employees || [];
  const att = st.attendance || {};
  const asg = st.assignments || {};
  const defs = st.taskDefinitions || {};
  const helps = st.activeHelpRequests || [];
  const breaches = st.minStaffBreaches || [];

  const avail = emps.filter((w) => lc(w.id) !== lc(me.id) && att[w.id] === 'Present');
  const enabledCodes = Object.keys(defs).filter((c) => !(st.disabledTasks || {})[c]);
  const otherEmps = emps.filter((w) => lc(w.id) !== lc(me.id));

  useEffect(() => {
    if (avail.length && !avail.some((w) => w.id === summonTarget)) setSummonTarget(avail[0].id);
    if (avail.length && !avail.some((w) => w.id === helperWorker)) setHelperWorker(avail[0].id);
    if (enabledCodes.length && !enabledCodes.includes(helperTask)) setHelperTask(enabledCodes[0]);
    if (otherEmps.length && !otherEmps.some((w) => w.id === attEmp)) setAttEmp(otherEmps[0].id);
  }, [emps.length, enabledCodes.length]);

  const byLine: Record<string, Employee[]> = {};
  const off: Employee[] = [];
  let onBreak = 0;
  let over = 0;
  let helping = 0;
  emps.forEach((w) => {
    if ((att[w.id] || 'Present') !== 'Present') {
      off.push(w);
      return;
    }
    const a = asg[w.id] || {};
    const ln = curStation(a, '') || 'None';
    (byLine[ln] = byLine[ln] || []).push(w);
    if (a.onBreak) {
      onBreak++;
      if (a.breakEndTime && nowSrvMs > a.breakEndTime) over++;
    }
    if (a.isHelping) helping++;
  });

  const order = ['FT', 'PK', 'BT'];
  const sortedCodes = Object.keys(defs).sort((x, y) => {
    const ix = order.indexOf(x);
    const iy = order.indexOf(y);
    return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || (x < y ? -1 : 1);
  });
  const breachMap: Record<string, { code: string; min: number; active: number }> = {};
  breaches.forEach((b) => {
    breachMap[b.code] = b;
  });
  const totalPresent = emps.filter((w) => (att[w.id] || 'Present') === 'Present').length;

  const chosenLines = Object.keys(bcLines).filter((k) => bcLines[k]);
  const chosenIds = Object.keys(bcIds).filter((k) => bcIds[k]);

  const handleBcFile = (file: File | undefined) => {
    if (!file) return;
    setBcUpState('busy');
    setBcImgId('');
    shrinkImage(
      file,
      (dataUrl) => {
        setBcImgData(dataUrl);
        gs<{ success?: boolean; imageId?: string; error?: string }>(
          'uploadBroadcastImage',
          [token, dataUrl],
          (res) => {
            if (res && res.success && res.imageId) {
              setBcImgId(res.imageId);
              setBcUpState('ok');
            } else {
              setBcUpState('err');
              toast(tr((res && res.error) || 'Photo upload failed.'));
            }
          },
          () => {
            setBcUpState('err');
            toast(tr('Photo upload failed.'));
          }
        );
      },
      () => {
        setBcUpState('err');
        toast(tr('Could not read that photo.'));
      }
    );
  };

  const resetBc = () => {
    setBcTitle('');
    setBcMsg('');
    setBcAll(true);
    setBcLines({});
    setBcIds({});
    setBcPeopleOpen(false);
    setBcPeopleQ('');
    setBcPrio('normal');
    setBcExpiry('shift');
    setBcImgData('');
    setBcImgId('');
    setBcUpState('');
  };

  const handleBcSend = () => {
    if (bcUpState === 'busy') {
      toast(tr('Photo is still uploading...'));
      return;
    }
    const msg = bcMsg.trim();
    if (!msg && !bcImgId) {
      toast(tr('Write a message or add a photo first.'));
      return;
    }
    if (bcBusy) return;
    const payload = {
      title: bcTitle.trim(),
      message: msg,
      imageId: bcImgId,
      priority: bcPrio,
      all: bcAll && !chosenLines.length && !chosenIds.length,
      lines: chosenLines,
      ids: chosenIds,
      expiry: bcExpiry,
    };
    setBcBusy(true);
    gs<{ success?: boolean; code?: string; error?: string; state?: LiveState }>(
      'sendBroadcast',
      [token, payload],
      (res) => {
        setBcBusy(false);
        if (res && res.code === 'AUTH') {
          onAuthFail();
          return;
        }
        if (res && res.success && res.state) {
          applyState(res.state);
          toast(tr('Message sent'));
          resetBc();
        } else {
          toast(tr((res && res.error) || 'Could not send.'));
        }
      },
      () => {
        setBcBusy(false);
        toast(tr('Network problem. Try again.'));
      }
    );
  };

  const attCounts = { Present: 0, AB: 0, LV: 0, WO: 0, EO: 0, late: 0 };
  emps.forEach((w) => {
    const s = att[w.id] || 'Present';
    if (s in attCounts) (attCounts as any)[s]++;
    const det = (st.attendanceDetail || {})[w.id];
    if (det && det.late) attCounts.late++;
  });

  const nameById: Record<string, string> = {};
  emps.forEach((w) => {
    nameById[w.id] = w.name;
  });

  return (
    <div className="space-y-3.5">
      <div className="bg-gradient-to-r from-slate-800 to-indigo-950 border border-indigo-500/60 rounded-3xl p-4 shadow-xl">
        <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 bg-indigo-950/90 px-2 py-0.5 rounded-md border border-indigo-700">
          {tr('Team Lead command')}
        </span>
        <h2 className="text-base font-black text-white mt-1">{me.name}</h2>
        <span className="text-[10px] text-indigo-300/80 font-mono">{me.id}</span>
      </div>

      {/* TL Sticky Tabs */}
      <div className="sticky top-[53px] z-30 grid grid-cols-4 gap-1.5 bg-slate-950 py-1.5 text-[11px] font-black">
        <button
          type="button"
          onClick={() => setTlTab('floor')}
          className={`py-2 rounded-xl border ${
            tlTab === 'floor'
              ? 'bg-sky-700 border-sky-300 text-white'
              : 'bg-slate-800 border-slate-600 text-slate-300'
          }`}
        >
          {tr('🏭 Floor')}
        </button>
        <button
          type="button"
          onClick={() => setTlTab('help')}
          className={`py-2 rounded-xl border relative ${
            tlTab === 'help'
              ? 'bg-sky-700 border-sky-300 text-white'
              : 'bg-slate-800 border-slate-600 text-slate-300'
          }`}
        >
          {tr('🚨 Help')}
          {helps.length > 0 && (
            <span className="absolute -top-1.5 -right-1 bg-rose-600 text-white text-[9px] rounded-full px-1.5">
              {helps.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTlTab('bc')}
          className={`py-2 rounded-xl border ${
            tlTab === 'bc'
              ? 'bg-sky-700 border-sky-300 text-white'
              : 'bg-slate-800 border-slate-600 text-slate-300'
          }`}
        >
          {tr('📢 Message')}
        </button>
        <button
          type="button"
          onClick={() => setTlTab('team')}
          className={`py-2 rounded-xl border ${
            tlTab === 'team'
              ? 'bg-sky-700 border-sky-300 text-white'
              : 'bg-slate-800 border-slate-600 text-slate-300'
          }`}
        >
          {tr('👥 Team')}
        </button>
      </div>

      {breaches.length > 0 && (
        <div className="bg-rose-900 border-2 border-rose-400 rounded-2xl p-3.5 animate-pulse-alert">
          <div className="text-[10px] font-black uppercase text-rose-200">
            {tr('Minimum staff breached')}
          </div>
          <div className="text-xs font-bold text-white mt-1 space-y-0.5">
            {breaches.map((b) => (
              <div key={b.code}>
                {b.code} - {tr(stationName(st, b.code))}: {b.active} active ({tr('Min')} {b.min})
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PANE: HELP */}
      {tlTab === 'help' && (
        <div className="space-y-3.5">
          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700">
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <span>{tr('🚨 Live Help Calls')}</span>
                <span className="bg-rose-600 text-white text-[10px] px-1.5 rounded-full font-black">
                  {helps.length}
                </span>
              </h3>
            </div>
            <div className="space-y-2">
              {helps.length ? (
                sortHelps(helps, me.id).map((r) => (
                  <PdaHelpCard
                    key={r.id}
                    r={r}
                    empId={me.id}
                    tl={true}
                    lang={lang}
                    onAccept={(id) => onAct('flAcceptHelpRequest', [id, me.id], 'Help call accepted', 'acc-' + id)}
                    onClear={(id) => onAct('resolveHelpRequest', [id], 'Help call cleared', 'clr-' + id)}
                    onOpenSendHelper={onOpenSendHelper}
                    onPhotoOpen={onPhotoOpen}
                  />
                ))
              ) : (
                <div className="p-3 text-center text-slate-500 text-xs italic bg-slate-900/60 rounded-xl">
                  {tr('No active help requests.')}
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg space-y-2.5">
            <h3 className="text-xs font-black text-white">{tr('📧 Non Sort counts')}</h3>
            <div className="space-y-2">
              {(st.nonSortRequests || []).length ? (
                (st.nonSortRequests || []).map((r) =>
                  r.status === 'pending' ? (
                    <div
                      key={r.id}
                      className="p-2.5 bg-slate-900/80 border border-indigo-800 rounded-xl text-xs"
                    >
                      <div className="flex justify-between">
                        <span className="font-black text-white">{r.empName}</span>
                        <span className="font-mono text-indigo-300">{r.awb}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          placeholder={tr('Qty')}
                          value={nsCounts[r.id] || ''}
                          onChange={(e) =>
                            setNsCounts((prev) => ({ ...prev, [r.id]: e.target.value }))
                          }
                          className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const q = parseInt(nsCounts[r.id] || '', 10);
                            if (!(q >= 1)) {
                              toast(tr('Enter a quantity.'));
                              return;
                            }
                            onAct('tlSetNonSortCount', [r.id, q], 'Count sent', 'nsc-' + r.id);
                          }}
                          className="px-3 py-1.5 bg-indigo-700 text-white font-black rounded-lg text-[11px]"
                        >
                          Send count
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAct('pdaCancelNonSort', [r.id], 'Request removed', 'nsx-' + r.id)
                          }
                          className="px-2 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-[11px]"
                        >
                          &#10005;
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={r.id}
                      className="p-2.5 bg-slate-900/80 border border-emerald-800 rounded-xl text-xs flex justify-between items-center"
                    >
                      <span className="font-black text-white">
                        {r.empName}{' '}
                        <span className="font-mono text-slate-400 font-normal">{r.awb}</span>
                      </span>
                      <span className="font-black text-emerald-300">Count {r.count} sent</span>
                    </div>
                  )
                )
              ) : (
                <div className="text-center text-slate-500 text-xs italic bg-slate-900/60 rounded-xl p-3">
                  {tr('No Non Sort requests.')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PANE: FLOOR */}
      {tlTab === 'floor' && (
        <div className="space-y-3.5">
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                ['On duty', totalPresent, 'text-emerald-300'],
                ['On break', onBreak, 'text-amber-300'],
                ['Overstay', over, over ? 'text-rose-300' : 'text-slate-400'],
                ['Helpers', helping, 'text-sky-300'],
              ].map(([lbl, val, cls]) => (
                <div
                  key={String(lbl)}
                  className="bg-slate-800/95 border border-slate-700 rounded-xl py-1.5"
                >
                  <div className={`text-base font-black ${cls}`}>{val}</div>
                  <div className="text-[9px] text-slate-400">{tr(String(lbl))}</div>
                </div>
              ))}
            </div>

            {sortedCodes.map((code) => {
              const ppl = byLine[code] || [];
              const bch = breachMap[code];
              if (!ppl.length && !bch) return null;
              const d = defs[code] || ({} as any);
              const live = ppl.filter((w) => !(asg[w.id] || {}).onBreak).length;
              const brkCnt = ppl.length - live;
              const summary =
                `${live} active` +
                (brkCnt ? ` · ${brkCnt} break` : '') +
                (bch ? ` · min ${bch.min}` : '');
              return (
                <div
                  key={code}
                  className={`bg-slate-800/95 border ${
                    bch ? 'border-rose-500' : 'border-slate-700'
                  } rounded-2xl overflow-hidden`}
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-900/70">
                    <div className="text-xs font-black text-white">
                      {code} <span className="text-slate-400 font-bold">{tr(d.name || '')}</span>
                    </div>
                    <div
                      className={`text-[11px] font-black ${
                        bch ? 'text-rose-300' : 'text-slate-300'
                      }`}
                    >
                      {tr(summary)}
                    </div>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {ppl.map((w) => {
                      const a = asg[w.id] || {};
                      const bt = a.onBreak && a.breakEndTime
                        ? (() => {
                            const diffMin = Math.round((a.breakEndTime - nowSrvMs) / 60000);
                            return diffMin >= 0 ? diffMin + 'm left' : '+' + -diffMin + 'm over';
                          })()
                        : '';
                      const bo = a.onBreak && a.breakEndTime && nowSrvMs > a.breakEndTime;
                      return (
                        <button
                          type="button"
                          key={w.id}
                          onClick={() => onOpenCcSheet(w.id)}
                          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left ${
                            bo
                              ? 'border-rose-600 bg-rose-950/40'
                              : a.onBreak
                              ? 'border-amber-700/70 bg-amber-950/20'
                              : 'border-slate-700 bg-slate-900/60'
                          }`}
                        >
                          <span className="flex-1 min-w-0 truncate text-xs font-bold text-white">
                            {w.name}
                          </span>
                          {a.isHelping && (
                            <span className="text-[9px] font-black text-sky-300 bg-sky-950 border border-sky-700 rounded px-1.5">
                              {tr('Helper')}
                            </span>
                          )}
                          {a.onBreak && (
                            <span
                              className={`text-[10px] font-black ${
                                bo ? 'text-rose-300' : 'text-amber-300'
                              }`}
                            >
                              ☕ {bt}
                            </span>
                          )}
                          <span className="text-slate-500 text-sm">&rsaquo;</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {off.length > 0 && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-2">
                <div className="text-[10px] font-black uppercase text-slate-400 px-1 mb-1">
                  {tr(`Not on duty (${off.length})`)}
                </div>
                <div className="flex flex-wrap gap-1">
                  {off.map((w) => (
                    <button
                      type="button"
                      key={w.id}
                      onClick={() => onOpenCcSheet(w.id)}
                      className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-[11px] text-slate-300"
                    >
                      {w.name} <span className="text-slate-500">{att[w.id] || ''}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summon Colleague */}
          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg space-y-2.5">
            <div>
              <h3 className="text-xs font-black text-white">
                {tr('🔔 Summon Colleague (Ring Bell)')}
              </h3>
              <p className="text-[10px] text-slate-400">
                {tr("Buzzer and urgent popup on the colleague's terminal")}
              </p>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                {tr('Colleague:')}
              </label>
              <select
                value={summonTarget}
                onChange={(e) => setSummonTarget(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500 font-bold"
              >
                {avail.map((w) => {
                  const a = asg[w.id] || {};
                  return (
                    <option key={w.id} value={w.id}>
                      {w.name} ({curStation(a, '')}){a.onBreak ? ' [Break]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                {tr('Reason:')}
              </label>
              <select
                value={summonReason}
                onChange={(e) => setSummonReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500"
              >
                {RING_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!summonTarget) {
                  toast(tr('Select a colleague first.'));
                  return;
                }
                onAct(
                  'pdaRingWorkerBell',
                  [summonTarget, summonReason, me.name],
                  'Bell rung. Colleague terminal is buzzing.'
                );
              }}
              className="w-full py-2.5 bg-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg active:scale-95"
            >
              {tr('🔔 Ring Bell & Call Colleague')}
            </button>
          </div>

          {/* Deploy Line Helper */}
          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg">
            <h3 className="text-xs font-black text-white mb-0.5">{tr('Deploy Line Helper')}</h3>
            <p className="text-[10px] text-slate-400 mb-3">
              {tr('Reassign an active colleague to another line temporarily')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  {tr('Colleague:')}
                </label>
                <select
                  value={helperWorker}
                  onChange={(e) => setHelperWorker(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-sky-500 font-bold truncate"
                >
                  {avail.map((w) => {
                    const a = asg[w.id] || {};
                    return (
                      <option key={w.id} value={w.id}>
                        {w.name} ({curStation(a, '')}){a.onBreak ? ' [Break]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  {tr('Target line:')}
                </label>
                <select
                  value={helperTask}
                  onChange={(e) => setHelperTask(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-sky-500 font-bold"
                >
                  {enabledCodes.map((c) => (
                    <option key={c} value={c}>
                      {c} - {stationName(st, c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!helperWorker || !helperTask) {
                  toast(tr('Select a colleague and a line.'));
                  return;
                }
                onAct(
                  'pdaDeployHelperDirect',
                  [helperWorker, helperTask],
                  'Deployed as helper to ' + helperTask
                );
              }}
              className="w-full mt-2.5 py-2.5 bg-sky-700 text-white font-black rounded-xl text-xs shadow-md active:scale-95"
            >
              {tr('Deploy as Helper')}
            </button>
          </div>
        </div>
      )}

      {/* PANE: BROADCAST MESSAGE */}
      {tlTab === 'bc' && (
        <div className="space-y-3.5">
          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg space-y-2.5">
            <h3 className="text-xs font-black text-white">
              {tr('📢 New message to the group')}
            </h3>
            <input
              maxLength={60}
              value={bcTitle}
              onChange={(e) => setBcTitle(e.target.value)}
              placeholder={tr('Title (optional)')}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500 font-bold"
            />
            <div>
              <textarea
                rows={4}
                maxLength={800}
                value={bcMsg}
                onChange={(e) => setBcMsg(e.target.value)}
                placeholder={tr('Write the important message...')}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500"
              />
              <div className="text-right text-[10px] text-slate-500">{bcMsg.length} / 800</div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex-1 text-center py-2.5 bg-slate-900 border border-dashed border-slate-500 rounded-xl text-xs font-black text-slate-200 cursor-pointer active:scale-95">
                {tr('📷 Add photo')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = '';
                    handleBcFile(f || undefined);
                  }}
                />
              </label>
              {bcImgData && (
                <button
                  type="button"
                  onClick={() => {
                    setBcImgData('');
                    setBcImgId('');
                    setBcUpState('');
                  }}
                  className="px-3 py-2.5 bg-slate-800 text-rose-300 rounded-xl text-xs font-black"
                >
                  {tr('✕ Remove')}
                </button>
              )}
            </div>

            {bcImgData && (
              <div className="relative">
                <img
                  src={bcImgData}
                  alt=""
                  className="rounded-xl max-h-52 mx-auto border border-slate-700"
                />
                <div className="absolute inset-x-0 bottom-1 text-center text-[10px] font-black">
                  {bcUpState === 'busy' && (
                    <span className="bg-slate-900/90 text-amber-300 px-2 py-0.5 rounded">
                      {tr('Uploading photo...')}
                    </span>
                  )}
                  {bcUpState === 'ok' && (
                    <span className="bg-slate-900/90 text-emerald-300 px-2 py-0.5 rounded">
                      {tr('✔ Photo ready')}
                    </span>
                  )}
                  {bcUpState === 'err' && (
                    <span className="bg-slate-900/90 text-rose-300 px-2 py-0.5 rounded">
                      {tr('Upload failed - remove and try again')}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="text-[10px] font-bold uppercase text-slate-400">{tr('Send to')}</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setBcAll(true);
                  setBcLines({});
                  setBcIds({});
                  setBcPeopleOpen(false);
                }}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-black ${
                  bcAll
                    ? 'bg-sky-600 border-sky-300 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-300'
                }`}
              >
                {tr('Everyone')}
              </button>
              {Object.keys(defs).map((c) => {
                const on = !!bcLines[c];
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => {
                      const next = { ...bcLines, [c]: !on };
                      setBcLines(next);
                      const hasLines = Object.values(next).some(Boolean);
                      setBcAll(!hasLines && !chosenIds.length);
                    }}
                    className={`px-3 py-1.5 rounded-full border text-[11px] font-black ${
                      on
                        ? 'bg-sky-600 border-sky-300 text-white'
                        : 'bg-slate-900 border-slate-600 text-slate-300'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setBcPeopleOpen((v) => !v)}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-black ${
                  bcPeopleOpen || chosenIds.length > 0
                    ? 'bg-sky-600 border-sky-300 text-white'
                    : 'bg-slate-900 border-slate-600 text-slate-300'
                }`}
              >
                {tr(`👤 People${chosenIds.length ? ` (${chosenIds.length})` : ''}`)}
              </button>
            </div>

            {bcPeopleOpen && (
              <div className="space-y-1.5">
                <input
                  value={bcPeopleQ}
                  onChange={(e) => setBcPeopleQ(e.target.value)}
                  placeholder={tr('Search name...')}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white outline-none focus:border-sky-500"
                />
                <div className="max-h-44 overflow-y-auto grid grid-cols-2 gap-1">
                  {emps
                    .filter(
                      (w) =>
                        (att[w.id] || 'Present') === 'Present' &&
                        (!bcPeopleQ.trim() ||
                          lc(w.name + ' ' + w.id).includes(lc(bcPeopleQ)))
                    )
                    .map((w) => {
                      const on = !!bcIds[w.id];
                      return (
                        <button
                          type="button"
                          key={w.id}
                          onClick={() => {
                            const next = { ...bcIds, [w.id]: !on };
                            setBcIds(next);
                            const hasIds = Object.values(next).some(Boolean);
                            setBcAll(!chosenLines.length && !hasIds);
                          }}
                          className={`text-left px-2 py-1.5 rounded-lg border text-[11px] font-bold truncate ${
                            on
                              ? 'bg-sky-700 border-sky-300 text-white'
                              : 'bg-slate-900 border-slate-700 text-slate-300'
                          }`}
                        >
                          {on ? '✓ ' : ''}
                          {w.name}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="grid grid-cols-2 gap-1 text-[11px] font-black">
                {(['normal', 'urgent'] as const).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setBcPrio(k)}
                    className={`py-2 rounded-xl border ${
                      bcPrio === k
                        ? k === 'urgent'
                          ? 'bg-rose-600 border-rose-300 text-white'
                          : 'bg-sky-600 border-sky-300 text-white'
                        : 'bg-slate-900 border-slate-600 text-slate-300'
                    }`}
                  >
                    {tr(k === 'urgent' ? '🚨 Urgent' : 'Normal')}
                  </button>
                ))}
              </div>
              <select
                value={bcExpiry}
                onChange={(e) => setBcExpiry(e.target.value as any)}
                className="bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white outline-none font-bold"
              >
                <option value="shift">{tr('Until shift ends')}</option>
                <option value="24h">{tr('24 hours')}</option>
                <option value="3d">{tr('3 days')}</option>
                <option value="manual">{tr('Until I remove it')}</option>
              </select>
            </div>

            <button
              type="button"
              disabled={bcUpState === 'busy' || bcBusy}
              onClick={handleBcSend}
              className="w-full py-3 bg-sky-600 text-white font-black rounded-xl text-sm shadow-lg active:scale-95 disabled:opacity-50"
            >
              {tr('📢 Send to everyone selected')}
            </button>
          </div>

          <div className="space-y-2">
            {(st.broadcasts || []).length ? (
              <>
                <div className="text-[11px] font-black uppercase text-slate-400 px-1">
                  {tr('Active messages')}
                </div>
                {(st.broadcasts || []).map((b) => {
                  const pct = b.total ? Math.round((b.ackedCount / b.total) * 100) : 0;
                  const open = !!unseenOpen[b.id];
                  const unclear = Object.keys(b.reply || {})
                    .filter((k) => b.reply![k] === 'unclear')
                    .map((k) => nameById[k] || k);
                  return (
                    <div
                      key={b.id}
                      className={`bg-slate-800/95 border ${
                        b.priority === 'urgent' ? 'border-rose-600' : 'border-slate-700'
                      } rounded-2xl p-3 space-y-2`}
                    >
                      <div className="flex gap-2">
                        {b.imageUrl && (
                          <img
                            src={b.imageUrl}
                            alt=""
                            className="w-14 h-14 rounded-lg object-cover border border-slate-700"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-white break-words">
                            {b.priority === 'urgent' ? '🚨 ' : ''}
                            {b.title || b.message || 'Photo'}
                          </div>
                          {b.title && b.message && (
                            <div className="text-[11px] text-slate-400 break-words">
                              {String(b.message).slice(0, 90)}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500">
                            {b.sender} &middot; {b.timeStr}
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-300">
                          <span>{tr(`Seen ${b.ackedCount} of ${b.total}`)}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {unclear.length > 0 && (
                        <div className="text-[11px] font-bold text-amber-300">
                          {tr(`❓ Not clear: ${unclear.join(', ')}`)}
                        </div>
                      )}

                      {b.unseen && b.unseen.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setUnseenOpen((prev) => ({ ...prev, [b.id]: !prev[b.id] }))
                            }
                            className="text-[11px] font-black text-rose-300"
                          >
                            {tr(`${open ? '▾' : '▸'} Not seen yet (${b.unseen.length})`)}
                          </button>
                          {open && (
                            <div className="text-[11px] text-slate-300 leading-relaxed mt-1">
                              {b.unseen.map((u) => u.name).join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onAct('remindBroadcast', [b.id], 'Reminder sent', 'bcr-' + b.id)
                          }
                          className="py-2 rounded-xl bg-amber-600 text-white text-[11px] font-black"
                        >
                          {tr('🔔 Remind unseen')}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAct('endBroadcast', [b.id], 'Message ended', 'bce-' + b.id)
                          }
                          className="py-2 rounded-xl bg-slate-700 text-white text-[11px] font-black"
                        >
                          {tr('🗑 End')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-center text-slate-500 text-xs italic p-3">
                {tr('No active messages.')}
              </div>
            )}
          </div>

          {(st.bcHistory || []).length > 0 && (
            <div>
              <div className="text-[11px] font-black uppercase text-slate-400 px-1 mb-1">
                {tr('Earlier messages')}
              </div>
              <div className="space-y-1">
                {(st.bcHistory || []).map((b) => (
                  <div
                    key={b.id}
                    className="px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px]"
                  >
                    <div className="font-bold text-slate-200 truncate">
                      {b.imageUrl ? '📷 ' : ''}
                      {b.title || b.message || 'Photo'}
                    </div>
                    <div className="text-slate-500">
                      {tr(
                        `${b.sender} · ${b.timeStr} · seen ${b.ackedCount}/${b.total} · ${
                          b.status || 'ended'
                        }`
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PANE: TEAM */}
      {tlTab === 'team' && (
        <div className="space-y-3.5">
          <button
            type="button"
            onClick={onOpenProd}
            className="w-full py-2.5 bg-slate-800 border border-slate-600 text-white font-black rounded-xl text-xs active:scale-95"
          >
            {tr('📈 Team productivity')}
          </button>

          <div className="bg-slate-800/95 border border-slate-700 rounded-3xl p-4 shadow-lg space-y-2.5">
            <h3 className="text-xs font-black text-white">{tr('📋 Attendance')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  {tr('Colleague:')}
                </label>
                <select
                  value={attEmp}
                  onChange={(e) => setAttEmp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500 font-bold"
                >
                  {otherEmps.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} [{att[w.id] || ''}]
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  {tr('Action:')}
                </label>
                <select
                  value={attKind}
                  onChange={(e) => setAttKind(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-white outline-none focus:border-sky-500 font-bold"
                >
                  <option value="Present">{tr('Present')}</option>
                  <option value="AB">{tr('Absent')}</option>
                  <option value="LV">{tr('Leave')}</option>
                  <option value="late">{tr('Late')}</option>
                  <option value="early">{tr('Early out')}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">
                  {tr('Time:')}
                </label>
                <input
                  type="time"
                  value={attTime}
                  onChange={(e) => setAttTime(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-white outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!active}
                onClick={() => {
                  if (!attEmp) {
                    toast(tr('Select a colleague.'));
                    return;
                  }
                  if ((attKind === 'late' || attKind === 'early') && !attTime) {
                    toast(tr('Enter the time.'));
                    return;
                  }
                  onAct('tlSetAttendance', [attEmp, attKind, attTime, me.name], 'Attendance updated');
                }}
                className="py-2.5 bg-sky-700 text-white font-black rounded-xl text-xs active:scale-95"
              >
                {tr('Apply')}
              </button>
              <button
                type="button"
                disabled={!active}
                onClick={() =>
                  onAct('tlMarkAllPresent', [], (r) =>
                    r && r.changed ? `${r.changed} colleague(s) marked present` : 'Everyone is already present'
                  )
                }
                className="py-2.5 bg-emerald-700 text-white font-black rounded-xl text-xs active:scale-95"
              >
                {tr('✔ Mark all Present')}
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center">
              {[
                ['Present', attCounts.Present, 'text-emerald-300'],
                ['Absent', attCounts.AB, 'text-rose-300'],
                ['Leave', attCounts.LV, 'text-sky-300'],
                ['Week off', attCounts.WO, 'text-slate-300'],
                ['Early out', attCounts.EO, 'text-amber-300'],
                ['Late', attCounts.late, 'text-amber-300'],
              ].map(([lbl, val, cls]) => (
                <div
                  key={String(lbl)}
                  className="bg-slate-900/80 border border-slate-700 rounded-xl py-1.5"
                >
                  <div className={`text-sm font-black ${cls}`}>{val}</div>
                  <div className="text-[9px] text-slate-400">{tr(String(lbl))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
