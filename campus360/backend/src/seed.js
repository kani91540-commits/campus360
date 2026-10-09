// Creates the demo college: 80 staff, 1,728 students, marks, attendance, assignments, events.
import bcrypt from 'bcryptjs'
import * as U from './util.js'
import { FOOD } from './catalog.js'

const FIRST = ['Aarav', 'Divya', 'Mohan', 'Nisha', 'Rahul', 'Kavin', 'Priya', 'Sanjay', 'Harini', 'Vikram', 'Meena', 'Arjun', 'Lakshmi', 'Karthik', 'Swetha',
  'Naveen', 'Anitha', 'Dinesh', 'Pooja', 'Surya', 'Revathi', 'Ganesh', 'Janani', 'Bharath', 'Keerthi', 'Yogesh', 'Sowmya', 'Tarun', 'Ishwarya', 'Prakash']
const INITIALS = 'ABCDEGHJKLMNPRSTV'
const STAFF_FIRST = ['Suresh', 'Lalitha', 'Ramesh', 'Vasanthi', 'Senthil', 'Geetha', 'Murali', 'Sudha', 'Balaji', 'Uma', 'Harish', 'Nithya', 'Gopal', 'Saranya', 'Manoj', 'Deepa',
  'Kumaran', 'Revathy', 'Anand', 'Bhuvana', 'Selvam', 'Malathi', 'Vijay', 'Padma', 'Ravi', 'Sangeetha', 'Elango', 'Jayanthi', 'Mahesh', 'Vimala']
const STAFF_LAST = ['Kumar', 'Devi', 'Raman', 'Sundar', 'Nathan', 'Balan', 'Rajan', 'Mohan', 'Selvi']
const TITLES = ['Dr.', 'Prof.', 'Ms.', 'Mr.', 'Mrs.']
const DESIGNATIONS = ['Assistant Professor', 'Associate Professor', 'Professor']
const BLOOD = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-']
const AREAS = ['Peelamedu', 'Gandhipuram', 'Singanallur', 'Saravanampatti', 'RS Puram', 'Ramanathapuram', 'Vadavalli', 'Avinashi Road']
const KNOWN_STAFF = [ // the faculty the frontend already shows for 1st year CSE
  ['Dr. Meena', 'meena'], ['Ms. Priya', 'priya'], ['Prof. Raj', 'raj'], ['Dr. Arun', 'arun'], ['Ms. Kavya', 'kavya'],
]
const ASSIGNMENTS = [
  ['Python: File handling', 'Write programs that read and write text and CSV files. Submit the .py files and a short output screenshot.', 3],
  ['Portfolio landing page', 'Build a one-page portfolio with HTML and CSS. Submit a zip of the project.', 6],
  ['Calculus problem set 4', 'Solve all problems in set 4. Show every step. Submit a scanned PDF.', 2],
  ['Pendulum lab report', 'Write the report for the simple pendulum experiment, with observations and graph.', -4],
  ['Group presentation outline', 'Submit a one-page outline for your group presentation.', 8],
]

