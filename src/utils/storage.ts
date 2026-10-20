import {
  FoundationInfo,
  School,
  User,
  TeacherAssignment,
  SchoolClass,
  Subject,
  ClassJournalEntry,
  TeacherAttendanceEntry,
  PasswordResetRequest,
  AdminChatConfig,
  BroadcastMessage,
} from '../types';
import { hashPassword, encryptData, decryptData, computeChecksum } from './crypto';

const STORAGE_KEYS = {
  FOUNDATION: 'asistenguru_foundation',
  SCHOOLS: 'asistenguru_schools',
  USERS: 'asistenguru_users',
  ASSIGNMENTS: 'asistenguru_assignments',
  CLASSES: 'asistenguru_classes',
  SUBJECTS: 'asistenguru_subjects',
  JOURNALS: 'asistenguru_journals',
  ATTENDANCES: 'asistenguru_attendances',
  RESET_REQUESTS: 'asistenguru_reset_requests',
  CURRENT_USER: 'asistenguru_current_user',
  ADMIN_CHAT_CONFIG: 'asistenguru_admin_chat_config',
  BROADCAST_MESSAGE: 'asistenguru_broadcast_message',
  DELETED_IDS: 'asistenguru_deleted_ids',
  SYSTEM_INTEGRITY: 'asistenguru_integrity_hash',
};

// Default Chat Admin Config
export const DEFAULT_ADMIN_CHAT_CONFIG: AdminChatConfig = {
  whatsappNumber: '08117000111',
  chatPromptText:
    'Ada kendala? Atau ada yang mau dicurhatin? Hubungi admin yayasan untuk layanan dan bantuan teknis aplikasi.',
  waTemplateMessage: 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.',
};

// Default Broadcast / Suspension Message
export const DEFAULT_BROADCAST_MESSAGE: BroadcastMessage = {
  judulPesan: 'Pemberitahuan Resmi Dari Admin Pusat Yayasan',
  pesanPusat:
    'Mohon maaf, akun Anda sedang dinonaktifkan sementara oleh Admin Pusat Yayasan. Untuk konfirmasi atau pertanyaan lebih lanjut, silakan hubungi admin yayasan melalui WhatsApp.',
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_APP_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <rect width="100" height="100" rx="24" fill="url(#grad)" />
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="#059669"/>
      <stop offset="1" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <path d="M50 20 L84 36 L50 52 L16 36 Z" fill="#ffffff" stroke="#f59e0b" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M26 44 V62 C26 62 36 72 50 72 C64 72 74 62 74 62 V44" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  <circle cx="84" cy="48" r="4" fill="#fbbf24"/>
  <path d="M84 52 V68" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
  <circle cx="50" cy="78" r="3.5" fill="#34d399"/>
</svg>
`)}`;

// Initial Foundation Setup
const DEFAULT_FOUNDATION: FoundationInfo = {
  name: 'Yayasan Walisongo Rumbai Jaya',
  tagline: 'Mencerdaskan Generasi Berakhlak Qurani, Mandiri, dan Unggul',
  ketuaYayasan: 'Drs. H. M. Rasyid Al-Banjari, M.Si',
  alamat: 'Jl. Rumbai No. 45, Kompleks Pendidikan Yayasan Walisongo, Riau',
  telepon: '(0761) 883921 / 0811-7000-111',
  email: 'pphmrumbaijaya@gmail.com',
  logoYayasanUrl: '',
  logoAppUrl: DEFAULT_APP_LOGO_SVG,
  kutipanLucu: 'Mendidik itu seni menahan tawa saat murid salah jawab dengan ekspresi paling serius, dan seni tersenyum saat akhir bulan saldo tetap syahdu!',
  kutipanAuthor: 'Pengurus Yayasan Pusat',
};

const DEFAULT_SCHOOLS: School[] = [];

const DEFAULT_USERS: User[] = [
  {
    id: 'user-yayasan',
    username: 'yayasan',
    password: '123',
    name: 'Admin Yayasan Walisongo Rumbai Jaya',
    email: 'pphmrumbaijaya@gmail.com',
    phone: '0811-7000-111',
    role: 'ADMIN_YAYASAN',
    statusAktif: 'AKTIF',
  },
];

const DEFAULT_CLASSES: SchoolClass[] = [];
const DEFAULT_ASSIGNMENTS: TeacherAssignment[] = [];
const DEFAULT_SUBJECTS: Subject[] = [];
const DEFAULT_JOURNALS: ClassJournalEntry[] = [];
const DEFAULT_ATTENDANCES: TeacherAttendanceEntry[] = [];

const memoryCache: Record<string, any> = {};

function getItem<T>(key: string, defaultValue: T): T {
  if (key in memoryCache) {
    return memoryCache[key] as T;
  }
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) {
      memoryCache[key] = defaultValue;
      return defaultValue;
    }
    const parsed = JSON.parse(raw);
    memoryCache[key] = parsed;
    return parsed;
  } catch (err) {
    console.error(`Failed to read key ${key}:`, err);
    memoryCache[key] = defaultValue;
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  memoryCache[key] = value;
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.error(`Failed to write key ${key}:`, err);
  }
}

// Multi-tab synchronization support (storage event + BroadcastChannel bus)
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window 
  ? new BroadcastChannel('asistenguru_sync_bus') 
  : null;

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && memoryCache[e.key] !== undefined) {
      delete memoryCache[e.key];
    }
    StorageService.notifyListeners(false);
  });

  if (syncChannel) {
    syncChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_DATA') {
        Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
        StorageService.notifyListeners(false);
      }
    };
  }
}

function broadcastSync() {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type: 'SYNC_DATA', timestamp: Date.now() });
    } catch {}
  }
}

const listeners = new Set<() => void>();
let lastSyncedRevision: string | number = 0;
let inFlightSyncPromise: Promise<boolean> | null = null;
let serverPushTimeout: any = null;

