import { Router } from 'express'
import { db, idx, nextId, save } from '../db.js'
import * as U from '../util.js'
import { FOOD, PICKUP_TIMES } from '../catalog.js'
import { upload, saveUploaded, removeFile, discardUpload } from '../upload.js'
import { academics, attendanceFor, classWeek, fileInfo, logActivity, notify, orderStep, ORDER_STEPS, publicUser, staffFor, submissionOf } from '../logic.js'

export const router = Router()
const { HttpError } = U

const assignmentView = (a, studentId) => {
  const s = submissionOf(a.id, studentId), overdue = !s && a.due < U.todayISO()
  return {
    id: a.id, title: a.title, description: a.description, due: a.due, maxMarks: a.maxMarks, subjectId: a.subjectId, subject: U.subjectById(a.subjectId).name,
    status: s ? (s.reviewed ? 'Reviewed' : 'Submitted') : 'Pending', overdue,
    submission: s ? { submittedAt: s.submittedAt, late: s.late, file: s.fileId ? fileInfo(s.fileId) : null, reviewed: s.reviewed, marks: s.marks, feedback: s.feedback } : null,
  }
}
const myAssignments = u => db.assignments.filter(a => a.classKeys.includes(u.classKey)).map(a => assignmentView(a, u.id)).sort((x, y) => x.due.localeCompare(y.due))

router.get('/dashboard', (req, res) => {
  const u = req.user, ac = academics(u.id), att = attendanceFor(u.id), day = U.dayIdx(new Date())
  const notes = db.notifications.filter(n => n.userId === u.id)
  res.json({
    profile: publicUser(u),
    attendance: att.overall, cgpa: ac.cgpa, creditsEarned: u.yi * 2 * 21 + ac.passed, totalCredits: 160, semester: `Semester ${u.yi * 2 + 2}`,
    today: day > 5 ? [] : classWeek(u.classKey)[day], dayName: day > 5 ? 'Sunday' : U.DAYS[day],
    pendingAssignments: myAssignments(u).filter(a => a.status === 'Pending').slice(0, 3),
    notifications: { unread: notes.filter(n => !n.read).length, latest: notes.sort((a, b) => b.id - a.id).slice(0, 3) },
    activity: db.activity.filter(a => a.userId === u.id).sort((a, b) => b.id - a.id).slice(0, 5),
  })
})

router.get('/timetable', (req, res) => res.json({ classKey: req.user.classKey, days: U.DAYS, periods: U.DAY_PERIODS, week: classWeek(req.user.classKey) }))
router.get('/attendance', (req, res) => res.json(attendanceFor(req.user.id)))

router.get('/academics', (req, res) => {
  const u = req.user, { rows, cgpa, passed } = academics(u.id), avg = k => Math.round(rows.reduce((t, r) => t + r[k], 0) / rows.length)
  res.json({
    cgpa, band: U.BANDS[U.bandOf(cgpa)].label, creditsEarned: u.yi * 2 * 21 + passed, totalCredits: 160, semester: `Semester ${u.yi * 2 + 2}`, subjects: rows,
    trend: [{ l: 'IA 1', v: Math.round((avg('ia1') / 50) * 100) }, { l: 'IA 2', v: Math.round((avg('ia2') / 50) * 100) }, { l: 'Overall', v: avg('marks') }],
  })
})

// ---- assignments ----
router.get('/assignments', (req, res) => res.json({ assignments: myAssignments(req.user) }))
router.post('/assignments/:id/submit', upload.single('file'), (req, res) => {
  try {
    const u = req.user, a = db.assignments.find(x => x.id === +req.params.id)
    if (!a || !a.classKeys.includes(u.classKey)) throw new HttpError(404, 'Assignment not found')
    if (!req.file) throw new HttpError(400, 'Choose a file to submit')
    let s = submissionOf(a.id, u.id)
    if (s?.reviewed) throw new HttpError(409, 'This was already reviewed, so it cannot be submitted again')
    const f = saveUploaded(req.file, u.id), late = U.todayISO() > a.due
    if (s) { if (s.fileId) removeFile(s.fileId); Object.assign(s, { fileId: f.id, fileName: f.originalName, submittedAt: new Date().toISOString(), late }) }
    else { s = { id: nextId('submissions'), assignmentId: a.id, studentId: u.id, fileId: f.id, fileName: f.originalName, submittedAt: new Date().toISOString(), late, reviewed: false, marks: null, feedback: '' }; db.submissions.push(s) }
    notify([a.createdBy], 'assignment', `${u.name} (${u.roll}) submitted "${a.title}"${late ? ' late' : ''}`)
    notify([u.id], 'assignment', `"${a.title}" submitted`)
    logActivity(u.id, `Submitted ${a.title}`); save()
    res.json({ assignment: assignmentView(a, u.id) })
  } catch (e) { discardUpload(req.file); throw e }
})

