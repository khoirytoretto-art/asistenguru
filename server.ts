import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'app-data.json');

// Canonical Foundation Seed Data
const INITIAL_DATA = {
  foundation: {
    name: 'Yayasan Walisongo Rumbai Jaya',
    tagline: 'Mencerdaskan Generasi Berakhlak Qurani, Mandiri, dan Unggul',
    ketuaYayasan: 'Drs. H. M. Rasyid Al-Banjari, M.Si',
    alamat: 'Jl. Rumbai No. 45, Kompleks Pendidikan Yayasan Walisongo, Riau',
    telepon: '(0761) 883921 / 0811-7000-111',
    email: 'pphmrumbaijaya@gmail.com',
    logoYayasanUrl: '',
    logoAppUrl: '',
    kutipanLucu: 'Mendidik itu seni menahan tawa saat murid salah jawab dengan ekspresi paling serius, dan seni tersenyum saat akhir bulan saldo tetap syahdu!',
    kutipanAuthor: 'Pengurus Yayasan Pusat',
  },
  schools: [],
  users: [
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
  ],
  classes: [],
  subjects: [],
  assignments: [],
  journals: [],
  attendances: [],
  resetRequests: [],
  adminChatConfig: {
    whatsappNumber: '08117000111',
    chatPromptText: 'Ada kendala atau perlu konsultasi teknis? Hubungi admin yayasan untuk bantuan sistem.',
    waTemplateMessage: 'Halo Admin Yayasan, saya memerlukan bantuan teknis aplikasi AsistenGuru.',
  },
  broadcastMessage: {
    judulPesan: 'Pemberitahuan Resmi Dari Admin Pusat Yayasan',
    pesanPusat: 'Mohon maaf, akun Anda sedang dinonaktifkan sementara oleh Admin Pusat Yayasan. Untuk konfirmasi atau pertanyaan lebih lanjut, silakan hubungi admin yayasan melalui WhatsApp.',
    updatedAt: new Date().toISOString(),
  },
};

const PURGED_DUMMY_IDS = new Set([
  'school-paud',
  'school-1791651063697',
  'school-1791651125928',
  'school-1791651181721',
  'school-sd',
  'school-smp',
  'school-tk',
  'class-sd-1a',
  'class-sd-1b',
  'class-sd-2a',
  'class-sd-3a',
  'class-smp-7a',
  'class-smp-8a',
  'class-tk-a',
  'class-tk-b',
  'class-paud-1',
  'user-admin-diniyah',
  'att-koku-1791647273261',
  'att-1',
  'jnl-1',
  'jnl-2',
]);

const BACKUP_FILE = path.resolve(DATA_DIR, 'app-data.backup.json');

// Ensure data folder and file exists with data sanitization
function loadStoredData() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);

      const baseFoundation = { ...INITIAL_DATA.foundation, ...(parsed.foundation || {}) };
      if (!baseFoundation.name || baseFoundation.name.includes('Al-Hidayah')) {
        baseFoundation.name = INITIAL_DATA.foundation.name;
        baseFoundation.email = INITIAL_DATA.foundation.email;
      }

      const deletedIds = new Set<string>(Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []);

      const savedSchools: any[] = (Array.isArray(parsed.schools) ? parsed.schools : [...INITIAL_DATA.schools])
        .filter((s: any) => s && s.id && !PURGED_DUMMY_IDS.has(s.id) && !deletedIds.has(s.id));

      const sanitizedSchools = savedSchools.map((s) => ({
        ...s,
        foundationName: baseFoundation.name,
      }));

      const savedUsers: any[] = (Array.isArray(parsed.users) ? parsed.users : [...INITIAL_DATA.users])
        .filter((u: any) => u && u.id && !PURGED_DUMMY_IDS.has(u.id) && !deletedIds.has(u.id));

      const validSchoolIds = new Set(sanitizedSchools.map((s) => s.id));

      const savedClasses: any[] = (Array.isArray(parsed.classes) ? parsed.classes : [...INITIAL_DATA.classes])
        .filter((c: any) => c && c.id && !PURGED_DUMMY_IDS.has(c.id) && !deletedIds.has(c.id) && validSchoolIds.has(c.schoolId));

      const savedSubjects: any[] = (Array.isArray(parsed.subjects) ? parsed.subjects : [...INITIAL_DATA.subjects])
        .filter((s: any) => s && s.id && !PURGED_DUMMY_IDS.has(s.id) && !deletedIds.has(s.id) && validSchoolIds.has(s.schoolId));

      const savedAssignments: any[] = (Array.isArray(parsed.assignments) ? parsed.assignments : [...INITIAL_DATA.assignments])
        .filter((a: any) => a && a.id && !PURGED_DUMMY_IDS.has(a.id) && !deletedIds.has(a.id) && validSchoolIds.has(a.schoolId));

      const savedJournals: any[] = (Array.isArray(parsed.journals) ? parsed.journals : [])
        .filter((j: any) => j && j.id && !PURGED_DUMMY_IDS.has(j.id) && !deletedIds.has(j.id) && validSchoolIds.has(j.schoolId));

      const savedAttendances: any[] = (Array.isArray(parsed.attendances) ? parsed.attendances : [])
        .filter((a: any) => a && a.id && !PURGED_DUMMY_IDS.has(a.id) && !deletedIds.has(a.id) && validSchoolIds.has(a.schoolId));

      const mergedData = {
        ...INITIAL_DATA,
        ...parsed,
        deletedIds: Array.from(deletedIds),
        foundation: baseFoundation,
        schools: sanitizedSchools,
        users: savedUsers,
        classes: savedClasses,
        subjects: savedSubjects,
        assignments: savedAssignments,
        journals: savedJournals,
        attendances: savedAttendances,
        resetRequests: Array.isArray(parsed.resetRequests) ? parsed.resetRequests : [],
      };

      fs.writeFileSync(DATA_FILE, JSON.stringify(mergedData, null, 2), 'utf-8');
      return mergedData;
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
      return { ...INITIAL_DATA, deletedIds: [] };
    }
  } catch (err) {
    console.error('Error reading data file, using default data:', err);
    return { ...INITIAL_DATA, deletedIds: [] };
  }
}