// Helper normalisasi tanggal super akurat untuk mencegah ketidaksinkronan format kalender
export function normalizeDateString(dateStr?: string): { year: number; month: number; day: number; formatted: string } | null {
  if (!dateStr) return null;
  const clean = dateStr.split('T')[0].trim().replace(/\//g, '-');
  const rawParts = clean.split('-').map((p) => parseInt(p.trim(), 10));
  if (rawParts.length !== 3 || rawParts.some(isNaN)) return null;

  let y: number, m: number, d: number;
  if (rawParts[0] > 1000) {
    // Format YYYY-MM-DD
    y = rawParts[0];
    m = rawParts[1];
    d = rawParts[2];
  } else if (rawParts[2] > 1000) {
    // Format DD-MM-YYYY
    d = rawParts[0];
    m = rawParts[1];
    y = rawParts[2];
  } else {
    y = rawParts[0];
    m = rawParts[1];
    d = rawParts[2];
  }

  const formatted = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return { year: y, month: m, day: d, formatted };
}

export const StorageService = {
  // Subscription listener for real-time reactivity
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  notifyListeners(broadcast = true) {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('Listener callback error:', err);
      }
    });
    if (broadcast) {
      broadcastSync();
    }
  },

  getDeletedIds(): string[] {
    return getItem<string[]>(STORAGE_KEYS.DELETED_IDS, []);
  },

  addDeletedId(id: string) {
    if (!id) return;
    const current = new Set(this.getDeletedIds());
    current.add(id);
    setItem(STORAGE_KEYS.DELETED_IDS, Array.from(current));
  },

  // Smart merger: server items provide baseline, local items overlay so fresh local updates are never lost,
  // and deleted items (tombstones) are strictly never resurrected.
  mergeById<T extends { id?: string }>(localList: T[] = [], serverList: T[] = [], deletedSet?: Set<string>): T[] {
    const delSet = deletedSet || new Set(this.getDeletedIds());
    const map = new Map<string, T>();
    (serverList || []).forEach((item) => {
      if (item && item.id && !delSet.has(item.id)) {
        map.set(item.id, item);
      }
    });
    (localList || []).forEach((item) => {
      if (item && item.id && !delSet.has(item.id)) {
        const prev = map.get(item.id);
        map.set(item.id, prev ? { ...prev, ...item } : item);
      }
    });
    return Array.from(map.values());
  },

  // Deduplikasi ketat data Presensi agar tidak rancau antar perangkat & mempertahankan guru dengan peran ganda
  mergeAttendances(localList: TeacherAttendanceEntry[] = [], serverList: TeacherAttendanceEntry[] = [], deletedSet?: Set<string>): TeacherAttendanceEntry[] {
    const delSet = deletedSet || new Set(this.getDeletedIds());
    const map = new Map<string, TeacherAttendanceEntry>();
    const all = [...(serverList || []), ...(localList || [])];
    all.forEach((item) => {
      if (!item || !item.id || delSet.has(item.id)) return;
      const role = item.roleUsed || 'GURU_BIDANG_STUDI';
      const isPerSchool = role === 'KOORDINATOR_KOKURIKULER' || role === 'PEMBINA_EKSTRAKURIKULER';
      const dateInfo = normalizeDateString(item.date);
      const normDate = dateInfo ? dateInfo.formatted : (item.date || '').split('T')[0].trim();
      const classKey = isPerSchool ? 'PERSEKOLAH' : (item.classId || 'ALL');
      // timeKey membedakan sesi jika guru memiliki jam masuk/keluar terpisah di kelas yang sama
      const timeKey = (item.jamMasuk && item.jamKeluar) ? `${item.jamMasuk}-${item.jamKeluar}` : (item.id || '');
      // Kunci unik menyertakan role agar Guru Studi, Guru Bantu, dan Guru Diniyah TIDAK saling menimpa!
      const logicalKey = `${item.schoolId || 'SCH'}_${item.teacherId || item.teacherName}_${normDate}_${role}_${classKey}_${timeKey}`;
      const prev = map.get(logicalKey);
      if (!prev) {
        map.set(logicalKey, { ...item, date: normDate });
      } else {
        const prevTime = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
        const currTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (currTime >= prevTime) {
          map.set(logicalKey, { ...prev, ...item, date: normDate });
        }
      }
    });
    return Array.from(map.values());
  },

  // Deduplikasi ketat data Jurnal Pembelajaran: mempertahankan sesi KBM Guru Bidang Studi per kelas
  mergeJournals(localList: ClassJournalEntry[] = [], serverList: ClassJournalEntry[] = [], deletedSet?: Set<string>): ClassJournalEntry[] {
    const delSet = deletedSet || new Set(this.getDeletedIds());
    const map = new Map<string, ClassJournalEntry>();
    const all = [...(serverList || []), ...(localList || [])];
    all.forEach((item) => {
      if (!item || !item.id || delSet.has(item.id)) return;
      const dateInfo = normalizeDateString(item.date);
      const normDate = dateInfo ? dateInfo.formatted : (item.date || '').split('T')[0].trim();
      const jamKe = item.jamKe || 0;
      const teacherKey = item.teacherId || item.teacherName || 'GURU';
      const classKey = item.classId || 'ALL';
      const roleKey = item.teacherRole || 'GURU_BIDANG_STUDI';
      const subjectKey = item.subjectId || item.subjectName || 'MAPEL';
      const logicalKey = `${item.schoolId || 'SCH'}_${classKey}_${normDate}_${jamKe}_${teacherKey}_${roleKey}_${subjectKey}`;
      const prev = map.get(logicalKey);
      if (!prev) {
        map.set(logicalKey, { ...item, date: normDate });
      } else {
        const prevTime = prev.createdAt ? new Date(prev.createdAt).getTime() : 0;
        const currTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (currTime >= prevTime) {
          map.set(logicalKey, { ...prev, ...item, date: normDate });
        }
      }
    });
    return Array.from(map.values());
  },

  // Deduplikasi penugasan: satu guru hanya memiliki satu profil penugasan aktif per sekolah
  mergeAssignments(localList: TeacherAssignment[] = [], serverList: TeacherAssignment[] = [], deletedSet?: Set<string>): TeacherAssignment[] {
    const delSet = deletedSet || new Set(this.getDeletedIds());
    const map = new Map<string, TeacherAssignment>();
    const all = [...(serverList || []), ...(localList || [])];
    all.forEach((item) => {
      if (!item || !item.id || delSet.has(item.id)) return;
      const logicalKey = `${item.schoolId}_${item.teacherId}`;
      const prev = map.get(logicalKey);
      if (!prev) {
        map.set(logicalKey, item);
      } else {
        const mergedRoles = Array.from(new Set([...(prev.roles || []), ...(item.roles || [])]));
        const mergedClassIds = Array.from(new Set([...(prev.assignedClassIds || []), ...(item.assignedClassIds || [])]));
        map.set(logicalKey, {
          ...prev,
          ...item,
          roles: mergedRoles,
          assignedClassIds: mergedClassIds,
        });
      }
    });
    return Array.from(map.values());
  },

  // Pembersihan otomatis data rancau saat awal inisialisasi aplikasi (Normalisasi & Sanitasi)
  sanitizeAndDeduplicateAll() {
    const delSet = new Set(this.getDeletedIds());
    // 1. Sanitasi Attendances: bersihkan spasi, pastikan roleUsed terisi, tanggal standar YYYY-MM-DD
    const rawAtts = this.getAttendances();
    const sanitizedAtts = rawAtts.map((a) => {
      const dateInfo = normalizeDateString(a.date);
      const cleanDate = dateInfo ? dateInfo.formatted : (a.date || '').split('T')[0].trim();
      return {
        ...a,
        date: cleanDate,
        roleUsed: a.roleUsed || 'GURU_BIDANG_STUDI',
        teacherName: (a.teacherName || '').trim(),
      };
    });
    const atts = this.mergeAttendances(sanitizedAtts, [], delSet);
    setItem(STORAGE_KEYS.ATTENDANCES, atts);

    // 2. Sanitasi Journals: bersihkan spasi, tanggal standar, pastikan teacherRole terdeteksi
    const rawJrns = this.getJournals();
    const sanitizedJrns = rawJrns.map((j) => {
      const dateInfo = normalizeDateString(j.date);
      const cleanDate = dateInfo ? dateInfo.formatted : (j.date || '').split('T')[0].trim();
      let role = j.teacherRole;
      if (!role) {
        if (j.subjectName?.toLowerCase().includes('bantu') || j.materi?.toLowerCase().includes('pendampingan')) {
          role = 'GURU_BANTU';
        } else if (j.subjectName?.toLowerCase().includes('diniyah') || j.materi?.toLowerCase().includes('tahsin') || j.materi?.toLowerCase().includes('tahfidz')) {
          role = 'GURU_DINIYAH';
        } else {
          role = 'GURU_BIDANG_STUDI';
        }
      }
      return {
        ...j,
        date: cleanDate,
        teacherRole: role,
        teacherName: (j.teacherName || '').trim(),
      };
    });
    const jrns = this.mergeJournals(sanitizedJrns, [], delSet);
    setItem(STORAGE_KEYS.JOURNALS, jrns);

    // 3. Sanitasi Assignments
    const asgs = this.mergeAssignments(this.getAssignments(), [], delSet);
    setItem(STORAGE_KEYS.ASSIGNMENTS, asgs);
  },

  // Central Server API synchronization (Upload perubahan dengan batching & debouncing)
  syncToServer(immediate = false) {
    if (serverPushTimeout) {
      clearTimeout(serverPushTimeout);
      serverPushTimeout = null;
    }

    const pushNow = async () => {
      try {
        const payload = {
          deletedIds: this.getDeletedIds(),
          foundation: this.getFoundation(),
          schools: this.getSchools(),
          users: this.getUsers(),
          assignments: this.getAssignments(),
          classes: this.getClasses(),
          subjects: this.getSubjects(),
          journals: this.getJournals(),
          attendances: this.getAttendances(),
          resetRequests: this.getResetRequests(),
          adminChatConfig: this.getAdminChatConfig(),
          broadcastMessage: this.getBroadcastMessage(),
        };
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const rev = res.headers.get('X-Data-Revision');
          if (rev) {
            lastSyncedRevision = rev;
          }
        }
      } catch {
        // Offline fallback
      }
    };

    if (immediate) {
      return pushNow();
    } else {
      serverPushTimeout = setTimeout(pushNow, 400);
    }
  },

  // Sinkronisasi data real-time dari server pusat dengan batching, If-None-Match, dan concurrency control
  async syncFromServer(force = false): Promise<boolean> {
    if (inFlightSyncPromise) {
      return inFlightSyncPromise;
    }

    inFlightSyncPromise = (async () => {
      try {
        const headers: Record<string, string> = {};
        if (!force && lastSyncedRevision) {
          headers['If-None-Match'] = `"${lastSyncedRevision}"`;
        }

        const res = await fetch('/api/data', { headers });
        if (res.status === 304) {
          // Tidak ada perubahan di server
          return false;
        }

        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            if (!force && data._revision && String(data._revision) === String(lastSyncedRevision)) {
              return false;
            }
            if (data._revision) {
              lastSyncedRevision = data._revision;
            }

            let hasChanged = false;

            // 1. Deleted IDs
            if (Array.isArray(data.deletedIds)) {
              const prevDel = this.getDeletedIds();
              const mergedDeleted = new Set([...prevDel, ...data.deletedIds]);
              if (mergedDeleted.size !== prevDel.length) {
                setItem(STORAGE_KEYS.DELETED_IDS, Array.from(mergedDeleted));
                hasChanged = true;
              }
            }
            const delSet = new Set(this.getDeletedIds());

            // 2. Foundation
            if (data.foundation) {
              const cur = this.getFoundation();
              if (JSON.stringify(cur) !== JSON.stringify(data.foundation)) {
                setItem(STORAGE_KEYS.FOUNDATION, data.foundation);
                hasChanged = true;
              }
            }

            // 3. Schools
            if (Array.isArray(data.schools)) {
              const cur = this.getSchools();
              const merged = this.mergeById(cur, data.schools, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.SCHOOLS, merged);
                hasChanged = true;
              }
            }

            // 4. Users (Batch merge efisien O(N))
            if (Array.isArray(data.users)) {
              const currentUsers = this.getUsers().filter((u) => u && u.id && !delSet.has(u.id));
              const serverUsers = data.users.filter((u: any) => u && u.id && !delSet.has(u.id));
              const map = new Map<string, any>();
              currentUsers.forEach((u) => { if (u && u.id) map.set(u.id, u); });
              let usersModified = false;

              serverUsers.forEach((su: any) => {
                if (su && su.id) {
                  const prev = map.get(su.id);
                  if (!prev) {
                    map.set(su.id, su);
                    usersModified = true;
                  } else {
                    let bestLastOnline = prev.lastOnline;
                    if (su.lastOnline) {
                      if (!bestLastOnline || new Date(su.lastOnline).getTime() > new Date(bestLastOnline).getTime()) {
                        bestLastOnline = su.lastOnline;
                      }
                    }
                    if (
                      prev.name !== su.name ||
                      prev.role !== su.role ||
                      prev.statusAktif !== su.statusAktif ||
                      prev.username !== su.username ||
                      prev.schoolId !== su.schoolId ||
                      JSON.stringify(prev.assignedSchoolIds) !== JSON.stringify(su.assignedSchoolIds) ||
                      prev.lastOnline !== bestLastOnline
                    ) {
                      usersModified = true;
                      map.set(su.id, {
                        ...prev,
                        ...su,
                        lastOnline: bestLastOnline,
                      });
                    }
                  }
                }
              });

              if (usersModified || map.size !== currentUsers.length) {
                setItem(STORAGE_KEYS.USERS, Array.from(map.values()));
                hasChanged = true;
              }
            }

            // 5. Assignments
            if (Array.isArray(data.assignments)) {
              const cur = this.getAssignments();
              const merged = this.mergeAssignments(cur, data.assignments, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.ASSIGNMENTS, merged);
                hasChanged = true;
              }
            }

            // 6. Classes
            if (Array.isArray(data.classes)) {
              const cur = this.getClasses();
              const merged = this.mergeById(cur, data.classes, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.CLASSES, merged);
                hasChanged = true;
              }
            }

            // 7. Subjects
            if (Array.isArray(data.subjects)) {
              const cur = this.getSubjects();
              const merged = this.mergeById(cur, data.subjects, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.SUBJECTS, merged);
                hasChanged = true;
              }
            }

            // 8. Journals
            if (Array.isArray(data.journals)) {
              const cur = this.getJournals();
              const merged = this.mergeJournals(cur, data.journals, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.JOURNALS, merged);
                hasChanged = true;
              }
            }

            // 9. Attendances
            if (Array.isArray(data.attendances)) {
              const cur = this.getAttendances();
              const merged = this.mergeAttendances(cur, data.attendances, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.ATTENDANCES, merged);
                hasChanged = true;
              }
            }

            // 10. Reset Requests
            if (Array.isArray(data.resetRequests)) {
              const cur = this.getResetRequests();
              const merged = this.mergeById(cur, data.resetRequests, delSet);
              if (merged.length !== cur.length || JSON.stringify(cur) !== JSON.stringify(merged)) {
                setItem(STORAGE_KEYS.RESET_REQUESTS, merged);
                hasChanged = true;
              }
            }

            // 11. Admin Chat & Broadcast
            if (data.adminChatConfig) {
              const cur = this.getAdminChatConfig();
              if (JSON.stringify(cur) !== JSON.stringify(data.adminChatConfig)) {
                setItem(STORAGE_KEYS.ADMIN_CHAT_CONFIG, data.adminChatConfig);
                hasChanged = true;
              }
            }
            if (data.broadcastMessage) {
              const cur = this.getBroadcastMessage();
              if (JSON.stringify(cur) !== JSON.stringify(data.broadcastMessage)) {
                setItem(STORAGE_KEYS.BROADCAST_MESSAGE, data.broadcastMessage);
                hasChanged = true;
              }
            }

            // Notify listeners ONLY when data actually updated
            if (hasChanged) {
              this.notifyListeners();
            }
            return true;
          }
        }
        return false;
      } catch (err) {
        console.warn('syncFromServer network error:', err);
        return false;
      } finally {
        inFlightSyncPromise = null;
      }
    })();

    return inFlightSyncPromise;
  },

  // Initial loader from server with integrity checks and anti-rancau sanitization
  async init(): Promise<void> {
    this.sanitizeAndDeduplicateAll();
    await this.syncFromServer(true);
  },

  // Foundation
  getFoundation(): FoundationInfo {
    const f = getItem(STORAGE_KEYS.FOUNDATION, DEFAULT_FOUNDATION);
    if (!f.name) {
      const updated = {
        ...f,
        name: 'Yayasan Walisongo Rumbai Jaya',
        logoAppUrl: DEFAULT_APP_LOGO_SVG,
      };
      setItem(STORAGE_KEYS.FOUNDATION, updated);
      return updated;
    }
    return f;
  },

  saveFoundation(info: FoundationInfo) {
    setItem(STORAGE_KEYS.FOUNDATION, info);
    const currentSchools = this.getSchools();
    const updatedSchools = currentSchools.map((s) => ({
      ...s,
      foundationName: info.name,
    }));
    setItem(STORAGE_KEYS.SCHOOLS, updatedSchools);
    this.syncToServer();
    this.notifyListeners();
  },

  // Schools
  getSchools(): School[] {
    return getItem<School[]>(STORAGE_KEYS.SCHOOLS, DEFAULT_SCHOOLS);
  },

  saveSchools(schools: School[]) {
    setItem(STORAGE_KEYS.SCHOOLS, schools);
    this.syncToServer();
    this.notifyListeners();
  },

  getSchoolById(id: string): School | undefined {
    return this.getSchools().find((s) => s.id === id);
  },

  addSchool(school: School) {
    const schools = this.getSchools();
    schools.push(school);
    this.saveSchools(schools);
  },

  updateSchool(school: School) {
    const schools = this.getSchools().map((s) => (s.id === school.id ? school : s));
    this.saveSchools(schools);
  },

  deleteSchool(schoolId: string) {
    this.addDeletedId(schoolId);
    const schools = this.getSchools().filter((s) => s.id !== schoolId);
    setItem(STORAGE_KEYS.SCHOOLS, schools);

    const assignments = this.getAssignments().filter((a) => a.schoolId !== schoolId);
    setItem(STORAGE_KEYS.ASSIGNMENTS, assignments);

    const classes = this.getClasses().filter((c) => c.schoolId !== schoolId);
    setItem(STORAGE_KEYS.CLASSES, classes);

    const subjects = this.getSubjects().filter((sub) => sub.schoolId !== schoolId);
    setItem(STORAGE_KEYS.SUBJECTS, subjects);

    const journals = this.getJournals().filter((j) => j.schoolId !== schoolId);
    setItem(STORAGE_KEYS.JOURNALS, journals);

    const attendances = this.getAttendances().filter((att) => att.schoolId !== schoolId);
    setItem(STORAGE_KEYS.ATTENDANCES, attendances);

    const users = this.getUsers().map((u) => {
      let changed = false;
      let newAssigned = u.assignedSchoolIds;
      let newSchoolId = u.schoolId;
      if (u.assignedSchoolIds?.includes(schoolId)) {
        newAssigned = u.assignedSchoolIds.filter((id) => id !== schoolId);
        changed = true;
      }
      if (u.schoolId === schoolId) {
        newSchoolId = undefined;
        changed = true;
      }
      return changed ? { ...u, schoolId: newSchoolId, assignedSchoolIds: newAssigned } : u;
    });
    setItem(STORAGE_KEYS.USERS, users);

    fetch(`/api/schools/${schoolId}`, { method: 'DELETE' }).catch(() => {});
    this.syncToServer();
    this.notifyListeners();
  },

  // Users & Security
  getUsers(): User[] {
    return getItem<User[]>(STORAGE_KEYS.USERS, DEFAULT_USERS);
  },

  saveUsers(users: User[]) {
    setItem(STORAGE_KEYS.USERS, users);
    this.syncToServer();
    this.notifyListeners();
  },

  getUserById(id: string): User | undefined {
    return this.getUsers().find((u) => u.id === id);
  },

  addUser(user: User) {
    const users = this.getUsers();
    // Asynchronously generate salt and hash for security
    hashPassword(user.password || '123').then(({ hash, salt }) => {
      user.passwordHash = hash;
      user.salt = salt;
      this.updateUser(user);
    });
    users.push(user);
    this.saveUsers(users);
  },

  updateUser(user: User) {
    const users = this.getUsers().map((u) => (u.id === user.id ? user : u));
    this.saveUsers(users);
    const current = this.getCurrentUser();
    if (current && current.id === user.id) {
      this.setCurrentUser(user);
    }
  },

  deleteUser(userId: string) {
    this.addDeletedId(userId);
    const userToDelete = this.getUsers().find((u) => u.id === userId);
    const users = this.getUsers().filter((u) => u.id !== userId);
    setItem(STORAGE_KEYS.USERS, users);

    const assignments = this.getAssignments().filter((a) => a.teacherId !== userId);
    setItem(STORAGE_KEYS.ASSIGNMENTS, assignments);

    const subjects = this.getSubjects().filter((s) => s.teacherId !== userId);
    setItem(STORAGE_KEYS.SUBJECTS, subjects);

    const classes = this.getClasses().map((c) => (c.waliKelasId === userId ? { ...c, waliKelasId: undefined } : c));
    setItem(STORAGE_KEYS.CLASSES, classes);

    const journals = this.getJournals().filter((j) => j.teacherId !== userId);
    setItem(STORAGE_KEYS.JOURNALS, journals);

    const attendances = this.getAttendances().filter((a) => a.teacherId !== userId);
    setItem(STORAGE_KEYS.ATTENDANCES, attendances);

    if (userToDelete) {
      const schools = this.getSchools().map((sch) => {
        let changed = false;
        let newKepsek = sch.kepalaSekolah;
        let newNipKep = sch.nipKepalaSekolah;
        let newWaka = sch.wakaKurikulum;
        let newNipWaka = sch.nipWakaKurikulum;

        if (sch.kepalaSekolah && sch.kepalaSekolah.trim().toLowerCase() === userToDelete.name.trim().toLowerCase()) {
          newKepsek = '';
          newNipKep = '';
          changed = true;
        }
        if (sch.wakaKurikulum && sch.wakaKurikulum.trim().toLowerCase() === userToDelete.name.trim().toLowerCase()) {
          newWaka = '';
          newNipWaka = '';
          changed = true;
        }
        return changed
          ? {
              ...sch,
              kepalaSekolah: newKepsek,
              nipKepalaSekolah: newNipKep,
              wakaKurikulum: newWaka,
              nipWakaKurikulum: newNipWaka,
            }
          : sch;
      });
      setItem(STORAGE_KEYS.SCHOOLS, schools);
    }

    fetch(`/api/users/${userId}`, { method: 'DELETE' }).catch(() => {});
    this.syncToServer();
    this.notifyListeners();
  },

  resetUserPassword(userId: string, newPassword = '123') {
    const users = this.getUsers().map((u) => {
      if (u.id === userId) {
        return {
          ...u,
          password: newPassword,
          passwordHash: undefined,
          salt: undefined,
        };
      }
      return u;
    });
    this.saveUsers(users);
    // Hash in background
    hashPassword(newPassword).then(({ hash, salt }) => {
      const freshUsers = this.getUsers().map((u) => {
        if (u.id === userId) {
          return { ...u, passwordHash: hash, salt };
        }
        return u;
      });
      setItem(STORAGE_KEYS.USERS, freshUsers);
      this.syncToServer();
    });
  },

  updateUserCredentials(
    userId: string,
    newUsername: string,
    newPassword?: string,
    newName?: string,
    newEmail?: string,
    newPhone?: string,
    newPhotoUrl?: string
  ): { success: boolean; message: string; updatedUser?: User } {
    const cleanUsername = newUsername.trim().toLowerCase();
    if (!cleanUsername) {
      return { success: false, message: 'Username tidak boleh kosong.' };
    }

    const allUsers = this.getUsers();
    const existing = allUsers.find((u) => u.username.toLowerCase() === cleanUsername && u.id !== userId);
    if (existing) {
      return { success: false, message: `Username "@${cleanUsername}" sudah digunakan oleh akun lain.` };
    }

    let updatedUser: User | undefined;
    const updatedUsers = allUsers.map((u) => {
      if (u.id === userId) {
        updatedUser = {
          ...u,
          username: cleanUsername,
          ...(newName && newName.trim() ? { name: newName.trim() } : {}),
          ...(newEmail !== undefined ? { email: newEmail.trim() } : {}),
          ...(newPhone !== undefined ? { phone: newPhone.trim() } : {}),
          ...(newPhotoUrl !== undefined ? { photoUrl: newPhotoUrl } : {}),
          ...(newPassword ? { password: newPassword, passwordHash: undefined, salt: undefined } : {}),
        };
        return updatedUser;
      }
      return u;
    });

    if (!updatedUser) {
      return { success: false, message: 'Pengguna tidak ditemukan.' };
    }

    this.saveUsers(updatedUsers);

    if (newPassword) {
      hashPassword(newPassword).then(({ hash, salt }) => {
        const fresh = this.getUsers().map((u) =>
          u.id === userId ? { ...u, passwordHash: hash, salt } : u
        );
        setItem(STORAGE_KEYS.USERS, fresh);
        this.syncToServer();
      });
    }

    const current = this.getCurrentUser();
    if (current && current.id === userId) {
      this.setCurrentUser(updatedUser);
    }

    return { success: true, message: 'Profil dan kredensial akun berhasil diperbarui!', updatedUser };
  },

  // Current User Session
  getCurrentUser(): User | null {
    return getItem(STORAGE_KEYS.CURRENT_USER, null);
  },

  setCurrentUser(user: User | null) {
    setItem(STORAGE_KEYS.CURRENT_USER, user);
  },

  // Assignments
  getAssignments(): TeacherAssignment[] {
    return getItem(STORAGE_KEYS.ASSIGNMENTS, DEFAULT_ASSIGNMENTS);
  },

  saveAssignments(assignments: TeacherAssignment[]) {
    setItem(STORAGE_KEYS.ASSIGNMENTS, assignments);
    this.syncToServer();
    this.notifyListeners();
  },

  getAssignmentsBySchool(schoolId: string): TeacherAssignment[] {
    return this.getAssignments()
      .filter((a) => a.schoolId === schoolId)
      .sort((a, b) => (a.urutan || 99) - (b.urutan || 99));
  },

  saveAssignment(assignment: TeacherAssignment) {
    const all = this.getAssignments();
    const index = all.findIndex(
      (a) => a.teacherId === assignment.teacherId && a.schoolId === assignment.schoolId
    );
    if (index >= 0) {
      all[index] = assignment;
    } else {
      all.push(assignment);
    }
    this.saveAssignments(all);
  },

  deleteAssignment(id: string) {
    this.addDeletedId(id);
    const targetAsg = this.getAssignments().find((a) => a.id === id);
    const all = this.getAssignments().filter((a) => a.id !== id);
    fetch(`/api/assignments/${id}`, { method: 'DELETE' }).catch(() => {});
    this.saveAssignments(all);

    if (targetAsg) {
      const hasOtherInSchool = all.some(
        (a) => a.teacherId === targetAsg.teacherId && a.schoolId === targetAsg.schoolId
      );
      if (!hasOtherInSchool) {
        const users = this.getUsers().map((u) => {
          if (u.id === targetAsg.teacherId && u.assignedSchoolIds?.includes(targetAsg.schoolId)) {
            return {
              ...u,
              assignedSchoolIds: u.assignedSchoolIds.filter((sid) => sid !== targetAsg.schoolId),
            };
          }
          return u;
        });
        setItem(STORAGE_KEYS.USERS, users);
        this.syncToServer();
        this.notifyListeners();
      }
    }
  },

  // Classes
  getClasses(schoolId?: string): SchoolClass[] {
    const list = getItem<SchoolClass[]>(STORAGE_KEYS.CLASSES, DEFAULT_CLASSES);
    if (schoolId) return list.filter((c) => c.schoolId === schoolId);
    return list;
  },

  saveClasses(classes: SchoolClass[]) {
    setItem(STORAGE_KEYS.CLASSES, classes);
    this.syncToServer();
    this.notifyListeners();
  },

  addClass(cls: SchoolClass) {
    const classes = this.getClasses();
    classes.push(cls);
    this.saveClasses(classes);
  },

  updateClass(cls: SchoolClass) {
    const classes = this.getClasses().map((c) => (c.id === cls.id ? cls : c));
    this.saveClasses(classes);
  },

  deleteClass(classId: string) {
    this.addDeletedId(classId);
    const classes = this.getClasses().filter((c) => c.id !== classId);
    setItem(STORAGE_KEYS.CLASSES, classes);

    const assignments = this.getAssignments().map((a) => {
      let changed = false;
      let newAssigned = a.assignedClassIds;
      let newWali = a.waliKelasDiKelasId;
      if (a.assignedClassIds?.includes(classId)) {
        newAssigned = a.assignedClassIds.filter((id) => id !== classId);
        changed = true;
      }
      if (a.waliKelasDiKelasId === classId) {
        newWali = undefined;
        changed = true;
      }
      return changed ? { ...a, assignedClassIds: newAssigned, waliKelasDiKelasId: newWali } : a;
    });
    setItem(STORAGE_KEYS.ASSIGNMENTS, assignments);

    const subjects = this.getSubjects().map((s) => {
      if (s.classIds?.includes(classId)) {
        return { ...s, classIds: s.classIds.filter((id) => id !== classId) };
      }
      return s;
    });
    setItem(STORAGE_KEYS.SUBJECTS, subjects);

    const journals = this.getJournals().filter((j) => j.classId !== classId);
    setItem(STORAGE_KEYS.JOURNALS, journals);

    const attendances = this.getAttendances().filter((a) => a.classId !== classId);
    setItem(STORAGE_KEYS.ATTENDANCES, attendances);

    fetch(`/api/classes/${classId}`, { method: 'DELETE' }).catch(() => {});
    this.syncToServer();
    this.notifyListeners();
  },

  // Subjects
  getSubjects(schoolId?: string, teacherId?: string): Subject[] {
    let list = getItem(STORAGE_KEYS.SUBJECTS, DEFAULT_SUBJECTS);
    if (schoolId) list = list.filter((s) => s.schoolId === schoolId);
    if (teacherId) list = list.filter((s) => s.teacherId === teacherId);
    return list;
  },

  saveSubjects(subjects: Subject[]) {
    setItem(STORAGE_KEYS.SUBJECTS, subjects);
    this.syncToServer();
    this.notifyListeners();
  },

  addSubject(subj: Subject) {
    const subjects = this.getSubjects();
    subjects.push(subj);
    this.saveSubjects(subjects);
  },

  updateSubject(subj: Subject) {
    const subjects = this.getSubjects().map((s) => (s.id === subj.id ? subj : s));
    this.saveSubjects(subjects);
  },

  deleteSubject(id: string) {
    this.addDeletedId(id);
    const subjects = this.getSubjects().filter((s) => s.id !== id);
    setItem(STORAGE_KEYS.SUBJECTS, subjects);
    const journals = this.getJournals().filter((j) => j.subjectId !== id);
    setItem(STORAGE_KEYS.JOURNALS, journals);
    fetch(`/api/subjects/${id}`, { method: 'DELETE' }).catch(() => {});
    this.syncToServer();
    this.notifyListeners();
  },

  // Journals (PER-KELAS)
  getJournals(filters?: { schoolId?: string; classId?: string; date?: string; teacherId?: string }): ClassJournalEntry[] {
    let list = getItem(STORAGE_KEYS.JOURNALS, DEFAULT_JOURNALS);
    if (filters?.schoolId) list = list.filter((j) => j.schoolId === filters.schoolId);
    if (filters?.classId) list = list.filter((j) => j.classId === filters.classId);
    if (filters?.date) {
      const targetNorm = (filters.date || '').split('T')[0].trim();
      list = list.filter((j) => (j.date || '').split('T')[0].trim() === targetNorm);
    }
    if (filters?.teacherId) list = list.filter((j) => j.teacherId === filters.teacherId);
    return list;
  },

  saveJournals(journals: ClassJournalEntry[]) {
    setItem(STORAGE_KEYS.JOURNALS, journals);
    this.syncToServer();
    this.notifyListeners();
  },

  addJournal(journal: ClassJournalEntry) {
    const cur = this.getJournals();
    const merged = this.mergeJournals(cur, [journal]);
    this.saveJournals(merged);
    this.syncToServer(true);

    // Kirim langsung ke endpoint server khusus jurnal agar langsung masuk ke database pusat
    fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journal),
    }).catch(() => {});
  },

  deleteJournal(id: string) {
    this.addDeletedId(id);
    const journals = getItem(STORAGE_KEYS.JOURNALS, DEFAULT_JOURNALS).filter((j) => j.id !== id);
    fetch(`/api/journals/${id}`, { method: 'DELETE' }).catch(() => {});
    this.saveJournals(journals);
    this.syncToServer(true);
  },

  // Attendances (PER-KELAS UNTUK KBM/GURU, PER-SEKOLAH UNTUK KOKURIKULER & EKSKUL)
  getAttendances(filters?: {
    schoolId?: string;
    classId?: string;
    date?: string;
    teacherId?: string;
    roleUsed?: string;
  }): TeacherAttendanceEntry[] {
    let list = getItem(STORAGE_KEYS.ATTENDANCES, DEFAULT_ATTENDANCES);
    if (filters?.schoolId) list = list.filter((a) => a.schoolId === filters.schoolId);
    if (filters?.classId) list = list.filter((a) => a.classId === filters.classId);
    if (filters?.date) {
      const targetNorm = (filters.date || '').split('T')[0].trim();
      list = list.filter((a) => (a.date || '').split('T')[0].trim() === targetNorm);
    }
    if (filters?.teacherId) list = list.filter((a) => a.teacherId === filters.teacherId);
    if (filters?.roleUsed) list = list.filter((a) => a.roleUsed === filters.roleUsed);
    return list;
  },

  saveAttendances(attendances: TeacherAttendanceEntry[]) {
    setItem(STORAGE_KEYS.ATTENDANCES, attendances);
    this.syncToServer();
    this.notifyListeners();
  },

  addAttendance(attendance: TeacherAttendanceEntry) {
    const cur = this.getAttendances();
    const merged = this.mergeAttendances(cur, [attendance]);
    this.saveAttendances(merged);
    this.syncToServer(true);

    // Kirim langsung ke endpoint server khusus presensi agar langsung masuk ke database pusat
    fetch('/api/attendances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendance),
    }).catch(() => {});
  },

  deleteAttendance(id: string) {
    this.addDeletedId(id);
    const list = getItem(STORAGE_KEYS.ATTENDANCES, DEFAULT_ATTENDANCES).filter((a) => a.id !== id);
    fetch(`/api/attendances/${id}`, { method: 'DELETE' }).catch(() => {});
    this.saveAttendances(list);
    this.syncToServer(true);
  },

  // Password Reset Requests
  getResetRequests(): PasswordResetRequest[] {
    return getItem(STORAGE_KEYS.RESET_REQUESTS, []);
  },

  saveResetRequests(requests: PasswordResetRequest[]) {
    setItem(STORAGE_KEYS.RESET_REQUESTS, requests);
    this.syncToServer();
    this.notifyListeners();
  },

  addResetRequest(request: PasswordResetRequest) {
    const all = this.getResetRequests();
    all.unshift(request);
    this.saveResetRequests(all);
  },

  resolveResetRequest(requestId: string, newPassword = '123'): boolean {
    const all = this.getResetRequests();
    const reqIndex = all.findIndex((r) => r.id === requestId);
    if (reqIndex < 0) return false;
    const req = all[reqIndex];
    const allUsers = this.getUsers();
    const targetUser = allUsers.find(
      (u) => (req.userId && u.id === req.userId) || u.username.toLowerCase() === req.username.toLowerCase()
    );
    if (targetUser) {
      this.resetUserPassword(targetUser.id, newPassword);
    }
    all[reqIndex] = {
      ...req,
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
    };
    this.saveResetRequests(all);
    return true;
  },

  rejectResetRequest(requestId: string): boolean {
    const all = this.getResetRequests();
    const reqIndex = all.findIndex((r) => r.id === requestId);
    if (reqIndex < 0) return false;
    all[reqIndex] = {
      ...all[reqIndex],
      status: 'REJECTED',
      resolvedAt: new Date().toISOString(),
    };
    this.saveResetRequests(all);
    return true;
  },

  deleteResetRequest(requestId: string) {
    this.addDeletedId(requestId);
    const all = this.getResetRequests().filter((r) => r.id !== requestId);
    fetch(`/api/reset-requests/${requestId}`, { method: 'DELETE' }).catch(() => {});
    this.saveResetRequests(all);
  },

  // Admin WhatsApp Chat Settings
  getAdminChatConfig(): AdminChatConfig {
    return getItem(STORAGE_KEYS.ADMIN_CHAT_CONFIG, DEFAULT_ADMIN_CHAT_CONFIG);
  },

  saveAdminChatConfig(config: AdminChatConfig) {
    setItem(STORAGE_KEYS.ADMIN_CHAT_CONFIG, config);
    this.syncToServer();
    this.notifyListeners();
  },

  // Broadcast & Account Suspension Manual Message
  getBroadcastMessage(): BroadcastMessage {
    return getItem(STORAGE_KEYS.BROADCAST_MESSAGE, DEFAULT_BROADCAST_MESSAGE);
  },

  saveBroadcastMessage(msg: BroadcastMessage) {
    setItem(STORAGE_KEYS.BROADCAST_MESSAGE, {
      ...msg,
      updatedAt: new Date().toISOString(),
    });
    this.syncToServer();
    this.notifyListeners();
  },

  // Record user online heartbeat (Lokal & Server)
  recordUserOnline(userId: string) {
    if (!userId) return;
    const nowIso = new Date().toISOString();
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) {
      users[idx] = {
        ...users[idx],
        lastOnline: nowIso,
      };
      memoryCache[STORAGE_KEYS.USERS] = users;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
      } catch {}
    }

    // Kirim heartbeat ke server pusat secara realtime
    fetch('/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, timestamp: nowIso }),
    }).catch(() => {});
  },

  // Mengambil daftar status live online dari server pusat
  async fetchOnlineUsers(): Promise<Array<{ id: string; name: string; username: string; role: string; lastOnline?: string; isOnline: boolean }>> {
    try {
      const res = await fetch('/api/users/online');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.users)) {
          // Sinkronkan juga lastOnline ke data users lokal secara tenang
          const localUsers = this.getUsers();
          let changed = false;
          data.users.forEach((remoteUser: any) => {
            const u = localUsers.find((l) => l.id === remoteUser.id);
            if (u && remoteUser.lastOnline && u.lastOnline !== remoteUser.lastOnline) {
              u.lastOnline = remoteUser.lastOnline;
              changed = true;
            }
          });
          if (changed) {
            memoryCache[STORAGE_KEYS.USERS] = localUsers;
            try {
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(localUsers));
              }
            } catch {}
          }
          return data.users;
        }
      }
    } catch {
      // offline fallback
    }
    return [];
  },

  // Toggle user active / disabled status
  toggleUserStatus(userId: string, newStatus?: 'AKTIF' | 'NONAKTIF', pesanKhusus?: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx < 0) return false;
    const currentStatus = users[idx].statusAktif || 'AKTIF';
    const targetStatus = newStatus || (currentStatus === 'AKTIF' ? 'NONAKTIF' : 'AKTIF');
    users[idx] = {
      ...users[idx],
      statusAktif: targetStatus,
      pesanKhusus: pesanKhusus !== undefined ? pesanKhusus : users[idx].pesanKhusus,
    };
    this.saveUsers(users);
    return true;
  },

  // Encrypted System Backup Export
  async exportEncryptedBackup(passphrase?: string): Promise<{ data: string; filename: string }> {
    const rawData = this.exportAllData();
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    
    // Encrypt using strong AES-256-GCM
    const encryptedString = await encryptData(rawData, passphrase);
    const checksum = await computeChecksum(rawData);
    
    const exportEnvelope = {
      format: 'ASISTENGURU_ENCRYPTED_BACKUP',
      version: '3.0.0',
      exportedAt: now.toISOString(),
      checksum,
      payload: encryptedString,
    };

    return {
      data: JSON.stringify(exportEnvelope, null, 2),
      filename: `Backup_AsistenGuru_Encrypted_${dateStr}_${timeStr}.enc.json`,
    };
  },

  // Restore from either Encrypted Backup or Plain JSON Backup
  async restoreEncryptedBackup(fileContent: string, passphrase?: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(fileContent);
      let targetData: any;

      if (parsed.format === 'ASISTENGURU_ENCRYPTED_BACKUP' && parsed.payload) {
        // Decrypt AES payload
        targetData = await decryptData(parsed.payload, passphrase);
        // Verify checksum if present
        if (parsed.checksum) {
          const check = await computeChecksum(targetData);
          if (check !== parsed.checksum) {
            console.warn('Integrity checksum mismatch on restored backup');
          }
        }
      } else {
        // Plain JSON backup
        targetData = parsed;
      }

      return this.restoreBackupData(targetData);
    } catch (err: any) {
      console.error('Failed to parse or decrypt backup file:', err);
      return { success: false, message: `Gagal memulihkan cadangan: ${err.message || 'Format tidak sesuai'}` };
    }
  },

  // Standard JSON Data Export
  exportAllData(): Record<string, any> {
    return {
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      foundation: this.getFoundation(),
      schools: this.getSchools(),
      users: this.getUsers(),
      assignments: this.getAssignments(),
      classes: this.getClasses(),
      subjects: this.getSubjects(),
      journals: this.getJournals(),
      attendances: this.getAttendances(),
      resetRequests: this.getResetRequests(),
      adminChatConfig: this.getAdminChatConfig(),
      broadcastMessage: this.getBroadcastMessage(),
    };
  },

  // Restore backup data into storage
  restoreBackupData(backupData: any): { success: boolean; message: string } {
    if (!backupData || typeof backupData !== 'object') {
      return { success: false, message: 'Format file cadangan tidak valid.' };
    }
    try {
      if (backupData.foundation) {
        setItem(STORAGE_KEYS.FOUNDATION, backupData.foundation);
      }
      if (Array.isArray(backupData.schools)) {
        setItem(STORAGE_KEYS.SCHOOLS, backupData.schools);
      }
      if (Array.isArray(backupData.users)) {
        setItem(STORAGE_KEYS.USERS, backupData.users);
      }
      if (Array.isArray(backupData.assignments)) {
        setItem(STORAGE_KEYS.ASSIGNMENTS, backupData.assignments);
      }
      if (Array.isArray(backupData.classes)) {
        setItem(STORAGE_KEYS.CLASSES, backupData.classes);
      }
      if (Array.isArray(backupData.subjects)) {
        setItem(STORAGE_KEYS.SUBJECTS, backupData.subjects);
      }
      if (Array.isArray(backupData.journals)) {
        setItem(STORAGE_KEYS.JOURNALS, backupData.journals);
      }
      if (Array.isArray(backupData.attendances)) {
        setItem(STORAGE_KEYS.ATTENDANCES, backupData.attendances);
      }
      if (Array.isArray(backupData.resetRequests)) {
        setItem(STORAGE_KEYS.RESET_REQUESTS, backupData.resetRequests);
      }
      if (backupData.adminChatConfig) {
        setItem(STORAGE_KEYS.ADMIN_CHAT_CONFIG, backupData.adminChatConfig);
      }
      if (backupData.broadcastMessage) {
        setItem(STORAGE_KEYS.BROADCAST_MESSAGE, backupData.broadcastMessage);
      }

      fetch('/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupData),
      }).catch(() => {});

      this.syncToServer();
      this.notifyListeners();
      return { success: true, message: 'Data cadangan berhasil dipulihkan secara penuh dan aman!' };
    } catch (err: any) {
      console.error('Failed to restore backup:', err);
      return { success: false, message: `Gagal memulihkan data: ${err?.message || 'Terjadi kesalahan sistem'}` };
    }
  },
};
