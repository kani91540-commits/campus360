import { Router } from 'express'
import { db, idx, nextId, save } from '../db.js'
import * as U from '../util.js'
import { LAB_ROOMS, sessionsAt } from '../labs.js'
import { upload, saveUploaded, removeFile, discardUpload } from '../upload.js'
import { academics, attendanceFor, fileInfo, logActivity, markCalc, notify, ownClass, pctOf, publicUser, scheduleCell, staffClasses, staffWeek } from '../logic.js'

export const router = Router()
const { HttpError } = U
const me = req => req.user
const subjectOf = st => U.subjectById(st.teaching.subjectId)
const classKeyOf = (req, key) => { if (!ownClass(req.user, key)) throw new HttpError(403, 'You do not teach this class'); return key }
const roster = key => idx.byClass.get(key) || []
const myAssignments = st => db.assignments.filter(a => a.createdBy === st.id)

// ---- dashboard, timetable, classes ----
router.get('/dashboard', (req, res) => {
  const st = me(req), day = U.dayIdx(new Date()), today = U.todayISO()
  const mine = new Set(myAssignments(st).map(a => a.id))
  res.json({
    profile: publicUser(st), subject: subjectOf(st).name, classes: staffClasses(st),
    todayClasses: day > 5 ? [] : staffWeek(st)[day].filter(x => !x.free), dayName: day > 5 ? 'Sunday' : U.DAYS[day],
    labBookings: db.labBookings.filter(b => b.staffId === st.id && b.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
      .map(b => ({ ...b, label: U.blockLabel(b.block), time: U.blockTime(b.block) })),
    pendingSubmissions: db.submissions.filter(s => mine.has(s.assignmentId) && !s.reviewed).length,
    activity: db.activity.filter(a => a.userId === st.id).sort((a, b) => b.id - a.id).slice(0, 5),
    notifications: { unread: db.notifications.filter(n => n.userId === st.id && !n.read).length },
  })
})
router.get('/timetable', (req, res) => res.json({ days: U.DAYS, periods: U.DAY_PERIODS, week: staffWeek(me(req)) }))
router.get('/classes', (req, res) => res.json({ subject: subjectOf(me(req)).name, classes: staffClasses(me(req)).map(k => ({ classKey: k, students: roster(k).length })) }))
router.get('/students', (req, res) => {
  const key = classKeyOf(req, req.query.classKey), sid = me(req).teaching.subjectId
  res.json({ classKey: key, students: roster(key).map(s => ({ id: s.id, name: s.name, roll: s.roll, email: s.email, cgpa: academics(s.id).cgpa, attendance: pctOf(idx.att.get(`${s.id}:${sid}`)) })) })
})

// ---- attendance: only for periods that are really on this staff member's timetable ----
router.get('/attendance/slots', (req, res) => {
  const date = String(req.query.date || U.todayISO())
  if (!U.isISO(date)) throw new HttpError(400, 'Date must look like 2026-10-12')
  const day = U.dayOfISO(date)
  res.json({ date, slots: day > 5 ? [] : staffWeek(me(req))[day].filter(x => !x.free).map(x => ({ period: x.n, time: x.t, classKey: x.classKey, subject: x.subject, marked: !!findLog(date, x.n, x.classKey) })) })
})
const findLog = (date, period, key) => db.attendanceLog.find(l => l.date === date && l.period === period && l.classKey === key)
function checkSlot(req, date, period, key) {
  if (!U.isISO(date)) throw new HttpError(400, 'Date must look like 2026-10-12')
  if (date > U.todayISO()) throw new HttpError(400, 'You cannot mark attendance for a future date')
  classKeyOf(req, key); period = U.int(period, 'Period', 1, 7)
  const day = U.dayOfISO(date), c = day > 5 ? null : scheduleCell(key, day, period)
  if (!c || c.kind !== 'class' || c.subjectId !== me(req).teaching.subjectId) throw new HttpError(409, `You have no ${key} class in period ${period} on ${date}`)
  return period
}
router.get('/attendance/session', (req, res) => {
  const date = String(req.query.date || ''), key = String(req.query.classKey || ''), period = checkSlot(req, date, req.query.period, key), log = findLog(date, period, key), absent = new Set(log?.absentIds || [])
  res.json({ date, period, classKey: key, marked: !!log, students: roster(key).map(s => ({ id: s.id, name: s.name, roll: s.roll, status: absent.has(s.id) ? 'A' : 'P' })) })
})
router.post('/attendance', (req, res) => {
  const st = me(req), { date, classKey: key } = req.body || {}, period = checkSlot(req, date, req.body?.period, key), sid = st.teaching.subjectId
  const students = roster(key), ids = new Set(students.map(s => s.id)), absentIds = Array.isArray(req.body.absentIds) ? [...new Set(req.body.absentIds.map(Number))] : null
  if (!absentIds || absentIds.some(i => !ids.has(i))) throw new HttpError(400, 'absentIds must be a list of students in this class')
  const prev = findLog(date, period, key), prevAbsent = new Set(prev?.absentIds || []), absent = new Set(absentIds), dropped = []
  for (const s of students) {
    const a = idx.att.get(`${s.id}:${sid}`), before = pctOf(a)
    if (prev) { a.total -= 1; if (!prevAbsent.has(s.id)) a.present -= 1 } // undo the earlier marking first
    a.total += 1; if (!absent.has(s.id)) a.present += 1
    if (before >= 75 && pctOf(a) < 75) dropped.push(s)
  }
  const log = { id: prev?.id || nextId('attendanceLog'), date, period, classKey: key, subjectId: sid, absentIds, total: students.length, by: st.id, createdAt: new Date().toISOString() }
  if (prev) Object.assign(prev, log); else db.attendanceLog.push(log)
  for (const s of dropped) notify([s.id], 'attendance', `${subjectOf(st).name} attendance is ${pctOf(idx.att.get(`${s.id}:${sid}`))}%. Minimum is 75%`)
  logActivity(st.id, `Marked attendance: ${key}, period ${period} (${students.length - absentIds.length}/${students.length} present)`); save()
  res.json({ ok: true, present: students.length - absentIds.length, absent: absentIds.length, updated: !!prev, belowMinimum: dropped.length })
})

// ---- marks ----
const marksRow = (s, subj) => ({ studentId: s.id, name: s.name, roll: s.roll, ...markCalc(idx.marks.get(`${s.id}:${subj.id}`), subj) })
router.get('/marks', (req, res) => { const key = classKeyOf(req, req.query.classKey), subj = subjectOf(me(req)); res.json({ classKey: key, subject: subj.name, hasLab: subj.lab, students: roster(key).map(s => marksRow(s, subj)) }) })
router.put('/marks', (req, res) => {
  const st = me(req), subj = subjectOf(st), key = classKeyOf(req, req.body?.classKey), entries = req.body?.entries
  if (!Array.isArray(entries) || !entries.length) throw new HttpError(400, 'entries must be a list')
  const ids = new Set(roster(key).map(s => s.id)), limits = { ia1: 50, ia2: 50, lab: subj.lab ? 25 : 0, asg: 25 }, changes = []
  for (const e of entries) {                               // validate everything first, so a bad row changes nothing
    if (!ids.has(Number(e?.studentId))) throw new HttpError(400, `Student ${e?.studentId} is not in ${key}`)
    const patch = {}
    for (const f of Object.keys(limits)) if (e[f] !== undefined) patch[f] = U.int(e[f], f, 0, limits[f])
    changes.push([Number(e.studentId), patch])
  }
  for (const [sid, patch] of changes) {
    const before = academics(sid).cgpa; Object.assign(idx.marks.get(`${sid}:${subj.id}`), patch)
    const after = academics(sid).cgpa
    notify([sid], 'assignment', `Your ${subj.name} marks were updated${after !== before ? `. CGPA is now ${after.toFixed(1)}` : ''}`)
  }
  logActivity(st.id, `Entered marks for ${key} (${changes.length} students)`); save()
  res.json({ ok: true, students: roster(key).map(s => marksRow(s, subj)) })
})

// ---- assignments and submissions ----
const countFor = a => { const subs = db.submissions.filter(s => s.assignmentId === a.id); return { total: a.classKeys.reduce((t, k) => t + roster(k).length, 0), submitted: subs.length, reviewed: subs.filter(s => s.reviewed).length } }
router.get('/assignments', (req, res) => res.json({ assignments: myAssignments(me(req)).sort((a, b) => b.id - a.id).map(a => ({ ...a, subject: U.subjectById(a.subjectId).name, ...countFor(a) })) }))
router.post('/assignments', (req, res) => {
  const st = me(req), b = req.body || {}, title = U.str(b.title, 'Title', { max: 120 }), description = U.str(b.description, 'Description', { max: 1000, optional: true })
  if (!U.isISO(b.due)) throw new HttpError(400, 'Due date must look like 2026-10-12')
  if (b.due < U.todayISO()) throw new HttpError(400, 'Due date cannot be in the past')
  const keys = Array.isArray(b.classKeys) && b.classKeys.length ? [...new Set(b.classKeys)].map(k => classKeyOf(req, k)) : staffClasses(st)
  const a = { id: nextId('assignments'), subjectId: st.teaching.subjectId, classKeys: keys, title, description, due: b.due, maxMarks: b.maxMarks === undefined ? 25 : U.int(b.maxMarks, 'Maximum marks', 1, 100), createdBy: st.id, createdAt: new Date().toISOString() }
  db.assignments.push(a)
  notify(keys.flatMap(k => roster(k).map(s => s.id)), 'assignment', `New ${subjectOf(st).name} assignment: ${title} (due ${a.due})`)
  logActivity(st.id, `Created assignment: ${title}`); save()
  res.status(201).json({ assignment: { ...a, subject: subjectOf(st).name, ...countFor(a) } })
})
router.delete('/assignments/:id', (req, res) => {
  const a = myAssignments(me(req)).find(x => x.id === +req.params.id)
  if (!a) throw new HttpError(404, 'Assignment not found')
  db.submissions.filter(s => s.assignmentId === a.id && s.fileId).forEach(s => removeFile(s.fileId))
  db.submissions = db.submissions.filter(s => s.assignmentId !== a.id); db.assignments = db.assignments.filter(x => x.id !== a.id); save()
  res.json({ ok: true })
})
router.get('/submissions', (req, res) => {
  const mine = myAssignments(me(req)), want = req.query.assignmentId ? +req.query.assignmentId : null
  if (want && !mine.some(a => a.id === want)) throw new HttpError(404, 'Assignment not found')
  const ids = new Set(want ? [want] : mine.map(a => a.id)), status = req.query.status
  const rows = db.submissions.filter(s => ids.has(s.assignmentId) && (!status || (status === 'pending' ? !s.reviewed : s.reviewed)))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 300)
  res.json({ submissions: rows.map(s => { const a = mine.find(x => x.id === s.assignmentId), stu = idx.users.get(s.studentId)
    return { id: s.id, assignmentId: a.id, assignment: a.title, maxMarks: a.maxMarks, student: { id: stu.id, name: stu.name, roll: stu.roll, classKey: stu.classKey }, submittedAt: s.submittedAt, late: s.late, file: s.fileId ? fileInfo(s.fileId) : null, reviewed: s.reviewed, marks: s.marks, feedback: s.feedback } }) })
})
router.patch('/submissions/:id', (req, res) => {
  const s = db.submissions.find(x => x.id === +req.params.id), a = s && myAssignments(me(req)).find(x => x.id === s.assignmentId)
  if (!s || !a) throw new HttpError(404, 'Submission not found')
  const b = req.body || {}
  if (b.marks !== undefined && b.marks !== null) s.marks = U.int(b.marks, 'Marks', 0, a.maxMarks)
  if (b.feedback !== undefined) s.feedback = U.str(b.feedback, 'Feedback', { max: 500, optional: true })
  s.reviewed = b.reviewed === undefined ? true : !!b.reviewed
  if (s.reviewed) notify([s.studentId], 'assignment', `"${a.title}" was reviewed${s.marks !== null ? `: ${s.marks}/${a.maxMarks}` : ''}`)
  save(); res.json({ ok: true, submission: { id: s.id, reviewed: s.reviewed, marks: s.marks, feedback: s.feedback } })
})

