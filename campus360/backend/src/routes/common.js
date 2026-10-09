// Routes any logged-in user can use: notifications, labs, menu, transport, campus, events, file download.
import { Router } from 'express'
import { db, idx, save } from '../db.js'
import * as U from '../util.js'
import { LAB_ROOMS, labsOfClass, sessionsAt } from '../labs.js'
import { SHOPS, FOOD, PICKUP_TIMES, TRANSPORT, LOCATIONS } from '../catalog.js'
import { academics, submissionOf } from '../logic.js'
import { HttpError } from '../util.js'

export const router = Router()

// ---- notifications ----
router.get('/notifications', (req, res) => {
  const mine = db.notifications.filter(n => n.userId === req.user.id).sort((a, b) => b.id - a.id)
  const type = req.query.type
  res.json({ unread: mine.filter(n => !n.read).length, items: (type ? mine.filter(n => n.type === type) : mine).slice(0, 100) })
})
router.post('/notifications/read-all', (req, res) => { db.notifications.forEach(n => { if (n.userId === req.user.id) n.read = true }); save(); res.json({ ok: true }) })
router.post('/notifications/:id/read', (req, res) => {
  const n = db.notifications.find(x => x.id === +req.params.id && x.userId === req.user.id)
  if (!n) throw new HttpError(404, 'Notification not found')
  n.read = true; save(); res.json({ ok: true })
})

// ---- labs ----
router.get('/labs', (_req, res) => res.json({ labs: LAB_ROOMS, blocks: U.BLOCKS.map((_, b) => ({ block: b, label: U.blockLabel(b), time: U.blockTime(b) })) }))
router.get('/labs/availability', (req, res) => {
  const lab = String(req.query.lab || ''), date = String(req.query.date || '')
  if (!LAB_ROOMS.includes(lab)) throw new HttpError(400, 'Unknown lab')
  if (!U.isISO(date)) throw new HttpError(400, 'Date must look like 2026-10-12')
  const day = U.dayOfISO(date)
  res.json({ lab, date, closed: day > 5, blocks: U.BLOCKS.map((_, b) => {
    const base = { block: b, label: U.blockLabel(b), time: U.blockTime(b) }
    if (day > 5) return { ...base, status: 'closed' }
    const cls = sessionsAt(lab, day, b)[0]
    if (cls) return { ...base, status: 'class', detail: `${cls.classKey} · ${cls.sub}` }
    const bk = db.labBookings.find(x => x.lab === lab && x.date === date && x.block === b)
    if (bk) return { ...base, status: 'booked', detail: `${idx.users.get(bk.staffId)?.name || 'Staff'} · ${bk.purpose}` }
    return { ...base, status: 'free' }
  }) })
})
// A class's fixed weekly lab sessions. Students get their own class unless they ask for another.
router.get('/labs/class-timetable', (req, res) => {
  let key = req.query.classKey
  if (!key) { if (req.user.role !== 'student') throw new HttpError(400, 'classKey is required'); key = req.user.classKey }
  if (!U.parseClassKey(key)) throw new HttpError(400, 'classKey must look like "1st Year CSE-A"')
  res.json({ classKey: key, sessions: labsOfClass(key).map(s => ({ day: s.day, dayName: U.DAYS[s.day], block: s.block, label: U.blockLabel(s.block), time: U.blockTime(s.block), periods: U.BLOCKS[s.block], lab: s.lab, subject: s.sub })) })
})

// ---- static lists ----
router.get('/food/menu', (_req, res) => res.json({ shops: SHOPS, items: FOOD, pickupTimes: PICKUP_TIMES }))
router.get('/transport', (_req, res) => res.json({ routes: TRANSPORT }))
router.get('/campus/locations', (_req, res) => res.json({ locations: LOCATIONS }))

// ---- events ----
router.get('/events', (req, res) => {
  const mine = new Set(db.registrations.filter(r => r.studentId === req.user.id).map(r => r.eventId))
  res.json({ events: db.events.slice().sort((a, b) => a.date.localeCompare(b.date)).map(e => ({ ...e, registered: mine.has(e.id), registrations: db.registrations.filter(r => r.eventId === e.id).length })) })
})

// ---- file download, with access rules ----
router.get('/files/:id', (req, res) => {
  const f = idx.files.get(+req.params.id)
  if (!f) throw new HttpError(404, 'File not found')
  if (!canOpen(req.user, f.id)) throw new HttpError(403, 'You cannot open this file')
  res.download(f.path, f.originalName)
})
function canOpen(u, fileId) {
  const sub = db.submissions.find(s => s.fileId === fileId)
  if (sub) {
    const a = db.assignments.find(x => x.id === sub.assignmentId)
    return u.role === 'student' ? sub.studentId === u.id : a?.createdBy === u.id
  }
  const q = db.questionBank.find(x => x.fileId === fileId)
  if (q) {
    if (u.role === 'staff') return q.uploadedBy === u.id
    return q.classKeys.includes(u.classKey) && q.band === U.bandOf(academics(u.id).cgpa)
  }
  const n = db.notes.find(x => x.fileId === fileId)
  if (n) return u.role === 'staff' ? n.uploadedBy === u.id : n.classKeys.includes(u.classKey)
  return false
}
