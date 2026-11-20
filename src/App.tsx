import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gs } from './api/appsScript';
import { LoginScreen } from './components/LoginScreen';
import { NsLogo } from './components/NsLogo';
import { DashboardView } from './components/dashboard/DashboardView';
import { PdaView } from './components/pda/PdaView';
import { LiveState, StoredSession } from './types/shift';
import { unlockAudio } from './utils/audio';
import { PdaLang, T, trStr } from './utils/pdaI18n';

const SESSION_KEY = 'ns_shift_a_session';
const LANG_KEY = 'pda_lang';
const lc = (s: unknown) => String(s == null ? '' : s).trim().toLowerCase();

function loadStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed || parsed.kind !== 'P' || !parsed.token || !parsed.empId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredSession(s: StoredSession | null): void {
  try {
    if (!s) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

function loadStoredLang(): PdaLang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === 'hi' || v === 'bn' || v === 'en') return v;
  } catch {
    // ignore
  }
  return 'en';
}

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(() => loadStoredSession());
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [lang, setLang] = useState<PdaLang>(() => loadStoredLang());
  const [toastMsg, setToastMsg] = useState('');
  const [netFails, setNetFails] = useState(0);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

  const sessionRef = useRef<StoredSession | null>(session);
  sessionRef.current = session;

  const lastNowRef = useRef(0);
  const skewRef = useRef(0);
  const sawActiveRef = useRef(false);
  const closedPollsRef = useRef(0);
  const notFoundPollsRef = useRef(0);
  const pollingRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const shiftEndHourRef = useRef(9);

  const nowSrv = useCallback(() => Date.now() + skewRef.current, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(''), 3500);
  }, []);

  const cycleLang = useCallback(() => {
    setLang((prev) => {
      const next: PdaLang = prev === 'en' ? 'hi' : prev === 'hi' ? 'bn' : 'en';
      try {
        localStorage.setItem(LANG_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const onNetworkStatus = useCallback((isNetFail: boolean) => {
    setNetFails((n) => (isNetFail ? n + 1 : 0));
  }, []);

  const doLogout = useCallback(
    (msg?: string) => {
      setSession(null);
      saveStoredSession(null);
      setLiveState(null);
      lastNowRef.current = 0;
      skewRef.current = 0;
      sawActiveRef.current = false;
      closedPollsRef.current = 0;
      notFoundPollsRef.current = 0;
      pollingRef.current = false;
      if (msg) toast(msg);
    },
    [toast]
  );

  const checkShiftEnd = useCallback(
    (st?: LiveState | null) => {
      if (!sessionRef.current || !sawActiveRef.current) return false;
      const endHour =
        st && st.shiftEndHour != null ? st.shiftEndHour : shiftEndHourRef.current;
      const riyadhHour = new Date(Date.now() + skewRef.current + 3 * 3600000).getUTCHours();
      if (riyadhHour >= endHour) {
        doLogout('Shift ended. You have been logged out.');
        return true;
      }
      return false;
    },
    [doLogout]
  );

  const applyState = useCallback(
    (st: LiveState): boolean => {
      if (!st || !st.serverNow) return false;
      if (st.serverNow < lastNowRef.current) return false;
      lastNowRef.current = st.serverNow;
      skewRef.current = st.serverNow - Date.now();
      if (st.shiftEndHour != null) shiftEndHourRef.current = st.shiftEndHour;
      if (st.isShiftActive) sawActiveRef.current = true;
      if (checkShiftEnd(st)) return true;
      setLiveState(st);
      return true;
    },
    [checkShiftEnd]
  );

  const pollOnce = useCallback(() => {
    const cur = sessionRef.current;
    if (!cur || pollingRef.current) return;
    pollingRef.current = true;
    const tokenAtStart = cur.token || '';
    const kindAtStart = cur.kind;
    const empIdAtStart = cur.empId;

    gs<LiveState>(
      'getLiveState',
      [tokenAtStart],
      (res) => {
        pollingRef.current = false;
        const latest = sessionRef.current;
        if (!latest || (latest.token || '') !== tokenAtStart || !res) return;

        if (res.authRequired || res.code === 'AUTH') {
          doLogout('Session expired');
          return;
        }
        if (res.error || !res.serverNow) return;

        setNetFails(0);
        if (!applyState(res)) return;

        // Auto logout rules on live poll results
        if (!res.isShiftActive) closedPollsRef.current++;
        else closedPollsRef.current = 0;

        if (sawActiveRef.current && closedPollsRef.current >= 1) {
          doLogout('Shift ended. You have been logged out.');
          return;
        }

        if (kindAtStart === 'P') {
          const emps = res.employees || [];
          const found = emps.some((e) => lc(e.id) === lc(empIdAtStart));
          if (emps.length > 0 && !found) notFoundPollsRef.current++;
          else notFoundPollsRef.current = 0;
          if (notFoundPollsRef.current >= 3) {
            doLogout('Your profile was removed from the roster.');
          }
        }
      },
      (_msg, isNet) => {
        pollingRef.current = false;
        if (isNet) setNetFails((n) => n + 1);
      }
    );
  }, [applyState, doLogout]);

  // Polling loop: 5s visible, 25s hidden
  useEffect(() => {
    if (!session) return;

    const scheduleNext = () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      const delay = document.hidden ? 25000 : 5000;
      pollTimerRef.current = window.setTimeout(() => {
        pollOnce();
        scheduleNext();
      }, delay);
    };

    pollOnce();
    scheduleNext();

    const onVis = () => {
      if (!document.hidden) {
        pollOnce();
        scheduleNext();
      }
    };
    const onOnline = () => {
      setIsOffline(false);
      setNetFails(0);
      pollOnce();
    };
    const onOffline = () => setIsOffline(true);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [session?.token, session?.kind, pollOnce]);

  // 1-second timer to trigger instant 9:00 AM Riyadh shift-end logout
  useEffect(() => {
    if (!session) return;
    const id = window.setInterval(() => {
      checkShiftEnd(liveState);
    }, 1000);
    return () => window.clearInterval(id);
  }, [session, liveState, checkShiftEnd]);

  // Keep alerts/audio always enabled and resumed on any interaction or visibility change
  useEffect(() => {
    const onUnlock = () => unlockAudio();
    const onVis = () => {
      if (!document.hidden) unlockAudio();
    };
    unlockAudio();
    document.addEventListener('pointerdown', onUnlock, { passive: true });
    document.addEventListener('touchstart', onUnlock, { passive: true });
    document.addEventListener('click', onUnlock, { passive: true });
    document.addEventListener('keydown', onUnlock, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('pointerdown', onUnlock);
      document.removeEventListener('touchstart', onUnlock);
      document.removeEventListener('click', onUnlock);
      document.removeEventListener('keydown', onUnlock);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const handleLogin = useCallback(
    (newSession: StoredSession, initialState?: LiveState) => {
      lastNowRef.current = 0;
      skewRef.current = 0;
      sawActiveRef.current = false;
      closedPollsRef.current = 0;
      notFoundPollsRef.current = 0;
      pollingRef.current = false;

      setSession(newSession);
      saveStoredSession(newSession);

      if (initialState && initialState.serverNow) {
        applyState(initialState);
      } else {
        setLiveState(null);
      }

      if (newSession.empName) {
        toast(`Welcome ${newSession.empName}`);
      }
    },
    [applyState, toast]
  );

  const setViewMode = useCallback((mode: 'dashboard' | 'pda') => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated: StoredSession = { ...prev, viewMode: mode };
      saveStoredSession(updated);
      return updated;
    });
  }, []);

  const netBannerText = useMemo(() => {
    if (isOffline) return T('net_off', lang);
    if (netFails >= 2) return T('net_weak', lang);
    return '';
  }, [isOffline, netFails, lang]);

  // 1. Not logged in -> Unified Login Screen
  if (!session) {
    return (
      <>
        {toastMsg && (
          <div className="fixed top-3 left-4 right-4 z-[90] max-w-md mx-auto bg-slate-800 border border-[#FEEE00]/60 text-white py-2 px-3 rounded-xl shadow-2xl text-center text-xs font-bold">
            {trStr(toastMsg, lang)}
          </div>
        )}
        <LoginScreen
          onLogin={handleLogin}
          netBannerText={netBannerText}
          onNetworkStatus={onNetworkStatus}
          lang={lang}
          onCycleLang={cycleLang}
        />
      </>
    );
  }

  // 2. Waiting for first LiveState after login/refresh
  if (!liveState) {
    return (
      <div className="min-h-screen bg-[#0b1530] text-slate-100 flex flex-col items-center justify-center p-6 text-center">
        {netBannerText && (
          <div className="fixed top-0 inset-x-0 bg-amber-500 text-slate-950 text-xs font-black text-center py-2 px-3 z-50">
            {netBannerText}
          </div>
        )}
        <NsLogo size={64} className="rounded-2xl shadow-lg mb-4" />
        <div className="text-lg font-black text-white">NS Shift A</div>
        <div className="text-xs text-slate-300 mt-1">
          {trStr('Connecting...', lang)}
        </div>
        {toastMsg && (
          <div className="mt-4 bg-slate-800 border border-slate-700 text-white py-2 px-3 rounded-xl text-xs font-bold">
            {trStr(toastMsg, lang)}
          </div>
        )}
        <button
          type="button"
          onClick={() => doLogout('')}
          className="mt-6 px-4 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          {trStr('Logout', lang)}
        </button>
      </div>
    );
  }

  // 3. Role Resolution (use session.isTL from verifyPdaPassword when present)
  const me = (liveState.employees || []).find((e) => lc(e.id) === lc(session.empId));
  const plan = (me && me.plan && me.plan[liveState.currentRealDay]) || '';
  const asg = (me && (liveState.assignments || {})[me.id]) || {};
  const isTL =
    session.isTL === true ||
    (session.isTL !== false && (plan === 'TL' || asg.task1 === 'TL' || asg.activeStation === 'TL'));

  // TL defaults to Dashboard view, with option to switch to PDA view
  if (isTL && session.viewMode !== 'pda') {
    return (
      <DashboardView
        S={liveState}
        token={session.token}
        applyState={applyState}
        onRequireAuth={() => doLogout('Session expired')}
        onLogout={() => doLogout('')}
        isTL={true}
        onSwitchToPda={() => setViewMode('pda')}
        netBannerText={netBannerText}
        onNetworkStatus={onNetworkStatus}
        nowSrv={nowSrv}
        toast={toast}
        toastMsg={toastMsg}
      />
    );
  }

  // FL / CC -> always PDA; TL when switched to PDA view -> PDA with Switch back button
  return (
    <PdaView
      S={liveState}
      token={session.token}
      empId={session.empId}
      isTL={isTL}
      lang={lang}
      onCycleLang={cycleLang}
      applyState={applyState}
      onAuthFail={() => doLogout('Session expired')}
      onLogout={() => doLogout('')}
      onSwitchToDashboard={isTL ? () => setViewMode('dashboard') : undefined}
      netFails={netFails}
      onNetworkStatus={onNetworkStatus}
      nowSrv={nowSrv}
      toast={toast}
      toastMsg={toastMsg}
    />
  );
}