// ---- notes / syllabus and question bank (files) ----
function fileForm(req, kind) {
  const st = me(req), b = req.body || {}, title = U.str(b.title, 'Title', { max: 120, optional: true }), unit = U.str(b.unit, 'Unit', { max: 20, optional: true }) || 'All units'
  if (!req.file) throw new HttpError(400, 'Choose a file to upload')
  const f = saveUploaded(req.file, st.id)
  return { id: nextId(kind), subjectId: st.teaching.subjectId, classKeys: staffClasses(st), title: title || f.originalName, unit, fileId: f.id, uploadedBy: st.id, createdAt: new Date().toISOString() }
}
const mineView = r => ({ ...r, subject: U.subjectById(r.subjectId).name, file: fileInfo(r.fileId) })
router.get('/notes', (req, res) => res.json({ items: db.notes.filter(n => n.uploadedBy === me(req).id).sort((a, b) => b.id - a.id).map(mineView) }))
router.post('/notes', upload.single('file'), (req, res) => {
  try {
    const kind = req.body?.kind === 'syllabus' ? 'syllabus' : 'notes', row = { ...fileForm(req, 'notes'), kind }
    db.notes.push(row); notify(staffClasses(me(req)).flatMap(k => roster(k).map(s => s.id)), 'assignment', `New ${kind} for ${subjectOf(me(req)).name}: ${row.title}`)
    logActivity(me(req).id, `Uploaded ${kind}: ${row.title}`); save(); res.status(201).json({ item: mineView(row) })
  } catch (e) { discardUpload(req.file); throw e }
})
router.delete('/notes/:id', (req, res) => {
  const n = db.notes.find(x => x.id === +req.params.id && x.uploadedBy === me(req).id)
  if (!n) throw new HttpError(404, 'Not found')
  removeFile(n.fileId); db.notes = db.notes.filter(x => x !== n); save(); res.json({ ok: true })
})

