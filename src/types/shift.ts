export interface Employee {
  id: string;
  name: string;
  plan: Record<string, string>;
}

export interface Assignment {
  task1?: string;
  task2?: string;
  activeStation?: string;
  originalStation?: string;
  isHelping?: boolean;
  onBreak?: boolean;
  breakStatus?: 'pending' | 'active' | 'completed';
  breakStartTime?: number | null;
  breakEndTime?: number | null;
  breakDurationMins?: number;
  helperStartTime?: number | null;
  helperStartTimeStr?: string | null;
  coveringFor?: string;
  swappedFrom?: string;
  moveNote?: { id: string; text: string; ts: number } | null;
  leftFrom?: string;
}

export interface TaskDef {
  name: string;
  badge?: string;
  headerBg: string;
  pillBg?: string;
}

export interface HelpRequest {
  id: string;
  empId: string;
  empName: string;
  station: string;
  location: string;
  status: 'pending' | 'accepted';
  acceptedBy?: string;
  acceptedById?: string;
  acceptedByRole?: string;
  acceptedAtStr?: string;
  helperId?: string;
  helperName?: string;
  timeStr: string;
  timestamp: number;
  waitMs?: number;
  escalated?: boolean;
  reason?: string;
  aisleNo?: number | null;
  flDist?: Record<string, number | null>;
  nearestFlId?: string;
  nearestFlName?: string;
  imageId?: string;
  imageUrl?: string;
}

export interface HelpLogItem {
  id: string;
  type: 'raised' | 'accepted' | 'dispatched' | 'cleared';
  helpId: string;
  empId: string;
  empName: string;
  location: string;
  station: string;
  by: string;
  byRole: string;
  ts: number;
  timeStr: string;
  helperName?: string;
  reason?: string;
  imageUrl?: string;
}

export interface Summon {
  id: string;
  targetId: string;
  targetName: string;
  tlName: string;
  message: string;
  timeStr: string;
  timestamp: number;
}

export interface Announcement {
  id: string;
  target: string;
  message: string;
  sender: string;
  senderId: string;
  ts: number;
  timeStr: string;
  acks?: Record<string, number>;
  ended?: boolean;
  total?: number;
  ackedCount?: number;
}

export interface BroadcastItem {
  id: string;
  title?: string;
  message?: string;
  imageId?: string;
  imageUrl?: string;
  priority: 'normal' | 'urgent';
  sender: string;
  senderId?: string;
  ts: number;
  timeStr: string;
  status?: string;
  total: number;
  ackedCount: number;
  acks?: Record<string, number>;
  reply?: Record<string, 'ok' | 'unclear'>;
  unseen?: { id: string; name: string }[];
  ping?: number;
}

export interface NonSortRequest {
  id: string;
  empId: string;
  empName: string;
  awb: string;
  count: number | null;
  status: 'pending' | 'ready' | 'completed';
  timeStr: string;
  timestamp: number;
  countedBy?: string;
}

export interface OverstayBreak {
  empId: string;
  name: string;
  station: string;
  overtimeMins: number;
  scheduledMins: number;
  breakEndTime: number;
}

export interface BreachItem {
  code: string;
  min: number;
  active: number;
}

export interface ProdVersion {
  rows: number;
  latest: string;
  sig: number;
  v: string;
}

export interface LiveState {
  authRequired?: boolean;
  code?: string;
  error?: string;
  noPin?: boolean;
  me?: { kind: 'D' | 'P'; empId: string };
  serverNow: number;
  isShiftActive: boolean;
  shiftEndHour?: number;
  isShiftLocked?: boolean;
  currentRealDay: string;
  selectedDay?: string;
  currentDateStr?: string;
  shiftName?: string;
  shiftStartMs?: number;
  shiftEndMs?: number;
  employees: Employee[];
  attendance: Record<string, string>;
  attendanceDetail?: Record<string, { late?: { time: string; mins: number; by?: string }; left?: { time: string; by?: string } }>;
  assignments: Record<string, Assignment>;
  disabledTasks: Record<string, boolean>;
  taskDefinitions: Record<string, TaskDef>;
  minStaff?: Record<string, number>;
  minStaffBreaches?: BreachItem[];
  breakDurationSetting: number;
  overstayDone?: number;
  overstayBreaks?: OverstayBreak[];
  breakMins?: Record<string, number>;
  breakCount?: Record<string, number>;
  helpCount?: Record<string, number>;
  activeHelpRequests?: HelpRequest[];
  activeSummons?: Summon[];
  announcements?: Announcement[];
  helpLog?: HelpLogItem[];
  helpStats?: { raised: number; accepted: number; totalMs: number; maxMs: number; escalated: number };
  helpEscalateMs?: number;
  helpReasons?: string[];
  sheetLeaderboard?: { empName: string; awbs: number; totalCount: number }[];
  nonSortRequests?: NonSortRequest[];
  broadcasts?: BroadcastItem[];
  bcHistory?: BroadcastItem[];
  prodVer?: ProdVersion;
}

export interface LoginPerson {
  id: string;
  name: string;
}

export type SessionKind = 'D' | 'P';

export interface StoredSession {
  token: string;
  kind: SessionKind;
  empId: string;
  empName?: string;
  isTL?: boolean;
  viewMode?: 'dashboard' | 'pda';
}