let dataRevision = Date.now();
let lastModifiedTime = Date.now();

function touchDataRevision() {
  dataRevision = Date.now();
  lastModifiedTime = Date.now();
}

function saveStoredData(data: any, updateRevision = true) {
  if (updateRevision) {
    touchDataRevision();
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    // Write primary file
    fs.writeFileSync(DATA_FILE, serialized, 'utf-8');
    // Maintain secondary persistent safety backup
    fs.writeFileSync(BACKUP_FILE, serialized, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing data file:', err);
    return false;
  }
}

let saveTimeout: any = null;
function saveStoredDataDebounced(updateRevision = false) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveStoredData(appData, updateRevision);
  }, 500);
}

// Smart collection merger by ID so concurrent users NEVER lose data, while respecting tombstones & purged items
function mergeCollection<T extends { id?: string }>(existingList: T[] = [], incomingList: T[] = [], deletedSet?: Set<string>): T[] {
  const map = new Map<string, T>();
  (existingList || []).forEach((item) => {
    if (item && item.id && !PURGED_DUMMY_IDS.has(item.id) && (!deletedSet || !deletedSet.has(item.id))) {
      map.set(item.id, item);
    }
  });
  (incomingList || []).forEach((item) => {
    if (item && item.id && !PURGED_DUMMY_IDS.has(item.id) && (!deletedSet || !deletedSet.has(item.id))) {
      const prev = map.get(item.id);
      map.set(item.id, prev ? { ...prev, ...item } : item);
    }
  });
  return Array.from(map.values());
}

// Smart merger khusus data Users (menjaga lastOnline terbaru dan status aktif, menghormati ID terhapus)
function mergeUsers(existingList: any[] = [], incomingList: any[] = [], deletedSet?: Set<string>): any[] {
  const map = new Map<string, any>();
  (existingList || []).forEach((u) => {
    if (u && u.id && !PURGED_DUMMY_IDS.has(u.id) && (!deletedSet || !deletedSet.has(u.id))) {
      map.set(u.id, u);
    }
  });

  (incomingList || []).forEach((u) => {
    if (u && u.id && !PURGED_DUMMY_IDS.has(u.id) && (!deletedSet || !deletedSet.has(u.id))) {
      const prev = map.get(u.id);
      if (!prev) {
        map.set(u.id, u);
      } else {
        // Ambil waktu lastOnline yang paling baru
        let bestLastOnline = prev.lastOnline;
        if (u.lastOnline) {
          if (!bestLastOnline || new Date(u.lastOnline).getTime() > new Date(bestLastOnline).getTime()) {
            bestLastOnline = u.lastOnline;
          }
        }
        map.set(u.id, {
          ...prev,
          ...u,
          lastOnline: bestLastOnline,
          password: u.password || prev.password,
          passwordHash: u.passwordHash || prev.passwordHash,
          salt: u.salt || prev.salt,
        });
      }
    }
  });
  return Array.from(map.values());
}

