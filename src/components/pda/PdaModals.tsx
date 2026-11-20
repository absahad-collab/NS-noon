import React, { useEffect, useState } from 'react';
import { gs } from '../../api/appsScript';
import { BroadcastItem, Employee, LiveState } from '../../types/shift';
import { shrinkImage } from '../../utils/image';
import { PdaLang, T, trStr } from '../../utils/pdaI18n';

export const RING_REASONS = [
  'Report to TL desk immediately',
  'Check your line right now',
  'Break ended - return to line',
  'Call your Floor Lead now',
];

const lc = (s: unknown) => String(s == null ? '' : s).trim().toLowerCase();

function curStation(a: { activeStation?: string; task1?: string } | undefined, plan?: string): string {
  if (!a) return plan || '';
  if (a.activeStation && a.activeStation !== 'None') return a.activeStation;
  if (a.task1 && a.task1 !== 'None') return a.task1;
  return plan || '';
}

function stationBg(st: LiveState, code: string): string {
  const d = st.taskDefinitions && st.taskDefinitions[code];
  return d && d.headerBg ? d.headerBg : 'bg-slate-600';
}

function brkTxt(a: { breakEndTime?: number | null }, nowSrvMs: number): string {
  if (!a.breakEndTime) return '';
  const d = Math.round((a.breakEndTime - nowSrvMs) / 60000);
  return d >= 0 ? d + 'm left' : '+' + -d + 'm over';
}

// ==========================================
// 1. Photo Viewer
// ==========================================
export const PdaPhotoViewer: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => {
  if (!url) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center p-2"
      onClick={onClose}
    >
      <img src={url} alt="" className="max-w-full max-h-full rounded-lg" />
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-4 text-white text-2xl font-black px-2 py-1"
      >
        &#10005;
      </button>
    </div>
  );
};

// ==========================================
// 2. Productivity Modal (Me / Top 5 / Everyone / Best)
// ==========================================
interface ProdModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  empId: string;
  prodSig: string;
  lang: PdaLang;
}

