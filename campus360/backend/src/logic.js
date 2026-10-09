// Rules shared by the student and staff routes, so both sides always see the same numbers.
import { db, idx, nextId } from './db.js'
import * as U from './util.js'
import { labsOfClass } from './labs.js'

export const publicUser = u => { const { passwordHash, ...rest } = u; return rest }
export const staffFor = (dept, yi, subjectId) => idx.staffBy.get(`${dept}|${yi}|${subjectId}`)
export const staffClasses = st => U.SECTIONS.map(sec => U.classKey(st.teaching.yi, st.dept, sec))
export const ownClass = (st, key) => staffClasses(st).includes(key)

export function notify(userIds, type, text) {
  const now = new Date().toISOString()
  for (const userId of userIds) db.notifications.push({ id: nextId('notifications'), userId, type, text, read: false, createdAt: now })
}
export function logActivity(userId, text) { db.activity.push({ id: nextId('activity'), userId, text, createdAt: new Date().toISOString() }) }

// ---- marks, grades, CGPA ----
export function markCalc(m, subj) {
  const labMax = subj.lab ? 25 : 0, max = 50 + labMax + 25
  const ia = Math.round((m.ia1 + m.ia2) / 2), lab = subj.lab ? m.lab : 0
  const score = ia + lab + m.asg, marks = Math.round((score / max) * 100)
  return { ia1: m.ia1, ia2: m.ia2, ia, lab, labMax, asg: m.asg, max, score, internal: Math.round((score / max) * 50), marks, gradePoint: U.gradePoint(marks), grade: U.gradeLetter(marks) }
}
export function academics(studentId) {
  const rows = U.SUBJECTS.map(s => ({ subjectId: s.id, name: s.name, credits: s.credits, ...markCalc(idx.marks.get(`${studentId}:${s.id}`), s) }))
  const totalCr = U.SUBJECTS.reduce((t, s) => t + s.credits, 0)
  const cgpa = +(rows.reduce((t, r) => t + r.gradePoint * r.credits, 0) / totalCr).toFixed(1)
  const passed = rows.filter(r => r.gradePoint > 0).reduce((t, r) => t + r.credits, 0)
  return { rows, cgpa, passed }
}
export const cgpaOf = id => academics(id).cgpa

// ---- attendance ----
export const pctOf = a => (a.total ? Math.round((a.present / a.total) * 100) : 100)
export function attendanceFor(studentId) {
  let P = 0, T = 0
  const subjects = U.SUBJECTS.map(s => {
    const a = idx.att.get(`${studentId}:${s.id}`), pct = pctOf(a), low = pct < 75
    P += a.present; T += a.total
    return { subjectId: s.id, name: s.name, present: a.present, total: a.total, pct, low, needMore: low ? Math.ceil((0.75 * a.total - a.present) / 0.25) : 0 }
  })
  return { overall: T ? Math.round((P / T) * 100) : 100, present: P, total: T, subjects }
}

// ---- timetable: one rule gives both the student view and the staff view ----
// Theory subject = rotation by day, period and section. Different sections get different subjects in the same period
// (offsets 0, 2, 4 of 5 subjects), so a staff member who teaches one subject to all 3 sections is never double-booked.
export function scheduleCell(key, day, period) {
  const c = U.parseClassKey(key), secIdx = U.SECTIONS.indexOf(c.sec)
  const lab = labsOfClass(key).find(l => l.day === day && U.BLOCKS[l.block].includes(period))
  if (lab) return { kind: 'lab', title: lab.sub, room: lab.lab, meta: `${lab.lab} · Lab faculty` }
  const subj = U.SUBJECTS[(day * 3 + (period - 1) + secIdx * 2) % U.SUBJECTS.length], st = staffFor(c.dept, c.yi, subj.id)
  return { kind: 'class', subjectId: subj.id, title: subj.name, room: U.ROOMS[subj.id], staffId: st?.id, staffName: st?.name, meta: `${U.ROOMS[subj.id]} · ${st?.name || 'Faculty'}` }
}
export const classWeek = key => U.DAYS.map((_, d) => U.DAY_PERIODS.map(p => ({ n: p.n, t: p.t, ...scheduleCell(key, d, p.n) })))
export function staffWeek(st) {
  const keys = staffClasses(st)
  return U.DAYS.map((_, d) => U.DAY_PERIODS.map(p => {
    for (const k of keys) {
      const c = scheduleCell(k, d, p.n)
      if (c.kind === 'class' && c.subjectId === st.teaching.subjectId) return { n: p.n, t: p.t, free: false, classKey: k, subjectId: c.subjectId, subject: c.title, room: c.room }
    }
    return { n: p.n, t: p.t, free: true, title: 'Free period' }
  }))
}

// ---- food orders: status moves on its own as time passes (demo) ----
export const ORDER_STEPS = ['Placed', 'Preparing', 'Ready', 'Picked up']
export const orderStep = o => { const s = (Date.now() - new Date(o.createdAt).getTime()) / 1000; return s < 60 ? 0 : s < 180 ? 1 : s < 300 ? 2 : 3 }

// ---- submissions / assignments ----
export const submissionOf = (assignmentId, studentId) => db.submissions.find(s => s.assignmentId === assignmentId && s.studentId === studentId)
export const fileInfo = id => { const f = idx.files.get(id); return f ? { id: f.id, name: f.originalName, size: f.size } : null }