let appData = loadStoredData();
// In-memory heartbeat tracker untuk status live online realtime
const activeUserHeartbeats = new Map<string, number>();

async function startServer() {
  const app = express();

  // Middleware for JSON parsing with ample size for logos & avatars
  app.use(express.json({ limit: '35mb' }));
  app.use(express.urlencoded({ extended: true, limit: '35mb' }));

  // Security Headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // --- API ROUTES ---
  // 1. Get entire unified single foundation data (Optimized with ETag / 304 Not Modified)
  app.get('/api/data', (req, res) => {
    const clientEtag = req.headers['if-none-match'];
    const currentEtag = `"${dataRevision}"`;
    if (clientEtag && clientEtag === currentEtag) {
      return res.status(304).end();
    }
    res.setHeader('ETag', currentEtag);
    res.setHeader('X-Data-Revision', String(dataRevision));
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    res.json({
      ...appData,
      _revision: dataRevision,
      _lastModified: lastModifiedTime,
    });
  });

  // 1b. Lightweight version check endpoint
  app.get('/api/data/version', (_req, res) => {
    res.json({
      revision: dataRevision,
      lastModified: lastModifiedTime,
      totalUsers: appData.users?.length || 0,
      totalSchools: appData.schools?.length || 0,
      totalJournals: appData.journals?.length || 0,
      totalAttendances: appData.attendances?.length || 0,
    });
  });

  // 2. Smart Sync dataset (menggabungkan data, menghormati data terhapus)
  app.post('/api/data', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      const body = req.body;
      const currentDeleted = new Set<string>([
        ...PURGED_DUMMY_IDS,
        ...(appData.deletedIds || []),
        ...(Array.isArray(body.deletedIds) ? body.deletedIds : []),
      ]);
      appData.deletedIds = Array.from(currentDeleted);

      appData = {
        ...appData,
        deletedIds: Array.from(currentDeleted),
        foundation: { ...appData.foundation, ...(body.foundation || {}) },
        schools: Array.isArray(body.schools) ? mergeCollection(appData.schools, body.schools, currentDeleted) : appData.schools,
        users: Array.isArray(body.users) ? mergeUsers(appData.users, body.users, currentDeleted) : appData.users,
        classes: Array.isArray(body.classes) ? mergeCollection(appData.classes, body.classes, currentDeleted) : appData.classes,
        subjects: Array.isArray(body.subjects) ? mergeCollection(appData.subjects, body.subjects, currentDeleted) : appData.subjects,
        assignments: Array.isArray(body.assignments) ? mergeCollection(appData.assignments, body.assignments, currentDeleted) : appData.assignments,
        journals: Array.isArray(body.journals) ? mergeCollection(appData.journals, body.journals, currentDeleted) : appData.journals,
        attendances: Array.isArray(body.attendances) ? mergeCollection(appData.attendances, body.attendances, currentDeleted) : appData.attendances,
        resetRequests: Array.isArray(body.resetRequests) ? mergeCollection(appData.resetRequests, body.resetRequests, currentDeleted) : appData.resetRequests,
        adminChatConfig: body.adminChatConfig || appData.adminChatConfig,
        broadcastMessage: body.broadcastMessage || appData.broadcastMessage,
      };
      saveStoredData(appData, true);
      res.setHeader('X-Data-Revision', String(dataRevision));
      return res.json({ success: true, revision: dataRevision, message: 'Data berhasil disinkronkan & digabungkan ke server pusat' });
    }
    res.status(400).json({ success: false, message: 'Data tidak valid' });
  });

  // 2a. Endpoint khusus simpan jurnal langsung (instan & terjamin aman)
  app.post('/api/journals', (req, res) => {
    const incoming = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
    if (incoming.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data jurnal' });

    appData.journals = mergeCollection(appData.journals || [], incoming);
    saveStoredData(appData, true);
    return res.json({ success: true, count: appData.journals.length, message: 'Jurnal berhasil disimpan permanen di server pusat' });
  });

  app.get('/api/journals', (_req, res) => {
    res.json(appData.journals || []);
  });

  // 2b. Endpoint khusus simpan presensi langsung (instan & terjamin aman)
  app.post('/api/attendances', (req, res) => {
    const incoming = Array.isArray(req.body) ? req.body : (req.body ? [req.body] : []);
    if (incoming.length === 0) return res.status(400).json({ success: false, message: 'Tidak ada data presensi' });

    appData.attendances = mergeCollection(appData.attendances || [], incoming);
    saveStoredData(appData, true);
    return res.json({ success: true, count: appData.attendances.length, message: 'Presensi berhasil disimpan permanen di server pusat' });
  });

  app.get('/api/attendances', (_req, res) => {
    res.json(appData.attendances || []);
  });

  // 2c. Endpoint Heartbeat Online Realtime
  app.post('/api/heartbeat', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, message: 'User ID diperlukan' });

    const now = new Date();
    activeUserHeartbeats.set(userId, now.getTime());

    if (Array.isArray(appData.users)) {
      const user = appData.users.find((u: any) => u.id === userId);
      if (user) {
        user.lastOnline = now.toISOString();
      }
    }
    saveStoredDataDebounced(false);
    return res.json({ success: true, userId, lastOnline: now.toISOString() });
  });

  // 2d. Status Live Online Pengguna
  app.get('/api/users/online', (_req, res) => {
    const now = Date.now();
    const activeIds: string[] = [];
    activeUserHeartbeats.forEach((timestamp, uid) => {
      // Dianggap online jika mengirim heartbeat dalam 3 menit terakhir (180,000 ms)
      if (now - timestamp < 180000) {
        activeIds.push(uid);
      }
    });

    const onlineStatuses = (appData.users || []).map((u: any) => {
      const lastActiveTime = activeUserHeartbeats.get(u.id);
      const isOnline = lastActiveTime
        ? (now - lastActiveTime < 180000)
        : (u.lastOnline ? (now - new Date(u.lastOnline).getTime() < 180000) : false);

      return {
        id: u.id,
        name: u.name,
        username: u.username,
        role: u.role,
        lastOnline: lastActiveTime ? new Date(lastActiveTime).toISOString() : u.lastOnline,
        isOnline,
      };
    });

    return res.json({ success: true, users: onlineStatuses, activeCount: activeIds.length });
  });

  // 2e. Full restore backup
  app.post('/api/backup/restore', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      appData = {
        ...INITIAL_DATA,
        ...req.body,
      };
      saveStoredData(appData);
      return res.json({ success: true, message: 'Data cadangan berhasil dipulihkan di server pusat' });
    }
    res.status(400).json({ success: false, message: 'Data cadangan tidak valid' });
  });

  // 3. Foundation specific routes
  app.get('/api/foundation', (_req, res) => {
    res.json(appData.foundation);
  });

  app.put('/api/foundation', (req, res) => {
    if (req.body && typeof req.body === 'object') {
      appData.foundation = { ...appData.foundation, ...req.body };
      if (appData.foundation.name && Array.isArray(appData.schools)) {
        appData.schools = appData.schools.map((s: any) => ({
          ...s,
          foundationName: appData.foundation.name,
        }));
      }
      saveStoredData(appData);
      return res.json({ success: true, foundation: appData.foundation });
    }
    res.status(400).json({ success: false, message: 'Data profil yayasan tidak valid' });
  });

  // 4. Schools routes
  app.get('/api/schools', (_req, res) => {
    res.json(appData.schools);
  });

  app.put('/api/schools', (req, res) => {
    if (Array.isArray(req.body)) {
      appData.schools = req.body;
      saveStoredData(appData);
      return res.json({ success: true, schools: appData.schools });
    }
    res.status(400).json({ success: false, message: 'Data sekolah harus berupa array' });
  });

  app.delete('/api/schools/:id', (req, res) => {
    const schoolId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), schoolId]));
    appData.schools = (appData.schools || []).filter((s: any) => s.id !== schoolId);
    appData.assignments = (appData.assignments || []).filter((a: any) => a.schoolId !== schoolId);
    appData.classes = (appData.classes || []).filter((c: any) => c.schoolId !== schoolId);
    appData.subjects = (appData.subjects || []).filter((sub: any) => sub.schoolId !== schoolId);
    appData.journals = (appData.journals || []).filter((j: any) => j.schoolId !== schoolId);
    appData.attendances = (appData.attendances || []).filter((att: any) => att.schoolId !== schoolId);
    appData.users = (appData.users || []).map((u: any) => ({
      ...u,
      assignedSchoolIds: (u.assignedSchoolIds || []).filter((id: string) => id !== schoolId),
      schoolId: u.schoolId === schoolId ? undefined : u.schoolId,
    }));
    saveStoredData(appData);
    return res.json({ success: true, message: `Sekolah ${schoolId} berhasil dihapus permanen` });
  });

  // 5. Users routes
  app.get('/api/users', (_req, res) => {
    res.json(appData.users);
  });

  app.put('/api/users', (req, res) => {
    if (Array.isArray(req.body)) {
      appData.users = req.body;
      saveStoredData(appData);
      return res.json({ success: true, users: appData.users });
    }
    res.status(400).json({ success: false, message: 'Data pengguna harus berupa array' });
  });

  app.delete('/api/users/:id', (req, res) => {
    const userId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), userId]));
    appData.users = (appData.users || []).filter((u: any) => u.id !== userId);
    appData.assignments = (appData.assignments || []).filter((a: any) => a.teacherId !== userId);
    appData.subjects = (appData.subjects || []).filter((s: any) => s.teacherId !== userId);
    appData.journals = (appData.journals || []).filter((j: any) => j.teacherId !== userId);
    appData.attendances = (appData.attendances || []).filter((a: any) => a.teacherId !== userId);
    appData.classes = (appData.classes || []).map((c: any) => c.waliKelasId === userId ? { ...c, waliKelasId: undefined } : c);
    saveStoredData(appData);
    return res.json({ success: true, message: `Pengguna ${userId} berhasil dihapus permanen` });
  });

  // 5b. Classes, Subjects, Assignments, Journals, Attendances delete routes
  app.delete('/api/classes/:id', (req, res) => {
    const classId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), classId]));
    appData.classes = (appData.classes || []).filter((c: any) => c.id !== classId);
    appData.journals = (appData.journals || []).filter((j: any) => j.classId !== classId);
    appData.attendances = (appData.attendances || []).filter((a: any) => a.classId !== classId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Kelas ${classId} berhasil dihapus` });
  });

  app.delete('/api/subjects/:id', (req, res) => {
    const subjId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), subjId]));
    appData.subjects = (appData.subjects || []).filter((s: any) => s.id !== subjId);
    appData.journals = (appData.journals || []).filter((j: any) => j.subjectId !== subjId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Mapel ${subjId} berhasil dihapus` });
  });

  app.delete('/api/assignments/:id', (req, res) => {
    const asgId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), asgId]));
    appData.assignments = (appData.assignments || []).filter((a: any) => a.id !== asgId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Penugasan ${asgId} berhasil dihapus` });
  });

  app.delete('/api/journals/:id', (req, res) => {
    const jId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), jId]));
    appData.journals = (appData.journals || []).filter((j: any) => j.id !== jId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Jurnal ${jId} berhasil dihapus` });
  });

  app.delete('/api/attendances/:id', (req, res) => {
    const attId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), attId]));
    appData.attendances = (appData.attendances || []).filter((a: any) => a.id !== attId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Presensi ${attId} berhasil dihapus` });
  });

  // 6. Reset password request routes
  app.get('/api/reset-requests', (_req, res) => {
    res.json(appData.resetRequests || []);
  });

  app.post('/api/reset-requests', (req, res) => {
    if (req.body && req.body.username) {
      if (!Array.isArray(appData.resetRequests)) {
        appData.resetRequests = [];
      }
      const newReq = {
        id: req.body.id || `req-reset-${Date.now()}`,
        ...req.body,
        createdAt: req.body.createdAt || new Date().toISOString(),
      };
      appData.resetRequests.unshift(newReq);
      saveStoredData(appData);
      return res.json({ success: true, request: newReq });
    }
    res.status(400).json({ success: false, message: 'Data permohonan reset tidak valid' });
  });

  app.delete('/api/reset-requests/:id', (req, res) => {
    const reqId = req.params.id;
    appData.deletedIds = Array.from(new Set([...(appData.deletedIds || []), reqId]));
    appData.resetRequests = (appData.resetRequests || []).filter((r: any) => r.id !== reqId);
    saveStoredData(appData);
    return res.json({ success: true, message: `Permohonan reset ${reqId} berhasil dihapus` });
  });

  // 7. Reset server database to initial state
  app.post('/api/reset-database', (_req, res) => {
    appData = JSON.parse(JSON.stringify(INITIAL_DATA));
    saveStoredData(appData);
    res.json({ success: true, message: 'Database yayasan berhasil direset ke standar awal' });
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[AsistenGuru Server] Server berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[AsistenGuru Server] Fatal error starting server:', err);
  process.exit(1);
});