function okCls(ok: boolean | null | undefined): string {
  return ok === false ? 'text-rose-400' : ok === true ? 'text-emerald-300' : 'text-slate-200';
}
function pretty(t: string): string {
  return String(t || '').replace(/_/g, ' ');
}
function hh(h: number): string {
  return (h < 10 ? '0' : '') + h + ':00';
}
function shiftDate(d: string, n: number): string {
  const x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export const PdaProdModal: React.FC<ProdModalProps> = ({
  open,
  onClose,
  token,
  empId,
  prodSig,
  lang,
}) => {
  const [date, setDate] = useState('');
  const [tab, setTab] = useState<'me' | 'top' | 'all' | 'board'>('me');
  const [sort, setSort] = useState<'qty' | 'tph'>('qty');
  const [period, setPeriod] = useState<7 | 30>(7);
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState('');
  const [data, setData] = useState<any>(null);
  const [board, setBoard] = useState<any>(null);

  const loadProd = (dVal: string, silent?: boolean) => {
    if (!silent) setData(null);
    gs<any>(
      'getProductivityReport',
      [token, dVal, false],
      (res) => {
        setData(res || { success: false });
        if (res && res.date && !dVal) {
          setDate(res.date);
        } else if (res && res.date && dVal === res.date) {
          setDate(res.date);
        }
      },
      () => {
        if (!silent) setData({ success: false, error: 'Network problem.' });
      }
    );
  };

  const loadBoard = (dVal: string, pVal: 7 | 30, silent?: boolean) => {
    if (!silent) setBoard(null);
    gs<any>(
      'getProductivityBoard',
      [token, dVal, pVal, false],
      (res) => {
        setBoard(res || { success: false });
      },
      () => {
        if (!silent) setBoard({ success: false, error: 'Network problem.' });
      }
    );
  };

  useEffect(() => {
    if (open) {
      setDate('');
      setTab('me');
      setOpenKey('');
      setQ('');
      setData(null);
      setBoard(null);
      loadProd('', false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !prodSig) return;
    loadProd(date, true);
    if (tab === 'board') loadBoard(date, period, true);
  }, [prodSig]);

  if (!open) return null;

  const tr = (s: string) => trStr(s, lang);

  const handlePrev = () => {
    if (!date) return;
    const nd = shiftDate(date, -1);
    setDate(nd);
    loadProd(nd, false);
    if (tab === 'board') loadBoard(nd, period, false);
  };
  const handleNext = () => {
    if (!date) return;
    const nd = shiftDate(date, 1);
    setDate(nd);
    loadProd(nd, false);
    if (tab === 'board') loadBoard(nd, period, false);
  };

  const renderHourChips = (list: any[], showBy: boolean, gaps?: number[]) => {
    const items: { h: number; x?: any; gap?: boolean }[] = [
      ...(list || []).map((x) => ({ h: x.h, x })),
      ...(gaps || []).map((g) => ({ h: g, gap: true })),
    ].sort((a, b) => a.h - b.h);

    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, idx) =>
          it.gap ? (
            <div
              key={'g-' + it.h + '-' + idx}
              className="border border-dashed border-rose-500 rounded-md px-2 py-1 text-[11px] text-rose-400"
            >
              <b>{hh(it.h)}</b> <span className="font-black">{tr('gap')}</span>
            </div>
          ) : (
            <div
              key={'h-' + it.h + '-' + idx}
              className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-[11px]"
            >
              <b className="text-slate-200">{hh(it.h)}</b>{' '}
              <span className="font-black text-sky-300">{it.x.qty}</span>
              {showBy && it.x.by && Object.keys(it.x.by).length > 1 && (
                <div className="text-[9px] text-slate-500">
                  {Object.keys(it.x.by)
                    .map((t) => pretty(t) + ' ' + it.x.by[t])
                    .join(' · ')}
                </div>
              )}
            </div>
          )
        )}
      </div>
    );
  };

  const renderPersonDetail = (p: any) => (
    <div>
      <div className="space-y-0.5 mb-2">
        {(p.types || []).map((t: any) => (
          <div key={t.type} className="flex justify-between text-[11px]">
            <span className="capitalize">
              {pretty(t.type)}
              {t.target ? (
                <span className="text-slate-500"> {tr(`(target ${t.target}/h)`)}</span>
              ) : null}
            </span>
            <span>
              <b className="text-white">{t.qty}</b>{' '}
              <span className="text-slate-300">
                {tr(`${t.qty} in ${t.hours}h · ${t.tph} TPH`).replace(/^\d+ /, '')}
              </span>
            </span>
          </div>
        ))}
      </div>
      {(p.gaps || []).length > 0 && (
        <div className="text-[11px] font-bold text-rose-400 mb-2">
          &#9888; {tr(`⚠ No entries at ${(p.gaps as number[]).map(hh).join(', ')}`).replace(/^⚠ /, '')}
        </div>
      )}
      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
        {tr('Hour by hour')}
      </div>
      {renderHourChips(p.perHour || [], true, p.gaps)}
    </div>
  );

  const renderProdRow = (
    k: string,
    rank: number,
    name: string,
    qty: number,
    hours: number,
    tph: number,
    detail: React.ReactNode,
    mine: boolean,
    ok: boolean | null | undefined,
    badge?: React.ReactNode
  ) => {
    const isOpen = openKey === k;
    return (
      <div
        key={k}
        className={`border ${mine ? 'border-sky-500' : 'border-slate-700'} rounded-xl bg-slate-900/80 overflow-hidden`}
      >
        <button
          type="button"
          onClick={() => setOpenKey(isOpen ? '' : k)}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-left"
        >
          <span className="w-5 text-center font-black text-slate-500">{rank}</span>
          <span className="flex-1 min-w-0 truncate font-bold text-white">
            {name}
            {mine && <span className="text-sky-300"> (you)</span>}
            {badge}
          </span>
          <span className="font-black text-sky-300">{qty}</span>
          <span className="w-9 text-right text-slate-400">{hours}h</span>
          <span className={`w-14 text-right font-black ${okCls(ok == null ? true : ok)}`}>
            {tph}
            <span className="text-[8px] text-slate-500"> TPH</span>
          </span>
        </button>
        {isOpen && <div className="border-t border-slate-700 px-3 py-2">{detail}</div>}
      </div>
    );
  };

  const renderBoardCol = (title: string, list: any[], kind: 'qty' | 'ach') => (
    <div className="border border-slate-700 rounded-2xl p-2.5 bg-slate-800/60">
      <div className="text-sm font-black text-white mb-1.5">{tr(title)}</div>
      <div className="space-y-1">
        {list && list.length ? (
          list.map((p, i) => {
            const mine = lc(p.id) === lc(empId);
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
            return (
              <div
                key={p.id + '-' + i}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border ${
                  mine
                    ? 'border-sky-500 bg-sky-950/40'
                    : i === 0
                    ? 'border-amber-500/70 bg-amber-950/20'
                    : 'border-slate-700 bg-slate-900/70'
                }`}
              >
                <span className="w-6 text-center">
                  {medal || <span className="text-[11px] font-black text-slate-500">{i + 1}</span>}
                </span>
                <span className="flex-1 min-w-0 truncate font-bold text-white">
                  {p.name}
                  {mine && <span className="text-sky-300"> (you)</span>}
                  <div className="text-[9px] font-normal text-slate-500">
                    {tr(`${p.days}d · ${p.hours}h · ${p.tph} TPH`)}
                  </div>
                </span>
                <span className={`font-black ${kind === 'ach' ? okCls(p.ach >= 1) : 'text-sky-300'}`}>
                  {kind === 'ach' ? Math.round(p.ach * 100) + '%' : p.total}
                </span>
              </div>
            );
          })
        ) : (
          <div className="italic text-slate-500">{tr('Not enough data yet.')}</div>
        )}
      </div>
    </div>
  );

  const renderBody = () => {
    if (tab === 'board') {
      if (!board) return <div className="text-center text-slate-500 py-6">...</div>;
      if (!board.success)
        return (
          <div className="text-center text-amber-300 py-4">
            {tr(board.error || 'Could not load productivity.')}
          </div>
        );
      if (!board.people)
        return (
          <div className="text-center italic text-slate-500 py-6">
            {tr('No productivity data in this period.')}
          </div>
        );
      let myRank = 0;
      let myRow: any = null;
      (board.all || []).forEach((p: any, i: number) => {
        if (lc(p.id) === lc(empId)) {
          myRank = i + 1;
          myRow = p;
        }
      });
      return (
        <div className="space-y-2">
          <div className="text-[10px] text-slate-500 text-center">
            {tr(`${board.from} → ${board.to} · ${board.people} people`)}
          </div>
          {myRow && (
            <div className="bg-sky-950/50 border border-sky-600 rounded-2xl p-2.5 text-center">
              <div className="text-[10px] font-bold uppercase text-slate-400">{tr('Your rank')}</div>
              <div className="text-lg font-black text-sky-300">
                #{myRank}{' '}
                <span className="text-[11px] text-slate-400">{tr(`of ${board.people}`)}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {tr(`${myRow.total} units · ${myRow.tph} TPH`)}
              </div>
            </div>
          )}
          {renderBoardCol('🏆 Most units', board.topQty || [], 'qty')}
          {renderBoardCol('🎯 Best vs target', board.topAch || [], 'ach')}
        </div>
      );
    }

    if (!data) return <div className="text-center text-slate-500 py-6">...</div>;
    if (!data.success)
      return (
        <div className="text-center text-amber-300 py-4">
          {tr(data.error || 'Could not load productivity.')}
        </div>
      );
    if (!data.found)
      return (
        <div className="text-center italic text-slate-500 py-6">
          {tr(`No productivity data for ${data.date}.`)}
        </div>
      );

    const me = (data.people || []).find((p: any) => lc(p.id) === lc(empId));

    if (tab === 'me') {
      if (!me) {
        return (
          <div className="text-center italic text-slate-500 py-6">
            {tr(`No productivity found for your ID on ${data.date}.`)}
          </div>
        );
      }
      return (
        <div className="bg-slate-900 border border-sky-600 rounded-2xl p-3">
          <div className="flex items-end justify-between mb-2">
            <div>
              <div className="text-2xl font-black text-sky-300">{me.total}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase">{tr('Total units')}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-emerald-300">
                {me.tph} <span className="text-[10px] text-slate-400">TPH</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {me.hours} {tr('active hours')}
              </div>
            </div>
          </div>
          {renderPersonDetail(me)}
        </div>
      );
    }

    if (tab === 'top') {
      return (data.tasks || []).map((t: any) => {
        const list = sort === 'qty' ? t.topQty || [] : t.topTph || [];
        return (
          <div key={t.type} className="border border-slate-700 rounded-2xl p-2.5 bg-slate-800/60">
            <div className="flex items-center justify-between mb-1.5">
              <b className="text-sm text-white capitalize">{pretty(t.type)}</b>
              <span className="text-[10px] text-slate-400">
                {tr(`${t.total} units · ${t.people} people`)}
              </span>
            </div>
            {t.target ? (
              <div className="text-[10px] text-slate-400 mb-1.5">
                {tr(`Target ${t.target}/hr · ${t.onTarget} of ${t.people} on target`)}
              </div>
            ) : null}
            <div className="space-y-1">
              {list.length ? (
                list.map((p: any, i: number) =>
                  renderProdRow(
                    t.type + p.id,
                    i + 1,
                    p.name,
                    p.qty,
                    p.hours,
                    p.tph,
                    <div>
                      <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                        {tr('Hour by hour')}
                      </div>
                      {renderHourChips(p.perHour || [], false)}
                    </div>,
                    lc(p.id) === lc(empId),
                    p.ok
                  )
                )
              ) : (
                <div className="italic text-slate-500">
                  {tr('Nobody with 2+ active hours on this task.')}
                </div>
              )}
            </div>
          </div>
        );
      });
    }

    const needle = q.trim().toLowerCase();
    const list = (data.people || []).filter(
      (p: any) => !needle || (p.name + ' ' + p.id).toLowerCase().includes(needle)
    );
    if (!list.length)
      return <div className="italic text-slate-500 text-center py-4">{tr('No match.')}</div>;

    return list.map((p: any, i: number) =>
      renderProdRow(
        'p' + p.id,
        i + 1,
        p.name,
        p.total,
        p.hours,
        p.tph,
        renderPersonDetail(p),
        lc(p.id) === lc(empId),
        p.ok,
        <>
          {p.ach != null && (
            <span className={`text-[10px] font-black ml-1 ${okCls(p.ok)}`}>
              {Math.round(p.ach * 100)}%
            </span>
          )}
          {(p.gaps || []).length > 0 && (
            <span className="text-[10px] font-black text-rose-400 ml-1">
              &#9888; {p.gaps.length} {tr('gap')}
            </span>
          )}
        </>
      )
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto">
      <div className="max-w-md mx-auto p-3.5">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-sm font-black text-white">{T('prod_title', lang)}</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 border border-slate-600 rounded-lg text-xs font-black text-slate-200"
          >
            {tr('× Close')}
          </button>
        </div>

        <div className="flex items-center gap-1.5 mb-2.5">
          <button
            type="button"
            onClick={handlePrev}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs font-black text-white"
          >
            &#9664;
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                setDate(v);
                loadProd(v, false);
                if (tab === 'board') loadBoard(v, period, false);
              }
            }}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1.5 text-xs font-bold text-white"
          />
          <button
            type="button"
            onClick={handleNext}
            className="px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs font-black text-white"
          >
            &#9654;
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-2.5 text-[11px] font-black">
          {([
            ['me', 'Me'],
            ['top', 'Top 5'],
            ['all', 'Everyone'],
            ['board', '🏆 Best'],
          ] as const).map(([k, lbl]) => (
            <button
              type="button"
              key={k}
              onClick={() => {
                setTab(k);
                setOpenKey('');
                if (k === 'board') loadBoard(date, period, false);
              }}
              className={`py-1.5 rounded-lg border ${
                tab === k
                  ? 'bg-sky-600 border-sky-300 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              {tr(lbl)}
            </button>
          ))}
        </div>

        {tab === 'top' && (
          <div className="flex items-center gap-1.5 mb-2.5 text-[10px] font-bold text-slate-400">
            {tr('Rank by')}
            <button
              type="button"
              onClick={() => {
                setSort('qty');
                setOpenKey('');
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-black ${
                sort === 'qty'
                  ? 'bg-emerald-700 border-emerald-300 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              {tr('Quantity')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSort('tph');
                setOpenKey('');
              }}
              className={`px-2 py-1 rounded-lg border text-[10px] font-black ${
                sort === 'tph'
                  ? 'bg-emerald-700 border-emerald-300 text-white'
                  : 'bg-slate-800 border-slate-600 text-slate-300'
              }`}
            >
              TPH
            </button>
          </div>
        )}

        {tab === 'board' && (
          <div className="flex items-center gap-1.5 mb-2.5 text-[10px] font-black">
            {([7, 30] as const).map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => {
                  setPeriod(n);
                  loadBoard(date, n, false);
                }}
                className={`px-2.5 py-1 rounded-lg border ${
                  period === n
                    ? 'bg-emerald-700 border-emerald-300 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-300'
                }`}
              >
                {tr(n === 7 ? 'Last 7 days' : 'Last 30 days')}
              </button>
            ))}
          </div>
        )}

        {tab === 'all' && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white mb-2.5"
            placeholder={tr('Search name or ID...')}
          />
        )}

        <div className="space-y-2 pb-10 text-xs text-slate-300">{renderBody()}</div>
      </div>
    </div>
  );
};

