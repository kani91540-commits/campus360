// Runs the real server against a temporary database and checks that staff and student sides agree.
// Usage: npm test
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c360-'))
process.env.DB_FILE = path.join(tmp, 'db.json'); process.env.UPLOAD_DIR = path.join(tmp, 'uploads'); process.env.JWT_SECRET = 'test-secret'
const { app } = await import('../server.js')
const server = app.listen(0), base = `http://localhost:${server.address().port}/api`

let fails = 0
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); if (!cond) fails++ }
const call = async (method, url, { token, body, form } = {}) => {
  const headers = {}; if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const r = await fetch(base + url, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) })
  const type = r.headers.get('content-type') || ''
  return { status: r.status, data: type.includes('json') ? await r.json() : await r.text() }
}
const login = async (email, password, role) => (await call('POST', '/auth/login', { body: { email, password, role } })).data
const fileForm = (fields, name = 'work.pdf', text = 'hello') => { const f = new FormData(); Object.entries(fields).forEach(([k, v]) => f.append(k, v)); f.append('file', new Blob([text]), name); return f }

// ---- login ----
const kani = await login('kani@kpriet.ac.in', 'student123', 'student'), meena = await login('meena@kpriet.ac.in', 'staff123', 'staff')
ok('student can log in', !!kani.token && kani.user.classKey === '1st Year CSE-A')
ok('staff can log in', !!meena.token && meena.user.subject === 'Python Programming')
ok('password hash is never sent', !('passwordHash' in kani.user))
ok('wrong password is rejected', (await call('POST', '/auth/login', { body: { email: 'kani@kpriet.ac.in', password: 'nope' } })).status === 401)
ok('wrong role is rejected', (await call('POST', '/auth/login', { body: { email: 'kani@kpriet.ac.in', password: 'student123', role: 'staff' } })).status === 401)
const S = kani.token, T = meena.token
ok('no token is rejected', (await call('GET', '/student/dashboard')).status === 401)
ok('student cannot open staff routes', (await call('GET', '/staff/dashboard', { token: S })).status === 403)
ok('staff cannot open student routes', (await call('GET', '/student/dashboard', { token: T })).status === 403)

// ---- dashboards ----
const dash = (await call('GET', '/student/dashboard', { token: S })).data
ok('student dashboard has attendance, cgpa and today', dash.attendance > 0 && dash.cgpa > 0 && Array.isArray(dash.today))
const sdash = (await call('GET', '/staff/dashboard', { token: T })).data
ok('staff dashboard lists 3 classes', sdash.classes.length === 3 && sdash.classes[0] === '1st Year CSE-A')

// ---- timetable: student and staff views agree ----
const week = (await call('GET', '/student/timetable', { token: S })).data.week, sweek = (await call('GET', '/staff/timetable', { token: T })).data.week
ok('student week is 6 days x 7 periods', week.length === 6 && week.every(d => d.length === 7))
let agree = true, seen = 0
for (let d = 0; d < 6; d++) for (let p = 0; p < 7; p++) {
  const c = week[d][p], s = sweek[d][p]
  if (c.kind === 'class' && c.subjectId === 1) { seen++; if (s.free || s.classKey !== '1st Year CSE-A') agree = false }
  if (!s.free && s.classKey === '1st Year CSE-A' && c.subjectId !== 1) agree = false
}
ok('staff timetable matches the student timetable', agree && seen > 0)
ok('student timetable names the staff member', week.flat().some(c => c.staffName === 'Dr. Meena'))

