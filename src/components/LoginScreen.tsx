import React, { useEffect, useMemo, useState } from 'react';
import { gs } from '../api/appsScript';
import { LiveState, LoginPerson, StoredSession } from '../types/shift';
import { unlockAudio } from '../utils/audio';
import { LANGS, PdaLang, T, trStr } from '../utils/pdaI18n';
import { NsLogo } from './NsLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface LoginScreenProps {
  onLogin: (session: StoredSession, initialState?: LiveState) => void;
  netBannerText: string;
  onNetworkStatus: (isNetFail: boolean) => void;
  lang: PdaLang;
  onCycleLang: () => void;
}

type Step = 'choose' | 'employee';
type TargetMode = 'dashboard' | 'pda';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  netBannerText,
  onNetworkStatus,
  lang,
  onCycleLang,
}) => {
  const [step, setStep] = useState<Step>('choose');
  const [targetMode, setTargetMode] = useState<TargetMode>('pda');

  const [loginList, setLoginList] = useState<LoginPerson[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState('');
  const [search, setSearch] = useState('');

  const [picked, setPicked] = useState<LoginPerson | null>(null);
  const [password, setPassword] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  const loadLoginList = () => {
    setListLoading(true);
    setListErr('');
    gs<LoginPerson[]>(
      'getLoginList',
      [],
      (list) => {
        setListLoading(false);
        onNetworkStatus(false);
        setLoginList(Array.isArray(list) ? list : []);
      },
      (msg, isNet) => {
        setListLoading(false);
        if (isNet) onNetworkStatus(true);
        setListErr(msg || 'Network problem. Try again.');
      }
    );
  };

  useEffect(() => {
    if (step === 'employee' && loginList.length === 0 && !listLoading) {
      loadLoginList();
    }
  }, [step]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loginList;
    return loginList.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q)
    );
  }, [loginList, search]);

  const openPickerFor = (mode: TargetMode) => {
    unlockAudio();
    setTargetMode(mode);
    setPicked(null);
    setPassword('');
    setPwErr('');
    setStep('employee');
  };

  const submitPassword = () => {
    unlockAudio();
    if (!picked || pwBusy) return;
    setPwBusy(true);
    setPwErr('');
    gs<{
      success: boolean;
      name?: string;
      id?: string;
      token?: string;
      role?: string;
      plan?: string;
      isTL?: boolean;
      error?: string;
    }>(
      'verifyPdaPassword',
      [picked.id, password.trim()],
      (res) => {
        setPwBusy(false);
        onNetworkStatus(false);
        if (!res || !res.success || !res.token) {
          setPwErr((res && res.error) || trStr('Incorrect password.', lang));
          return;
        }

        const empId = res.id || picked.id;
        const empName = res.name || picked.name;
        const token = res.token;

        if (targetMode === 'dashboard') {
          if (res.isTL !== true) {
            setPassword('');
            setPwErr('Only Team Leads can open the dashboard');
            return;
          }
          setPicked(null);
          setPassword('');
          onLogin({
            token,
            kind: 'P',
            empId,
            empName,
            isTL: true,
            viewMode: 'dashboard',
          });
          return;
        }

        setPicked(null);
        setPassword('');
        onLogin({
          token,
          kind: 'P',
          empId,
          empName,
          ...(typeof res.isTL === 'boolean' ? { isTL: res.isTL } : {}),
        });
      },
      (msg, isNet) => {
        setPwBusy(false);
        if (isNet) onNetworkStatus(true);
        setPwErr(msg || trStr('Network problem. Try again.', lang));
      }
    );
  };

  const currentLangLabel = (LANGS.find((x) => x[0] === lang) || LANGS[0])[1];

  return (
    <div className="min-h-screen bg-[#0b1530] text-slate-100 flex flex-col overflow-x-hidden">
      {netBannerText && (
        <div className="bg-amber-500 text-slate-950 text-sm font-black text-center py-2 px-3 sticky top-0 z-40">
          {netBannerText}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header Branding */}
          <div className="flex flex-col items-center text-center mb-6">
            <NsLogo size={72} className="mb-3 rounded-2xl shadow-lg" />
            <h1 className="text-2xl font-black tracking-tight text-white">NS Shift A</h1>
            <p className="text-sm font-semibold text-slate-300 mt-1">
              12:00 AM - 9:00 AM &bull; Jeddah / JEDMS02
            </p>
            <div className="mt-3 flex items-center gap-2">
              <PWAInstallButton compact />
              {step === 'employee' && (
                <button
                  type="button"
                  onClick={onCycleLang}
                  className="min-h-[44px] px-3 py-1.5 bg-[#14213f] border border-slate-600 rounded-xl text-sm font-black text-slate-200"
                >
                  &#127760; {currentLangLabel}
                </button>
              )}
            </div>
          </div>

          {/* Step 1: Two choices */}
          {step === 'choose' && (
            <div className="space-y-3.5">
              <button
                type="button"
                onClick={() => openPickerFor('dashboard')}
                className="w-full p-5 rounded-3xl bg-[#FEEE00] text-[#14213f] shadow-xl active:scale-[0.98] transition text-left flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs font-black uppercase tracking-wider opacity-80">
                    Team Lead Sign In Required
                  </div>
                  <div className="text-xl font-black mt-0.5">Main Dashboard</div>
                  <div className="text-sm font-bold opacity-85 mt-1">
                    Lines board, breaks, broadcast, reports & productivity
                  </div>
                </div>
                <span className="text-2xl font-black shrink-0">&rsaquo;</span>
              </button>

              <button
                type="button"
                onClick={() => openPickerFor('pda')}
                className="w-full p-5 rounded-3xl bg-[#14213f] border-2 border-slate-600/80 text-white shadow-xl active:scale-[0.98] transition text-left flex items-center justify-between gap-4 hover:border-[#FEEE00]/70"
              >
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-[#FEEE00]">
                    CC / FL / TL
                  </div>
                  <div className="text-xl font-black mt-0.5">Employee / TL Login</div>
                  <div className="text-sm font-semibold text-slate-300 mt-1">
                    Pick your name and sign in with your password
                  </div>
                </div>
                <span className="text-2xl font-black text-[#FEEE00] shrink-0">&rsaquo;</span>
              </button>
            </div>
          )}

          {/* Step 2: Employee / TL Login */}
          {step === 'employee' && (
            <div className="bg-[#14213f] border border-slate-700 rounded-3xl p-4 shadow-2xl">
              <div className="flex items-center justify-between gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep('choose');
                    setPicked(null);
                    setPwErr('');
                  }}
                  className="min-h-[44px] text-sm font-black text-slate-200 hover:text-white px-3 py-2 rounded-xl bg-[#0b1530] border border-slate-700"
                >
                  &lsaquo; Back
                </button>
                <span
                  className={
                    'text-xs font-black px-2.5 py-1 rounded-lg ' +
                    (targetMode === 'dashboard'
                      ? 'bg-[#FEEE00] text-[#14213f]'
                      : 'bg-[#0b1530] text-[#FEEE00] border border-slate-700')
                  }
                >
                  {targetMode === 'dashboard' ? 'TL Dashboard' : 'Employee / TL'}
                </span>
                <button
                  type="button"
                  onClick={loadLoginList}
                  className="min-h-[44px] text-sm font-bold text-slate-200 px-3 py-2 rounded-xl bg-[#0b1530] border border-slate-700"
                >
                  &#8635; Refresh
                </button>
              </div>
              <div className="text-center mb-3">
                <h2 className="text-base font-black text-white">
                  {targetMode === 'dashboard' ? 'Team Lead Dashboard Login' : T('login_title', lang)}
                </h2>
                <p className="text-sm text-slate-300 mt-0.5">
                  {targetMode === 'dashboard'
                    ? 'Select your TL profile and enter your password'
                    : T('login_sub', lang)}
                </p>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={trStr('Search name or ID...', lang)}
                className="w-full min-h-[44px] bg-[#0b1530] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#FEEE00] mb-3"
              />
              {listErr && (
                <div className="mb-2 text-sm text-rose-400 font-bold text-center">{listErr}</div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-700/60 border border-slate-700 rounded-xl bg-[#0b1530]/70 text-left">
                {listLoading && loginList.length === 0 ? (
                  <div className="p-4 text-center text-slate-300 text-sm">
                    {trStr('Loading...', lang)}
                  </div>
                ) : filteredPeople.length > 0 ? (
                  filteredPeople.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => {
                        unlockAudio();
                        setPicked(e);
                        setPassword('');
                        setPwErr('');
                      }}
                      className="w-full min-h-[48px] p-3 flex items-center justify-between gap-2 text-left active:bg-sky-900/40 hover:bg-[#14213f]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{e.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{e.id}</div>
                      </div>
                      <span className="text-xs font-black px-3 py-2 rounded-lg bg-[#FEEE00] text-[#14213f] shrink-0">
                        Select
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 text-sm">
                    {loginList.length ? trStr('No colleague found.', lang) : trStr('Loading...', lang)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Password Modal */}
      {picked && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => {
            if (!pwBusy) setPicked(null);
          }}
        >
          <div
            className="bg-[#14213f] border-2 border-[#FEEE00] rounded-3xl max-w-sm w-full p-5 shadow-2xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black text-white">
              {targetMode === 'dashboard'
                ? 'Team Lead Verification'
                : trStr('Security verification', lang)}
            </h3>
            <div className="text-sm font-bold text-[#FEEE00] mt-0.5">{picked.name}</div>
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitPassword();
              }}
              placeholder={trStr('Enter your password...', lang)}
              className="w-full min-h-[44px] bg-[#0b1530] border border-slate-700 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white mt-3 mb-2 outline-none focus:border-[#FEEE00]"
            />
            {pwErr && (
              <p className="text-rose-300 bg-rose-950/80 border border-rose-500/70 rounded-xl px-3 py-2 text-sm font-bold mb-2">
                {pwErr}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={pwBusy}
                onClick={() => setPicked(null)}
                className="flex-1 min-h-[44px] py-2.5 bg-[#0b1530] border border-slate-700 text-slate-200 font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {T('cancel', lang)}
              </button>
              <button
                type="button"
                disabled={pwBusy}
                onClick={submitPassword}
                className="flex-1 min-h-[44px] py-2.5 bg-[#FEEE00] text-[#14213f] font-black rounded-xl text-sm disabled:opacity-50"
              >
                {pwBusy ? trStr('Verifying...', lang) : trStr('Authenticate', lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