// ==========================================
// 3. Help Location Modal (with Reason + Photo + Aisles 1-14)
// ==========================================
interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  empId: string;
  reasons: string[];
  lang: PdaLang;
  toast: (m: string) => void;
  onSend: (loc: string, reason: string, imageId: string) => void;
}

export const PdaHelpModal: React.FC<HelpModalProps> = ({
  open,
  onClose,
  token,
  empId,
  reasons,
  lang,
  toast,
  onSend,
}) => {
  const [reason, setReason] = useState('');
  const [imgData, setImgData] = useState('');
  const [imgId, setImgId] = useState('');
  const [upState, setUpState] = useState<'' | 'busy' | 'ok' | 'err'>('');

  useEffect(() => {
    if (open) {
      setReason('');
      setImgData('');
      setImgId('');
      setUpState('');
    }
  }, [open]);

  if (!open) return null;
  const tr = (s: string) => trStr(s, lang);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setUpState('busy');
    setImgId('');
    shrinkImage(
      file,
      (dataUrl) => {
        setImgData(dataUrl);
        gs<{ success?: boolean; imageId?: string; error?: string }>(
          'pdaUploadHelpPhoto',
          [token, empId, dataUrl],
          (res) => {
            if (res && res.success && res.imageId) {
              setImgId(res.imageId);
              setUpState('ok');
            } else {
              setImgId('');
              setUpState('err');
              toast(tr((res && res.error) || 'Photo upload failed.'));
            }
          },
          () => {
            setImgId('');
            setUpState('err');
            toast(tr('Photo upload failed.'));
          }
        );
      },
      () => {
        setUpState('err');
        toast(tr('Could not read that photo.'));
      }
    );
  };

  const clearPhoto = () => {
    setImgData('');
    setImgId('');
    setUpState('');
  };

  const pickLoc = (loc: string) => {
    if (upState === 'busy') {
      toast(tr('Photo is still uploading...'));
      return;
    }
    onSend(loc, reason, imgId);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-rose-600 rounded-3xl max-w-sm w-full p-4 shadow-2xl text-center max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-black text-white mb-2">{T('help_reason', lang)}</h3>
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {reasons.map((r) => {
            const on = reason === r;
            return (
              <button
                type="button"
                key={r}
                onClick={() => setReason(on ? '' : r)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-black border ${
                  on
                    ? 'bg-rose-600 border-rose-300 text-white'
                    : 'bg-slate-800 border-slate-600 text-slate-200'
                }`}
              >
                {T('r_' + r, lang)}
              </button>
            );
          })}
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-center gap-2">
            <label className="px-3 py-2 bg-slate-800 border border-dashed border-slate-500 rounded-xl text-xs font-black text-slate-200 cursor-pointer active:scale-95">
              {tr('📷 Add photo (optional)')}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = '';
                  handleFile(f || undefined);
                }}
              />
            </label>
            {imgData && (
              <button
                type="button"
                onClick={clearPhoto}
                className="px-2.5 py-2 bg-slate-800 text-rose-300 rounded-xl text-xs font-black"
              >
                &#10005;
              </button>
            )}
          </div>
          {imgData && (
            <div className="mt-2 relative">
              <img
                src={imgData}
                alt=""
                className="mx-auto max-h-28 rounded-xl border border-slate-700"
              />
              <div className="mt-1 text-[10px] font-black">
                {upState === 'busy' && (
                  <span className="text-amber-300">{tr('Uploading photo...')}</span>
                )}
                {upState === 'ok' && (
                  <span className="text-emerald-300">{tr('✔ Photo attached')}</span>
                )}
                {upState === 'err' && (
                  <span className="text-rose-300">
                    {tr('Upload failed - remove and try again')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <h3 className="text-sm font-black text-white mb-3">{T('help_pick', lang)}</h3>
        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1.5">
          {tr('Aisle')}
        </div>
        <div className="grid grid-cols-5 gap-1.5 mb-2.5 text-sm font-black">
          {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => pickLoc(`Aisle ${n}`)}
              className="py-2.5 bg-slate-800 rounded-xl border border-slate-700 text-white active:scale-95"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4 text-xs font-black">
          <button
            type="button"
            onClick={() => pickLoc('Pallet Area')}
            className="py-2.5 bg-indigo-900 text-white rounded-xl active:scale-95"
          >
            {tr('Pallet Area')}
          </button>
          <button
            type="button"
            onClick={() => pickLoc('Grocery Area')}
            className="py-2.5 bg-emerald-900 text-white rounded-xl active:scale-95"
          >
            {tr('Grocery Area')}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 bg-slate-800 text-slate-400 font-bold rounded-xl text-xs"
        >
          {T('cancel', lang)}
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 4. Send Helper Modal (TL)
// ==========================================
export const PdaSendHelperModal: React.FC<{
  helpId: string;
  st: LiveState;
  empId: string;
  lang: PdaLang;
  onClose: () => void;
  onPickHelper: (helpId: string, helperId: string) => void;
}> = ({ helpId, st, empId, lang, onClose, onPickHelper }) => {
  if (!helpId) return null;
  const req = (st.activeHelpRequests || []).find((r) => r.id === helpId);
  if (!req) return null;

  const tr = (s: string) => trStr(s, lang);
  const list = (st.employees || []).filter((w) => {
    const a = (st.assignments || {})[w.id] || {};
    return (
      st.attendance[w.id] === 'Present' &&
      !a.onBreak &&
      lc(w.id) !== lc(req.empId) &&
      lc(w.id) !== lc(empId)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border-2 border-sky-600 rounded-3xl max-w-sm w-full p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-black text-white">{tr('Send a helper')}</h3>
        <p className="text-[11px] text-slate-400 mb-2">
          {req.empName} at {req.location} ({req.station})
        </p>
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl">
          {list.length ? (
            list.map((w) => {
              const a = (st.assignments || {})[w.id] || {};
              const code = curStation(a, '');
              return (
                <button
                  type="button"
                  key={w.id}
                  onClick={() => onPickHelper(helpId, w.id)}
                  className="w-full p-2.5 flex items-center justify-between text-left active:bg-sky-900/40"
                >
                  <span className="text-xs font-bold text-white truncate">{w.name}</span>
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded text-white ${stationBg(
                      st,
                      code
                    )}`}
                  >
                    {code}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="p-4 text-center text-slate-500 text-xs">
              {tr('No helpers available.')}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full mt-3 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs"
        >
          {tr('Close')}
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 5. Broadcast Modal (Must-read popup)
// ==========================================
export const PdaBroadcastModal: React.FC<{
  item: BroadcastItem | null;
  readOnly: boolean;
  index: number;
  total: number;
  lang: PdaLang;
  onAck: (id: string, kind: 'ok' | 'unclear') => void;
  onCloseView: () => void;
}> = ({ item, readOnly, index, total, lang, onAck, onCloseView }) => {
  const [zoom, setZoom] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setZoom(false);
    setImgErr(false);
  }, [item?.id]);

  if (!item) return null;
  const tr = (s: string) => trStr(s, lang);
  const urgent = item.priority === 'urgent';

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/95 overflow-y-auto p-3.5">
      <div className="max-w-md mx-auto my-2">
        <div
          className={`rounded-3xl border-2 p-4 shadow-2xl ${
            urgent ? 'border-rose-500 bg-rose-950/80 animate-emergency' : 'border-sky-500 bg-slate-900'
          }`}
        >
          <div
            className={`flex items-center justify-between text-[10px] font-black uppercase ${
              urgent ? 'text-rose-200' : 'text-sky-300'
            }`}
          >
            <span>{urgent ? tr('🚨 Urgent message') : '📢 Message'}</span>
            {total > 1 && (
              <span>
                {index} / {total}
              </span>
            )}
          </div>
          {item.title && (
            <h2 className="text-lg font-black text-white mt-1.5 break-words">{item.title}</h2>
          )}
          <div className="text-[10px] text-slate-400 mt-0.5">
            {item.sender} &bull; {item.timeStr}
          </div>

          {item.imageUrl && (
            <div className="mt-3">
              {imgErr ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-800 rounded-2xl">
                  {tr('Photo could not load')}
                </div>
              ) : (
                <img
                  src={item.imageUrl}
                  alt=""
                  onClick={() => setZoom((z) => !z)}
                  onError={() => setImgErr(true)}
                  className={`w-full rounded-2xl border border-slate-700 bg-slate-800 cursor-pointer ${
                    zoom ? '' : 'max-h-72 object-contain'
                  }`}
                />
              )}
            </div>
          )}

          {item.message && (
            <p className="text-base text-white mt-3 whitespace-pre-wrap break-words leading-relaxed">
              {item.message}
            </p>
          )}

          {readOnly ? (
            <button
              type="button"
              onClick={onCloseView}
              className="w-full mt-4 py-3 bg-slate-700 text-white font-black rounded-2xl"
            >
              {tr('Close')}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => onAck(item.id, 'ok')}
                className="py-3.5 bg-emerald-600 text-white font-black rounded-2xl text-sm active:scale-95"
              >
                {tr('✔ Got it')}
              </button>
              <button
                type="button"
                onClick={() => onAck(item.id, 'unclear')}
                className="py-3.5 bg-amber-600 text-white font-black rounded-2xl text-sm active:scale-95"
              >
                {tr('❓ Not clear')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 6. TL Colleague Action Bottom Sheet
// ==========================================
export const PdaCcSheet: React.FC<{
  sheet: { id: string; mode: 'main' | 'move' | 'helper' | 'ring' | 'att' } | null;
  setSheet: (s: { id: string; mode: 'main' | 'move' | 'helper' | 'ring' | 'att' } | null) => void;
  st: LiveState;
  active: boolean;
  nowSrvMs: number;
  lang: PdaLang;
  toast: (m: string) => void;
  onAct: (fn: string, args: unknown[], okMsg: string, key: string) => void;
}> = ({ sheet, setSheet, st, active, nowSrvMs, lang, toast, onAct }) => {
  const [attTime, setAttTime] = useState('');

  useEffect(() => {
    if (!sheet) setAttTime('');
  }, [sheet?.id]);

  if (!sheet) return null;
  const w: Employee | undefined = (st.employees || []).find((x) => lc(x.id) === lc(sheet.id));
  if (!w) return null;

  const tr = (s: string) => trStr(s, lang);
  const a = (st.assignments || {})[w.id] || {};
  const at = (st.attendance || {})[w.id] || 'Present';
  const here = at === 'Present';
  const line = curStation(a, '');
  const defs = st.taskDefinitions || {};
  const codes = Object.keys(defs).filter((c) => !(st.disabledTasks || {})[c]);

  const sheetBtn = (onClick: () => void, label: string, cls?: string) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full py-3 rounded-2xl text-sm font-black active:scale-95 ${
        cls || 'bg-slate-800 border border-slate-600 text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[65] bg-slate-950/80 flex items-end justify-center"
      onClick={() => setSheet(null)}
    >
      <div
        className="bg-slate-900 border-t-2 border-sky-600 rounded-t-3xl w-full max-w-md p-4 pb-6 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="min-w-0">
            <div className="text-base font-black text-white truncate">{w.name}</div>
            <div className="text-[11px] text-slate-400">
              {w.id} &middot;{' '}
              {here
                ? (line || '-') +
                  (a.onBreak ? ' · ☕ ' + brkTxt(a, nowSrvMs) : '') +
                  (a.isHelping ? ' · ' + tr('helper') : '')
                : at}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSheet(null)}
            className="px-3 py-1.5 bg-slate-800 rounded-xl text-slate-300 text-xs font-black"
          >
            &#10005;
          </button>
        </div>

        {sheet.mode !== 'main' && (
          <button
            type="button"
            onClick={() => setSheet({ id: w.id, mode: 'main' })}
            className="mb-2 text-[11px] font-black text-sky-300"
          >
            {tr('‹ Back')}
          </button>
        )}

        {sheet.mode === 'main' && (
          <div className="space-y-2">
            {here && (
              <>
                {sheetBtn(
                  () => setSheet({ id: w.id, mode: 'move' }),
                  tr('↔ Move to another line')
                )}
                {a.onBreak
                  ? sheetBtn(
                      () => {
                        setSheet(null);
                        onAct('tlAction', ['breakEnd', { empId: w.id }], 'Break ended', 'cc-' + w.id);
                      },
                      tr('☕ End break'),
                      'bg-amber-600 text-white'
                    )
                  : sheetBtn(
                      () => {
                        setSheet(null);
                        onAct(
                          'tlAction',
                          ['breakStart', { empId: w.id }],
                          'Break started',
                          'cc-' + w.id
                        );
                      },
                      tr('☕ Start break')
                    )}
                {a.isHelping
                  ? sheetBtn(
                      () => {
                        setSheet(null);
                        onAct(
                          'tlAction',
                          ['helperRevert', { empId: w.id }],
                          'Returned to own line',
                          'cc-' + w.id
                        );
                      },
                      tr('↩ Return to own line')
                    )
                  : sheetBtn(
                      () => setSheet({ id: w.id, mode: 'helper' }),
                      tr('🤝 Send as helper to…')
                    )}
                {sheetBtn(
                  () => setSheet({ id: w.id, mode: 'ring' }),
                  tr('🔔 Ring bell (call to desk)')
                )}
              </>
            )}
            {sheetBtn(
              () => setSheet({ id: w.id, mode: 'att' }),
              tr('📋 Attendance (present / absent / late…)')
            )}
          </div>
        )}

        {(sheet.mode === 'move' || sheet.mode === 'helper') && (
          <div>
            <div className="text-[11px] font-black uppercase text-slate-400 mb-2">
              {tr(sheet.mode === 'move' ? 'Move to line' : 'Send as helper to')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {codes.map((c) => (
                <button
                  type="button"
                  key={c}
                  disabled={c === line}
                  onClick={() => {
                    const isMove = sheet.mode === 'move';
                    setSheet(null);
                    onAct(
                      'tlAction',
                      [isMove ? 'swap' : 'helperDeploy', { empId: w.id, target: c }],
                      (isMove ? 'Moved to ' : 'Sent as helper to ') + c,
                      'cc-' + w.id
                    );
                  }}
                  className={`py-3 rounded-xl text-sm font-black active:scale-95 ${
                    c === line
                      ? 'bg-slate-800 text-slate-600 border border-slate-800'
                      : 'bg-sky-800 text-white border border-sky-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {sheet.mode === 'ring' && (
          <div className="space-y-2">
            {RING_REASONS.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => {
                  setSheet(null);
                  onAct('tlAction', ['ring', { empId: w.id, message: r }], 'Bell rung', 'cc-' + w.id);
                }}
                className="w-full py-3 rounded-2xl text-sm font-black active:scale-95 bg-amber-500 text-slate-950"
              >
                {tr('🔔 ' + r)}
              </button>
            ))}
          </div>
        )}

        {sheet.mode === 'att' && (
          <div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {([
                ['Present', 'Present', 'bg-emerald-700'],
                ['AB', 'Absent', 'bg-rose-700'],
                ['LV', 'Leave', 'bg-sky-700'],
              ] as const).map(([k, lbl, cls]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => {
                    setSheet(null);
                    onAct(
                      'tlAction',
                      ['attendance', { empId: w.id, kind: k, time: attTime }],
                      'Attendance updated',
                      'cc-' + w.id
                    );
                  }}
                  className={`py-3 rounded-xl text-sm font-black text-white active:scale-95 ${cls}`}
                >
                  {tr(lbl)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={attTime}
                onChange={(e) => setAttTime(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (!attTime) {
                    toast(tr('Enter the time.'));
                    return;
                  }
                  setSheet(null);
                  onAct(
                    'tlAction',
                    ['attendance', { empId: w.id, kind: 'late', time: attTime }],
                    'Attendance updated',
                    'cc-' + w.id
                  );
                }}
                className="px-3 py-3 rounded-xl text-xs font-black bg-amber-700 text-white"
              >
                {tr('Late')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!attTime) {
                    toast(tr('Enter the time.'));
                    return;
                  }
                  setSheet(null);
                  onAct(
                    'tlAction',
                    ['attendance', { empId: w.id, kind: 'early', time: attTime }],
                    'Attendance updated',
                    'cc-' + w.id
                  );
                }}
                className="px-3 py-3 rounded-xl text-xs font-black bg-slate-600 text-white"
              >
                {tr('Early out')}
              </button>
            </div>
          </div>
        )}

        {!active && (
          <div className="mt-3 text-[11px] text-amber-300 text-center">
            {tr('Shift is closed - most actions are disabled.')}
          </div>
        )}
      </div>
    </div>
  );
};
