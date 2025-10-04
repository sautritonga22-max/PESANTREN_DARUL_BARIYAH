
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const multer = require('multer');
const session = require('express-session');
const Database = require('better-sqlite3');
const cors = require('cors');

const PORT = process.env.PORT || 5000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'darulbariyah_secret', resave: false, saveUninitialized: true }));

// serve public static files
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ensure uploads folder
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// multer setup for uploads (images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) { const unique = Date.now() + '-' + file.originalname.replace(/\s+/g,'_'); cb(null, unique); }
});
const upload = multer({ storage });

// SQLite DB (better-sqlite3)
const dbFile = path.join(__dirname, 'database.db');
const db = new Database(dbFile);

// initialize tables
db.exec(`
CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  json TEXT
);
CREATE TABLE IF NOT EXISTS berita (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  body TEXT,
  date TEXT,
  image TEXT
);
CREATE TABLE IF NOT EXISTS edukasi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  body TEXT
);
CREATE TABLE IF NOT EXISTS pendaftaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT,
  ttl TEXT,
  alamat TEXT,
  asal TEXT,
  ortu TEXT,
  telp TEXT,
  created_at TEXT
);
`);

// helper to get/set content by key
function getContent(key, fallback) {
  const row = db.prepare('SELECT json FROM content WHERE key = ?').get(key);
  if (row && row.json) return JSON.parse(row.json);
  if (fallback !== undefined) return fallback;
  return null;
}
function setContent(key, obj) {
  const js = JSON.stringify(obj);
  const exists = db.prepare('SELECT 1 FROM content WHERE key = ?').get(key);
  if (exists) db.prepare('UPDATE content SET json = ? WHERE key = ?').run(js, key);
  else db.prepare('INSERT INTO content (key, json) VALUES (?, ?)').run(key, js);
}

// seed default content if empty
if (!getContent('site')) {
  setContent('site', {"name": "Pesantren Modern Darul Bariyah", "address": "Riau, Kabupaten Tanah Putih Tanjung Melawan, Sukajadi, Melayu Tengah", "email": "darulbariyah@gmail.com", "phone": "088745362625"});
}
if (!getContent('home')) {
  setContent('home', {"intro": "Jihad ilmu, santri membawa Indonesia emas.", "short": "Memadukan iman, ilmu, dan amal."});
}
if (!getContent('tentang')) {
  setContent('tentang', {"sejarah": "Pesantren Modern Darul Bariyah berdiri untuk memadukan tradisi keislaman dan ilmu pengetahuan modern.", "visi": "Mengintegrasikan agama dan sains, melahirkan ulama intelek.", "misi": ["Menanamkan nilai-nilai Islam", "Meningkatkan mutu pembelajaran berbasis teknologi"]});
}
if (!getContent('program')) {
  setContent('program', {"jenjang": ["MTs", "MA", "Program Takhasus"], "kurikulum": "Kurikulum agama + umum", "ekstrakurikuler": ["Sepakbola", "Koding", "Klub Bahasa"]});
}

// ----- AUTH -----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || { };
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

app.post('/api/logout', (req, res) => { req.session.destroy(()=>res.json({ok:true})); });

function requireAuth(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ ok: false, error: 'Not authenticated' });
}

// ----- CONTENT API -----
app.get('/api/site', (req, res) => res.json(getContent('site')));
app.post('/api/site', requireAuth, (req, res) => { setContent('site', req.body); res.json({ ok:true }); });

app.get('/api/home', (req, res) => res.json(getContent('home')));
app.post('/api/home', requireAuth, (req, res) => { setContent('home', req.body); res.json({ ok:true }); });

app.get('/api/tentang', (req, res) => res.json(getContent('tentang')));
app.post('/api/tentang', requireAuth, (req, res) => { setContent('tentang', req.body); res.json({ ok:true }); });

app.get('/api/program', (req, res) => res.json(getContent('program')));
app.post('/api/program', requireAuth, (req, res) => { setContent('program', req.body); res.json({ ok:true }); });

// ----- BERITA CRUD -----
app.get('/api/berita', (req, res) => { const rows = db.prepare('SELECT * FROM berita ORDER BY id DESC').all(); res.json(rows); });
app.post('/api/berita', requireAuth, upload.single('image'), (req, res) => {
  const { title, body } = req.body;
  const date = new Date().toISOString().slice(0,10);
  const image = req.file ? ('/uploads/' + req.file.filename) : null;
  const info = db.prepare('INSERT INTO berita (title, body, date, image) VALUES (?,?,?,?)').run(title, body, date, image);
  res.json({ ok:true, id: info.lastInsertRowid });
});
app.put('/api/berita/:id', requireAuth, upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const { title, body } = req.body;
  const image = req.file ? ('/uploads/' + req.file.filename) : null;
  if (image) db.prepare('UPDATE berita SET title=?, body=?, image=? WHERE id=?').run(title, body, image, id);
  else db.prepare('UPDATE berita SET title=?, body=? WHERE id=?').run(title, body, id);
  res.json({ ok:true });
});
app.delete('/api/berita/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM berita WHERE id=?').run(id);
  res.json({ ok:true });
});

// ----- EDUKASI CRUD -----
app.get('/api/edukasi', (req, res) => { const rows = db.prepare('SELECT * FROM edukasi ORDER BY id DESC').all(); res.json(rows); });
app.post('/api/edukasi', requireAuth, (req, res) => { const { title, body } = req.body; const info = db.prepare('INSERT INTO edukasi (title, body) VALUES (?,?)').run(title, body); res.json({ ok:true, id: info.lastInsertRowid }); });
app.put('/api/edukasi/:id', requireAuth, (req, res) => { const id = Number(req.params.id); const { title, body } = req.body; db.prepare('UPDATE edukasi SET title=?, body=? WHERE id=?').run(title, body, id); res.json({ ok:true }); });
app.delete('/api/edukasi/:id', requireAuth, (req, res) => { const id = Number(req.params.id); db.prepare('DELETE FROM edukasi WHERE id=?').run(id); res.json({ ok:true }); });

// ----- PENDAFTARAN -----
app.post('/api/pendaftaran', upload.none(), (req, res) => {
  const { nama, ttl, alamat, asal, ortu, telp } = req.body;
  const created_at = new Date().toISOString();
  const info = db.prepare('INSERT INTO pendaftaran (nama, ttl, alamat, asal, ortu, telp, created_at) VALUES (?,?,?,?,?,?,?)').run(nama, ttl, alamat, asal, ortu, telp, created_at);
  res.json({ ok:true, id: info.lastInsertRowid });
});
app.get('/api/pendaftaran', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM pendaftaran ORDER BY id DESC').all();
  res.json(rows);
});
app.delete('/api/pendaftaran/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM pendaftaran WHERE id=?').run(id);
  res.json({ ok:true });
});

// fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not Found');
});

app.listen(PORT, () => console.log('Server started on port', PORT));