export function seed() {
  const db = { seq: {}, users: [], attendance: [], attendanceLog: [], marks: [], assignments: [], submissions: [], files: [], questionBank: [], notes: [], events: [], registrations: [], notifications: [], activity: [], orders: [], labBookings: [] }
  const id = c => (db.seq[c] = (db.seq[c] || 0) + 1)
  const staffHash = bcrypt.hashSync('staff123', 8), studentHash = bcrypt.hashSync('student123', 8)
  const phone = r => `9${String(Math.floor(r() * 1e9)).padStart(9, '0')}`
  const gauss = r => Math.sqrt(-2 * Math.log(r() || 0.5)) * Math.cos(2 * Math.PI * r())

  // ---- staff: one per department x year x subject, each teaching all 3 sections ----
  const usedEmails = new Set(), sr = U.rng(7)
  let n = 0
  for (const dept of U.DEPTS) for (let yi = 0; yi < 4; yi++) for (const subj of U.SUBJECTS) {
    let name, email
    if (dept === 'CSE' && yi === 0) { const k = KNOWN_STAFF[subj.id - 1]; name = k[0]; email = `${k[1]}@kpriet.ac.in` }
    else {
      const f = STAFF_FIRST[n % STAFF_FIRST.length], l = STAFF_LAST[Math.floor(n / STAFF_FIRST.length) % STAFF_LAST.length]
      name = `${TITLES[n % TITLES.length]} ${f} ${l}`; email = `${f}.${l}`.toLowerCase() + '@kpriet.ac.in'; n++
    }
    while (usedEmails.has(email)) email = email.replace('@', `${Math.floor(sr() * 90) + 10}@`)
    usedEmails.add(email)
    db.users.push({
      id: id('users'), role: 'staff', name, email, passwordHash: staffHash, dept, designation: DESIGNATIONS[Math.floor(sr() * 3)],
      empId: `KPRIET-${dept.replace(/[^A-Z]/g, '')}${100 + db.users.length}`, phone: phone(sr), subject: subj.name, teaching: { subjectId: subj.id, yi },
    })
  }

  // ---- students ----
  for (const dept of U.DEPTS) for (let yi = 0; yi < 4; yi++) for (let si = 0; si < 3; si++) for (let i = 0; i < 36; i++) {
    const sec = U.SECTIONS[si], roll = `7376${26 - (yi + 1)}1${U.DEPT_CODE[dept]}${si + 1}${String(i + 1).padStart(2, '0')}`
    const r = U.rng(U.hash(roll))
    const kani = roll === '7376251CS101'
    const name = kani ? 'Kani' : `${FIRST[Math.floor(r() * FIRST.length)]} ${INITIALS[Math.floor(r() * INITIALS.length)]}`
    const sid = id('users'), hostel = r() < 0.5
    db.users.push({
      id: sid, role: 'student', name, email: kani ? 'kani@kpriet.ac.in' : `${roll.toLowerCase()}@kpriet.ac.in`, passwordHash: studentHash,
      roll, dept, yi, year: U.YEARS[yi], sec, classKey: U.classKey(yi, dept, sec), phone: phone(r), bloodGroup: BLOOD[Math.floor(r() * BLOOD.length)],
      address: `${1 + Math.floor(r() * 120)}, ${AREAS[Math.floor(r() * AREAS.length)]}, Coimbatore`, residence: hostel ? 'Hostel' : 'Day scholar',
    })
    // marks: one "ability" per student keeps the components believable
    const ability = Math.min(98, Math.max(52, 77 + gauss(r) * 11))
    const comp = max => Math.max(Math.round(max * 0.45), Math.min(max, Math.round((max * (ability + gauss(r) * 4)) / 100)))
    const base = Math.min(99, Math.max(55, 85 + gauss(r) * 8))
    for (const s of U.SUBJECTS) {
      db.marks.push({ studentId: sid, subjectId: s.id, ia1: comp(50), ia2: comp(50), lab: s.lab ? comp(25) : 0, asg: comp(25) })
      const total = 34 + Math.floor(r() * 7)
      db.attendance.push({ studentId: sid, subjectId: s.id, total, present: Math.min(total, Math.round((total * Math.min(100, Math.max(40, base + gauss(r) * 5))) / 100)) })
    }
  }

  // ---- assignments: one per department x year x subject, for all 3 sections ----
  const today = new Date()
  for (const dept of U.DEPTS) for (let yi = 0; yi < 4; yi++) for (const subj of U.SUBJECTS) {
    const [title, description, off] = ASSIGNMENTS[subj.id - 1], due = new Date(today); due.setDate(due.getDate() + off)
    const staff = db.users.find(u => u.role === 'staff' && u.dept === dept && u.teaching.yi === yi && u.teaching.subjectId === subj.id)
    const a = { id: id('assignments'), subjectId: subj.id, classKeys: U.SECTIONS.map(s => U.classKey(yi, dept, s)), title, description, due: U.fmtDate(due), maxMarks: 25, createdBy: staff.id, createdAt: new Date().toISOString() }
    db.assignments.push(a)
    for (const st of db.users) {
      if (st.role !== 'student' || !a.classKeys.includes(st.classKey)) continue
      if (U.rng(U.hash(`${st.roll}|${a.id}`))() < (off < 0 ? 0.85 : 0.35)) db.submissions.push({ id: id('submissions'), assignmentId: a.id, studentId: st.id, fileId: null, fileName: null, submittedAt: new Date().toISOString(), late: false, reviewed: false, marks: null, feedback: '' })
    }
  }

  // ---- events ----
  const EV = [['Hackathon 2026', 'Tech', '2026-10-09', 'Auditorium', '24-hour build challenge. Teams of 3-4.'],
    ['UI/UX Workshop', 'Workshop', '2026-10-14', 'Lab 1', 'Hands-on Figma session with portfolio review.'],
    ['Inter-Dept Cricket', 'Sports', '2026-10-18', 'Main Ground', 'Knockout matches, CSE vs ECE opens.'],
    ['Cultural Night', 'Cultural', '2026-10-25', 'Open Air Theatre', 'Music, dance and drama from all years.']]
  EV.forEach(([title, category, date, where, description]) => db.events.push({ id: id('events'), title, category, date, where, description, createdBy: null }))

  // ---- a couple of starter notifications for the two demo accounts ----
  const demo = (email, items) => { const u = db.users.find(x => x.email === email); items.forEach(([type, text]) => db.notifications.push({ id: id('notifications'), userId: u.id, type, text, read: false, createdAt: new Date().toISOString() })) }
  demo('kani@kpriet.ac.in', [['event', 'Hackathon 2026 starts on 2026-10-09 at the Auditorium'], ['assignment', 'New assignment: Calculus problem set 4']])
  demo('meena@kpriet.ac.in', [['assignment', 'Student submissions are waiting for review'], ['event', 'Hackathon 2026 starts on 2026-10-09 at the Auditorium']])
  db.foodCount = FOOD.length
  return db
}