// The CGPA report: students grouped into 5 bands, with ideas and the files already uploaded for each band.
router.get('/question-bank/report', (req, res) => {
  const st = me(req), which = String(req.query.classKey || 'all'), keys = which === 'all' ? staffClasses(st) : [classKeyOf(req, which)]
  const students = keys.flatMap(roster).map(s => ({ id: s.id, name: s.name, roll: s.roll, classKey: s.classKey, cgpa: academics(s.id).cgpa }))
  const bands = U.BANDS.map(b => {
    const list = students.filter(s => U.bandOf(s.cgpa) === b.index).sort((x, y) => x.cgpa - y.cgpa)
    return { ...b, count: list.length, percent: students.length ? Math.round((list.length / students.length) * 100) : 0,
      students: list.map(s => (b.index === 0 ? { ...s, sgpaNeeded: U.sgpaNeeded(s.cgpa, st.teaching.yi) } : s)),
      files: db.questionBank.filter(q => q.uploadedBy === st.id && q.band === b.index).sort((x, y) => y.id - x.id).map(mineView) }
  })
  res.json({ subject: subjectOf(st).name, classKey: which, total: students.length, average: students.length ? +(students.reduce((t, s) => t + s.cgpa, 0) / students.length).toFixed(2) : 0, above9: bands[4].count, below65: bands[0].count, bands })
})
router.post('/question-bank', upload.single('file'), (req, res) => {
  try {
    const band = U.int(req.body?.band, 'Band', 0, 4), row = { ...fileForm(req, 'questionBank'), band }, st = me(req)
    db.questionBank.push(row)
    notify(staffClasses(st).flatMap(k => roster(k)).filter(s => U.bandOf(academics(s.id).cgpa) === band).map(s => s.id), 'assignment', `New ${subjectOf(st).name} question bank: ${row.title}`)
    logActivity(st.id, `Uploaded question bank (CGPA ${U.BANDS[band].label}): ${row.title}`); save(); res.status(201).json({ item: mineView(row) })
  } catch (e) { discardUpload(req.file); throw e }
})
router.delete('/question-bank/:id', (req, res) => {
  const q = db.questionBank.find(x => x.id === +req.params.id && x.uploadedBy === me(req).id)
  if (!q) throw new HttpError(404, 'Not found')
  removeFile(q.fileId); db.questionBank = db.questionBank.filter(x => x !== q); save(); res.json({ ok: true })
})