// ---- question bank (only the band that matches this student's CGPA) and notes ----
router.get('/question-bank', (req, res) => {
  const u = req.user, cgpa = academics(u.id).cgpa, band = U.bandOf(cgpa)
  const items = db.questionBank.filter(q => q.classKeys.includes(u.classKey) && q.band === band).sort((a, b) => b.id - a.id)
    .map(q => ({ id: q.id, title: q.title, unit: q.unit, subjectId: q.subjectId, subject: U.subjectById(q.subjectId).name, file: fileInfo(q.fileId), uploadedBy: idx.users.get(q.uploadedBy)?.name, createdAt: q.createdAt }))
  res.json({ cgpa, band: { index: band, label: U.BANDS[band].label, level: U.BANDS[band].level }, items })
})
router.get('/notes', (req, res) => res.json({ items: db.notes.filter(n => n.classKeys.includes(req.user.classKey)).sort((a, b) => b.id - a.id)
  .map(n => ({ id: n.id, title: n.title, kind: n.kind, unit: n.unit, subjectId: n.subjectId, subject: U.subjectById(n.subjectId).name, file: fileInfo(n.fileId), uploadedBy: idx.users.get(n.uploadedBy)?.name, createdAt: n.createdAt })) }))

// ---- food orders ----
const orderView = o => ({ ...o, step: orderStep(o), status: ORDER_STEPS[orderStep(o)] })
router.post('/orders', (req, res) => {
  const u = req.user, raw = req.body?.items, pickup = req.body?.pickup
  if (!Array.isArray(raw) || !raw.length || raw.length > 30) throw new HttpError(400, 'Add at least one item to the cart')
  if (!PICKUP_TIMES.includes(pickup)) throw new HttpError(400, `Pickup time must be one of ${PICKUP_TIMES.join(', ')}`)
  const qty = new Map()
  for (const r of raw) { const id = U.int(r?.itemId, 'Item', 1, 9999), q = U.int(r?.qty, 'Quantity', 1, 20); if (!FOOD.some(f => f.id === id)) throw new HttpError(400, `Item ${id} is not on the menu`); qty.set(id, (qty.get(id) || 0) + q) }
  const items = [...qty].map(([id, q]) => { const f = FOOD.find(x => x.id === id); return { itemId: id, name: f.name, shop: f.shop, price: f.price, qty: q } })
  const o = { id: 1040 + nextId('orders'), studentId: u.id, items, total: items.reduce((t, i) => t + i.price * i.qty, 0), pickup, createdAt: new Date().toISOString(), readyNotified: false }
  db.orders.push(o)
  notify([u.id], 'food', `Order #${o.id} placed. Pickup at ${pickup}`); logActivity(u.id, `Ordered food (#${o.id}, Rs ${o.total})`); save()
  res.status(201).json({ order: orderView(o) })
})
router.get('/orders', (req, res) => {
  const mine = db.orders.filter(o => o.studentId === req.user.id).sort((a, b) => b.id - a.id)
  for (const o of mine) if (orderStep(o) >= 2 && !o.readyNotified) { o.readyNotified = true; notify([req.user.id], 'food', `Your order #${o.id} is ready for pickup`); save() }
  res.json({ orders: mine.map(orderView) })
})

// ---- events ----
router.post('/events/:id/register', (req, res) => {
  const e = db.events.find(x => x.id === +req.params.id)
  if (!e) throw new HttpError(404, 'Event not found')
  if (db.registrations.some(r => r.eventId === e.id && r.studentId === req.user.id)) throw new HttpError(409, 'You are already registered')
  db.registrations.push({ eventId: e.id, studentId: req.user.id, createdAt: new Date().toISOString() })
  notify([req.user.id], 'event', `You are registered for ${e.title} on ${e.date}`); logActivity(req.user.id, `Registered for ${e.title}`); save()
  res.json({ ok: true })
})
router.delete('/events/:id/register', (req, res) => {
  const n = db.registrations.length
  db.registrations = db.registrations.filter(r => !(r.eventId === +req.params.id && r.studentId === req.user.id))
  if (db.registrations.length === n) throw new HttpError(404, 'You were not registered')
  save(); res.json({ ok: true })
})