// ---- attendance: staff marks, student sees ----
const slots = [], today = new Date()
for (let i = 0; i < 7; i++) { const d = new Date(today); d.setDate(d.getDate() - i); const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const r = (await call('GET', `/staff/attendance/slots?date=${iso}`, { token: T })).data.slots.find(x => x.classKey === '1st Year CSE-A' && !x.marked); if (r) { slots.push({ ...r, date: iso }); break } }
ok('staff has a class to mark this week', slots.length === 1)
const slot = slots[0], before = (await call('GET', '/student/attendance', { token: S })).data.subjects.find(s => s.subjectId === 1)
const sess = (await call('GET', `/staff/attendance/session?date=${slot.date}&classKey=1st Year CSE-A&period=${slot.period}`, { token: T })).data
const kid = sess.students.find(s => s.roll === '7376251CS101').id
let r = await call('POST', '/staff/attendance', { token: T, body: { date: slot.date, classKey: '1st Year CSE-A', period: slot.period, absentIds: [kid] } })
ok('marking attendance works', r.status === 200 && r.data.absent === 1, JSON.stringify(r.data))
let after = (await call('GET', '/student/attendance', { token: S })).data.subjects.find(s => s.subjectId === 1)
ok('student total went up by 1, present stayed', after.total === before.total + 1 && after.present === before.present)
r = await call('POST', '/staff/attendance', { token: T, body: { date: slot.date, classKey: '1st Year CSE-A', period: slot.period, absentIds: [] } })
after = (await call('GET', '/student/attendance', { token: S })).data.subjects.find(s => s.subjectId === 1)
ok('editing the same period does not double count', r.data.updated && after.total === before.total + 1 && after.present === before.present + 1)
const sunday = (() => { const d = new Date(today); while (d.getDay() !== 0) d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
ok('cannot mark a day with no timetable (Sunday)', (await call('POST', '/staff/attendance', { token: T, body: { date: sunday, classKey: '1st Year CSE-A', period: 1, absentIds: [] } })).status === 409)
ok('cannot mark a future date', (await call('POST', '/staff/attendance', { token: T, body: { date: '2099-01-01', classKey: '1st Year CSE-A', period: 1, absentIds: [] } })).status === 400)
ok('cannot mark another staff member\'s class', (await call('POST', '/staff/attendance', { token: T, body: { date: slot.date, classKey: '2nd Year CSE-A', period: 1, absentIds: [] } })).status === 403)

// ---- assignments: staff creates, student submits, staff reviews, student sees ----
const due = new Date(today); due.setDate(due.getDate() + 5)
const dueISO = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`
r = await call('POST', '/staff/assignments', { token: T, body: { title: 'Loops practice', description: 'Do all', due: dueISO, classKeys: ['1st Year CSE-A'] } })
ok('staff can create an assignment', r.status === 201, JSON.stringify(r.data))
const aid = r.data.assignment.id
let mine = (await call('GET', '/student/assignments', { token: S })).data.assignments.find(a => a.id === aid)
ok('student sees it as Pending', mine?.status === 'Pending')
ok('student got a notification', (await call('GET', '/notifications', { token: S })).data.items.some(n => n.text.includes('Loops practice')))
const other = await login('7376251cs201@kpriet.ac.in', 'student123')
ok('a student in another section does not see it', !(await call('GET', '/student/assignments', { token: other.token })).data.assignments.some(a => a.id === aid))
ok('submit without a file is rejected', (await call('POST', `/student/assignments/${aid}/submit`, { token: S, form: new FormData() })).status === 400)
ok('bad file type is rejected', (await call('POST', `/student/assignments/${aid}/submit`, { token: S, form: fileForm({}, 'virus.exe') })).status === 400)
r = await call('POST', `/student/assignments/${aid}/submit`, { token: S, form: fileForm({}, 'loops.pdf', 'my answer') })
ok('student can submit a file', r.status === 200 && r.data.assignment.status === 'Submitted', JSON.stringify(r.data))
const subs = (await call('GET', `/staff/submissions?assignmentId=${aid}`, { token: T })).data.submissions
ok('staff sees the submission', subs.length === 1 && subs[0].student.roll === '7376251CS101' && subs[0].file?.name === 'loops.pdf')
const dl = await call('GET', `/files/${subs[0].file.id}`, { token: T })
ok('staff can download the file', dl.status === 200 && dl.data === 'my answer')
ok('another student cannot download it', (await call('GET', `/files/${subs[0].file.id}`, { token: other.token })).status === 403)
ok('marks above the maximum are rejected', (await call('PATCH', `/staff/submissions/${subs[0].id}`, { token: T, body: { marks: 99 } })).status === 400)
r = await call('PATCH', `/staff/submissions/${subs[0].id}`, { token: T, body: { marks: 22, feedback: 'Good work' } })
mine = (await call('GET', '/student/assignments', { token: S })).data.assignments.find(a => a.id === aid)
ok('student sees Reviewed with marks and feedback', mine.status === 'Reviewed' && mine.submission.marks === 22 && mine.submission.feedback === 'Good work')
ok('student cannot resubmit after review', (await call('POST', `/student/assignments/${aid}/submit`, { token: S, form: fileForm({}, 'again.pdf') })).status === 409)

// ---- marks and CGPA: staff enters, student and question-bank report agree ----
const marks = (await call('GET', '/staff/marks?classKey=1st Year CSE-A', { token: T })).data
ok('staff sees marks for the class', marks.students.length === 36 && marks.hasLab === true)
ok('out-of-range marks are rejected', (await call('PUT', '/staff/marks', { token: T, body: { classKey: '1st Year CSE-A', entries: [{ studentId: kid, ia1: 51 }] } })).status === 400)
await call('PUT', '/staff/marks', { token: T, body: { classKey: '1st Year CSE-A', entries: [{ studentId: kid, ia1: 50, ia2: 50, lab: 25, asg: 25 }] } })
let ac = (await call('GET', '/student/academics', { token: S })).data
ok('student sees full marks in Python', ac.subjects.find(s => s.subjectId === 1).marks === 100 && ac.subjects.find(s => s.subjectId === 1).gradePoint === 10)
let rep = (await call('GET', '/staff/question-bank/report?classKey=1st Year CSE-A', { token: T })).data
const inBand = b => rep.bands[b].students.some(s => s.id === kid)
ok('report counts add up to 36', rep.bands.reduce((t, b) => t + b.count, 0) === 36 && rep.total === 36)
ok('report puts the student in the same band as their CGPA', inBand(ac.cgpa < 6.5 ? 0 : ac.cgpa < 7.5 ? 1 : ac.cgpa < 8.5 ? 2 : ac.cgpa < 9 ? 3 : 4))
await call('PUT', '/staff/marks', { token: T, body: { classKey: '1st Year CSE-A', entries: [{ studentId: kid, ia1: 22, ia2: 22, lab: 11, asg: 11 }] } })
ac = (await call('GET', '/student/academics', { token: S })).data
ok('lowering Python marks lowers the CGPA', ac.cgpa < 10 && ac.subjects.find(s => s.subjectId === 1).marks < 50)
rep = (await call('GET', '/staff/question-bank/report?classKey=1st Year CSE-A', { token: T })).data
ok('weak students get a SGPA-needed figure', rep.bands[0].students.every(s => typeof s.sgpaNeeded === 'number') && rep.bands[0].ideas.length > 3)

// ---- question bank: student only sees the file for their own CGPA band ----
const myBand = (await call('GET', '/student/question-bank', { token: S })).data.band.index, otherBand = (myBand + 1) % 5
r = await call('POST', '/staff/question-bank', { token: T, form: fileForm({ band: myBand, unit: 'Unit 1', title: 'My band set' }, 'qb.pdf', 'questions') })
ok('staff can upload for a band', r.status === 201, JSON.stringify(r.data))
const qbId = r.data.item.file.id
await call('POST', '/staff/question-bank', { token: T, form: fileForm({ band: otherBand, unit: 'Unit 2', title: 'Other band set' }, 'qb2.pdf', 'other') })
const qb = (await call('GET', '/student/question-bank', { token: S })).data
ok('student sees only their band', qb.items.length === 1 && qb.items[0].title === 'My band set', JSON.stringify(qb.items.map(i => i.title)))
ok('student can download it', (await call('GET', `/files/${qbId}`, { token: S })).data === 'questions')
const otherFileId = (await call('GET', '/staff/question-bank/report?classKey=1st Year CSE-A', { token: T })).data.bands[otherBand].files[0].file.id
ok('student cannot download another band\'s file', (await call('GET', `/files/${otherFileId}`, { token: S })).status === 403)
ok('notes upload and student can see them', (await call('POST', '/staff/notes', { token: T, form: fileForm({ title: 'Unit 1 notes', kind: 'notes' }, 'n.pdf') })).status === 201 && (await call('GET', '/student/notes', { token: S })).data.items.length === 1)

// ---- labs ----
const lt = (await call('GET', '/labs/class-timetable', { token: S })).data
ok('class lab timetable has 2 sessions for 1st year CSE', lt.sessions.length === 2 && lt.sessions.every(s => s.lab && s.time))
const sess0 = lt.sessions[0], nextDate = (() => { const d = new Date(today); for (let i = 1; i < 15; i++) { d.setDate(d.getDate() + 1); if ((d.getDay() + 6) % 7 === sess0.day) break } return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
r = await call('POST', '/staff/lab-bookings', { token: T, body: { lab: sess0.lab, date: nextDate, block: sess0.block, purpose: 'Extra class' } })
ok('cannot book a lab that a class already uses', r.status === 409, JSON.stringify(r.data))
const av = (await call('GET', `/labs/availability?lab=${encodeURIComponent(sess0.lab)}&date=${nextDate}`, { token: S })).data
ok('availability shows the class session', av.blocks[sess0.block].status === 'class')
const freeBlock = av.blocks.find(b => b.status === 'free')
r = await call('POST', '/staff/lab-bookings', { token: T, body: { lab: sess0.lab, date: nextDate, block: freeBlock.block, purpose: 'Extra class' } })
ok('staff can book a free slot', r.status === 201, JSON.stringify(r.data))
ok('same slot cannot be booked twice', (await call('POST', '/staff/lab-bookings', { token: T, body: { lab: sess0.lab, date: nextDate, block: freeBlock.block } })).status === 409)
ok('student sees it as booked', (await call('GET', `/labs/availability?lab=${encodeURIComponent(sess0.lab)}&date=${nextDate}`, { token: S })).data.blocks[freeBlock.block].status === 'booked')

// ---- food, events, notifications ----
ok('menu has 28 items and 3 shops', await (async () => { const m = (await call('GET', '/food/menu', { token: S })).data; return m.items.length === 28 && m.shops.length === 3 })())
ok('empty cart is rejected', (await call('POST', '/student/orders', { token: S, body: { items: [], pickup: '12:30' } })).status === 400)
r = await call('POST', '/student/orders', { token: S, body: { items: [{ itemId: 1, qty: 2 }, { itemId: 11, qty: 1 }, { itemId: 1, qty: 1 }], pickup: '12:30' } })
ok('order total is calculated by the server', r.status === 201 && r.data.order.total === 90 * 3 + 70 && r.data.order.status === 'Placed', JSON.stringify(r.data))
ok('unknown item is rejected', (await call('POST', '/student/orders', { token: S, body: { items: [{ itemId: 999, qty: 1 }], pickup: '12:30' } })).status === 400)
ok('order shows in the list', (await call('GET', '/student/orders', { token: S })).data.orders.length === 1)
const evs = (await call('GET', '/events', { token: S })).data.events
ok('events list has registered flag', evs.length >= 4 && evs.every(e => e.registered === false))
ok('student can register', (await call('POST', `/student/events/${evs[0].id}/register`, { token: S })).status === 200 && (await call('POST', `/student/events/${evs[0].id}/register`, { token: S })).status === 409)
r = await call('POST', '/staff/events', { token: T, body: { title: 'Python Quiz', category: 'Tech', date: dueISO, where: 'Lab 1', description: 'Fun quiz' } })
ok('staff can create an event and students are told', r.status === 201 && (await call('GET', '/notifications', { token: S })).data.items.some(n => n.text.includes('Python Quiz')))
ok('staff sees registrations for own event', (await call('POST', `/student/events/${r.data.event.id}/register`, { token: S })).status === 200 && (await call('GET', `/staff/events/${r.data.event.id}/registrations`, { token: T })).data.registrations.length === 1)
const nlist = (await call('GET', '/notifications', { token: S })).data
await call('POST', `/notifications/${nlist.items[0].id}/read`, { token: S })
ok('mark as read works', (await call('GET', '/notifications', { token: S })).data.unread === nlist.unread - 1)
ok('announcement reaches the class', (await call('POST', '/staff/announcements', { token: T, body: { text: 'Class at 9 tomorrow', classKey: '1st Year CSE-A' } })).data.sentTo === 36)
ok('password change works', (await call('POST', '/auth/change-password', { token: S, body: { currentPassword: 'student123', newPassword: 'newpass123' } })).status === 200 && !!(await login('kani@kpriet.ac.in', 'newpass123')).token)
ok('unknown API route gives a JSON 404', (await call('GET', '/nothing', { token: S })).status === 404)

server.close()
fs.rmSync(tmp, { recursive: true, force: true })
console.log(fails ? `\n${fails} check(s) failed` : '\nAll checks passed')
process.exit(fails ? 1 : 0)