// ---- events and announcements ----
router.post('/events', (req, res) => {
  const b = req.body || {}, cat = b.category || 'Other'
  if (!['Tech', 'Workshop', 'Sports', 'Cultural', 'Other'].includes(cat)) throw new HttpError(400, 'Category must be Tech, Workshop, Sports, Cultural or Other')
  if (!U.isISO(b.date)) throw new HttpError(400, 'Date must look like 2026-10-12')
  const e = { id: nextId('events'), title: U.str(b.title, 'Title', { max: 100 }), category: cat, date: b.date, where: U.str(b.where, 'Place', { max: 100 }), description: U.str(b.description, 'Description', { max: 500, optional: true }), createdBy: me(req).id }
  db.events.push(e); notify(db.users.filter(u => u.role === 'student').map(u => u.id), 'event', `New event: ${e.title} on ${e.date} at ${e.where}`)
  logActivity(me(req).id, `Created event: ${e.title}`); save(); res.status(201).json({ event: e })
})
router.delete('/events/:id', (req, res) => {
  const e = db.events.find(x => x.id === +req.params.id && x.createdBy === me(req).id)
  if (!e) throw new HttpError(404, 'Event not found, or you did not create it')
  db.events = db.events.filter(x => x !== e); db.registrations = db.registrations.filter(r => r.eventId !== e.id); save(); res.json({ ok: true })
})
router.get('/events/:id/registrations', (req, res) => {
  const e = db.events.find(x => x.id === +req.params.id && x.createdBy === me(req).id)
  if (!e) throw new HttpError(404, 'Event not found, or you did not create it')
  res.json({ event: e.title, registrations: db.registrations.filter(r => r.eventId === e.id).map(r => { const s = idx.users.get(r.studentId); return { name: s.name, roll: s.roll, classKey: s.classKey } }) })
})
router.post('/announcements', (req, res) => {
  const text = U.str(req.body?.text, 'Message', { max: 300 }), st = me(req), which = req.body?.classKey
  const keys = which && which !== 'all' ? [classKeyOf(req, which)] : staffClasses(st), ids = keys.flatMap(k => roster(k).map(s => s.id))
  notify(ids, 'event', `${st.name}: ${text}`); logActivity(st.id, `Sent announcement to ${keys.join(', ')}`); save()
  res.json({ ok: true, sentTo: ids.length })
})

