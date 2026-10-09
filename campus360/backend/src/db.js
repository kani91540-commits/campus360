// Tiny database: everything lives in memory and is saved to data/db.json after each change.
// No native modules, so it installs the same way on Windows, Mac and Linux.
import fs from 'node:fs'
import path from 'node:path'

const FILE = process.env.DB_FILE || path.join(process.env.DATA_DIR || path.resolve('data'), 'db.json')
export let db = null
export const idx = { users: new Map(), byEmail: new Map(), byClass: new Map(), staffBy: new Map(), att: new Map(), marks: new Map(), files: new Map() }

export function buildIndex() {
  Object.values(idx).forEach(m => m.clear())
  for (const u of db.users) {
    idx.users.set(u.id, u); idx.byEmail.set(u.email, u)
    if (u.role === 'student') { if (!idx.byClass.has(u.classKey)) idx.byClass.set(u.classKey, []); idx.byClass.get(u.classKey).push(u) }
    else idx.staffBy.set(`${u.dept}|${u.teaching.yi}|${u.teaching.subjectId}`, u)
  }
  db.attendance.forEach(a => idx.att.set(`${a.studentId}:${a.subjectId}`, a))
  db.marks.forEach(m => idx.marks.set(`${m.studentId}:${m.subjectId}`, m))
  db.files.forEach(f => idx.files.set(f.id, f))
}

function writeNow() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db))
  try { fs.renameSync(tmp, FILE) } catch { fs.copyFileSync(tmp, FILE); fs.rmSync(tmp, { force: true }) }
}
export function load(seedFn) {
  if (fs.existsSync(FILE)) db = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  else { db = seedFn(); writeNow() }
  buildIndex()
}
let timer = null
export const save = () => { clearTimeout(timer); timer = setTimeout(() => { timer = null; writeNow() }, 200) }
export const flush = () => { if (timer) { clearTimeout(timer); timer = null; writeNow() } }
export const nextId = c => (db.seq[c] = (db.seq[c] || 0) + 1)