// ---- lab bookings (a lab cannot be booked when a class already has it) ----
router.post('/lab-bookings', (req, res) => {
  const b = req.body || {}, lab = String(b.lab || ''), date = String(b.date || ''), block = U.int(b.block, 'Block', 0, 3)
  if (!LAB_ROOMS.includes(lab)) throw new HttpError(400, 'Unknown lab')
  if (!U.isISO(date)) throw new HttpError(400, 'Date must look like 2026-10-12')
  if (date < U.todayISO()) throw new HttpError(400, 'You cannot book a lab in the past')
  const day = U.dayOfISO(date)
  if (day > 5) throw new HttpError(409, 'Labs are closed on Sunday')
  const cls = sessionsAt(lab, day, block)[0]
  if (cls) throw new HttpError(409, `${lab} is used by ${cls.classKey} (${cls.sub}) at that time`)
  if (db.labBookings.some(x => x.lab === lab && x.date === date && x.block === block)) throw new HttpError(409, 'That lab slot is already booked')
  const row = { id: nextId('labBookings'), lab, date, block, purpose: U.str(b.purpose, 'Purpose', { max: 100, optional: true }) || subjectOf(me(req)).name, staffId: me(req).id, createdAt: new Date().toISOString() }
  db.labBookings.push(row)
  const st = me(req), mine = staffClasses(st).flatMap(k => roster(k).map(s => s.id)) // every student this staff member teaches
  notify(mine, 'lab', `${st.name} booked ${lab} for ${row.purpose} on ${date}, ${U.blockLabel(block)} (${U.blockTime(block)})`)
  logActivity(me(req).id, `Booked ${lab} on ${date} (${U.blockLabel(block)})`); save()
  res.status(201).json({ booking: { ...row, label: U.blockLabel(block), time: U.blockTime(block) } })
})
router.get('/lab-bookings', (req, res) => res.json({ bookings: db.labBookings.filter(x => x.staffId === me(req).id).sort((a, b) => a.date.localeCompare(b.date) || a.block - b.block).map(b => ({ ...b, label: U.blockLabel(b.block), time: U.blockTime(b.block) })) }))
router.delete('/lab-bookings/:id', (req, res) => {
  const b = db.labBookings.find(x => x.id === +req.params.id && x.staffId === me(req).id)
  if (!b) throw new HttpError(404, 'Booking not found')
  db.labBookings = db.labBookings.filter(x => x !== b)
  notify(staffClasses(me(req)).flatMap(k => roster(k).map(s => s.id)), 'lab', `Lab booking cancelled: ${b.lab} on ${b.date}, ${U.blockLabel(b.block)}`)
  save(); res.json({ ok: true })
})
