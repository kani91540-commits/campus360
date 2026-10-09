// Builds per-user demo data from the email a person signs in with.
// Same email -> same data every time. Different email -> different data.
import D from './data'
import { labsFor, fromProfile, BLOCKS, DAY_PERIODS, DAYS, YEARS, SECTIONS } from './labTimetable'

const hash = s => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return h >>> 0 }
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pct = (p, t) => Math.round((p / t) * 100)
const cap = w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
const ROLL = /^\d{7}[a-z]{2}\d{3}$/i
const DEPTS = [['BE CSE', 'CS'], ['BE IT', 'IT'], ['BE ECE', 'EC'], ['BE AI&DS', 'AD']]


// ---- personal details (stable for the same email) ----
const BLOOD = ['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-']
const AREAS = ['Peelamedu', 'Gandhipuram', 'Singanallur', 'Saravanampatti', 'RS Puram', 'Ramanathapuram', 'Vadavalli', 'Avinashi Road']
const PARENTS = ['Mr. Suresh Kumar', 'Mrs. Lakshmi Devi', 'Mr. Ramesh Babu', 'Mrs. Kavitha Raj', 'Mr. Senthil Nathan', 'Mrs. Meenakshi S']
const QUALS = ['M.E.', 'M.Tech', 'Ph.D', 'M.Sc']
const phone = r => `9${String(Math.floor(r() * 1e9)).padStart(9, '0')}`
const dob = (r, y0, y1) => `${String(1 + Math.floor(r() * 28)).padStart(2, '0')}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${y0 + Math.floor(r() * (y1 - y0 + 1))}`
function studentPersonal(email, year) {
  const r = rng(hash(email + '|personal')), pick = a => a[Math.floor(r() * a.length)]
  const hostel = r() < 0.5, route = pick(D.routes), parent = pick(PARENTS), pph = phone(r)
  const start = 2025 - ['First', 'Second', 'Third', 'Fourth'].findIndex(w => year.startsWith(w))
  return {
    dob: dob(r, 2006, 2008), gender: '', bloodGroup: pick(BLOOD), phone: phone(r),
    address: `${1 + Math.floor(r() * 120)}, ${pick(AREAS)}, Coimbatore - 641 0${10 + Math.floor(r() * 40)}`,
    parentName: parent, parentPhone: pph, emergencyName: parent, emergencyPhone: pph,
    residence: hostel ? 'Hostel' : `Day scholar · ${route.n}`, section: 'A', batch: `${start}-${start + 4}`,
    mentor: pick(Object.values(D.faculty)).who,
  }
}
function staffPersonal(email, dept, role, subject) {
  const r = rng(hash(email + '|personal')), pick = a => a[Math.floor(r() * a.length)]
  const joined = 2005 + Math.floor(r() * 18), emergency = pick(PARENTS)
  return {
    empId: `KPRIET-${dept.replace(/[^A-Z]/g, '')}${String(100 + Math.floor(r() * 899))}`,
    dob: dob(r, 1970, 1996), gender: '', bloodGroup: pick(BLOOD), phone: phone(r),
    address: `${1 + Math.floor(r() * 120)}, ${pick(AREAS)}, Coimbatore - 641 0${10 + Math.floor(r() * 40)}`,
    qualification: role === 'Professor' ? 'Ph.D' : pick(QUALS), specialization: subject,
    joined: String(joined), experience: `${2026 - joined} years`, cabin: `${pick(['A', 'B'])}-${200 + Math.floor(r() * 40)}`,
    emergencyName: emergency, emergencyPhone: phone(r),
  }
}

export const normEmail = id => { const v = id.trim().toLowerCase(); return v.includes('@') ? v : `${v}@kpriet.ac.in` }

// "kani.s@kpriet.ac.in" -> "Kani S", "divya_r@..." -> "Divya R", "mohan123" -> "Mohan"
export const nameFromEmail = id => {
  const local = id.trim().split('@')[0]
  if (ROLL.test(local)) return `Student ${local.slice(-3)}`
  const words = local.split(/[._\-+\s]+/).map(w => w.replace(/\d+/g, '')).filter(Boolean)
  return words.length ? words.map(cap).join(' ') : 'User'
}

// 6 days x 7 periods. Theory periods rotate through the student's subjects; lab sessions come from labTimetable.
function studentWeek(student, names) {
  const f = fromProfile(student), labs = labsFor(f.year, f.cls, f.sec)
  return DAYS.map((_, d) => {
    const row = DAY_PERIODS.map((p, i) => {
      const s = names[(d * 2 + i) % names.length], fac = D.faculty[s] || { r: 'A-101', who: 'Faculty' }
      return { n: p.n, t: p.t, title: s, meta: `${fac.r} · ${fac.who}`, lab: false, free: false }
    })
    labs.filter(l => l.day === d).forEach(l => BLOCKS[l.block].forEach(pn => {
      if (pn <= row.length) row[pn - 1] = { ...row[pn - 1], title: l.sub, meta: `${l.lab} · Lab faculty`, lab: true }
    }))
    return row
  })
}

export function makeStudent(email, name, seed = '') {
  const local = email.split('@')[0]
  // identity (roll number, department) stays the same for the same email
  const idr = rng(hash(email)), iint = (a, b) => a + Math.floor(idr() * (b - a + 1))
  // everything else is regenerated on every login (seed changes each time)
  const r = rng(hash(email + seed)), int = (a, b) => a + Math.floor(r() * (b - a + 1))
  const isRoll = ROLL.test(local)
  const picked = DEPTS[iint(0, DEPTS.length - 1)]
  const dept = (isRoll && DEPTS.find(d => d[1] === local.slice(7, 9).toUpperCase())) || picked
  const roll = isRoll ? local.toUpperCase() : `7376251${dept[1]}${String(iint(1, 299)).padStart(3, '0')}`

  // 1. raw numbers (attendance + mark components)
  // Internal 1 and Internal 2 are each out of 50. `ia` (out of 50) is their average, so the final total stays consistent everywhere.
  const raw = D.subjects.map(s => {
    const present = Math.min(s.total, Math.round(s.total * (0.58 + r() * 0.4)))
    const ia1 = int(30, 48), ia2 = int(30, 48)
    return { ...s, present, ia1, ia2, ia: Math.round((ia1 + ia2) / 2), lab: s.lab ? int(15, 25) : 0, asg: int(15, 25) }
  })
  // 2. everything else is calculated from those, so every page agrees
  const subjects = raw.map(s => {
    const max = 50 + (s.lab ? 25 : 0) + 25, score = s.ia + s.lab + s.asg
    return { ...s, max, score, internal: Math.round((score / max) * 50), marks: Math.round((score / max) * 100) } // internal = total internal mark out of 50
  })
  const present = subjects.reduce((a, s) => a + s.present, 0), total = subjects.reduce((a, s) => a + s.total, 0)
  const avg = Math.round(subjects.reduce((a, s) => a + s.marks, 0) / subjects.length)
  const step = 2 + (hash(email + seed) % 3)
  const trend = ['IA 1', 'IA 2', 'Model', 'Sem 1'].map((l, i) => ({ l, v: Math.max(40, Math.min(99, avg - (3 - i) * step)) }))
  const cgpa = Math.min(9.9, +(avg / 10).toFixed(1))

  const k = int(0, D.timetable.length - 1)
  const timetable = D.timetable.map((c, i) => { const o = D.timetable[(i + k) % D.timetable.length]; return { t: c.t, s: o.s, r: o.r, who: o.who } })

  const assignments = D.assignments.map(a => ({ ...a, status: r() < 0.4 ? 'Submitted' : 'Pending' }))
  if (!assignments.some(a => a.status === 'Pending')) assignments[0] = { ...assignments[0], status: 'Pending' }

  const notifs = []
  const add = (type, text, time, read = false) => notifs.push({ id: notifs.length + 1, type, text, time, read })
  subjects.filter(s => pct(s.present, s.total) < 75).slice(0, 2).forEach(s => add('attendance', `${s.n} attendance is ${pct(s.present, s.total)}%. Minimum is 75%`, '3h ago'))
  const due = assignments.filter(a => a.status === 'Pending').sort((a, b) => a.due.localeCompare(b.due))[0]
  if (due) add('assignment', `${due.t} is due on ${due.due}`, '1h ago')
  add('lab', 'Lab availability updated for this week', 'Yesterday', true)
  add('event', 'Hackathon 2026 starts tomorrow at 9 AM', '2d ago', true)

  const activity = [...assignments.filter(a => a.status === 'Submitted').map(a => `Submitted ${a.t}`), 'Checked lab availability', 'Viewed attendance report'].slice(0, 4)

  const student = { ...D.student, name, email, roll, dept: dept[0], cgpa, credits: int(16, 28) }
  const schedule = studentWeek(student, subjects.map(x => x.n))
  return {
    student, schedule, personal: studentPersonal(email, student.year),
    subjects, trend, timetable, assignments, notifs, activity, attendance: pct(present, total),
  }
}

// Each staff member handles one subject, or one subject plus its lab, across different years.
const GROUPS = [['Python Programming', 'Python Programming Lab'], ['Web Design', 'Web Design Lab'], ['Engineering Mathematics'], ['Engineering Physics', 'Engineering Physics Lab'], ['Communication Skills']]
const SUBS = [...D.submissions, { id: 4, who: 'Mohan K', t: 'Calculus problem set 4', at: 'Today 07:55' }, { id: 5, who: 'Rahul T', t: 'Pendulum lab report', at: 'Yesterday' }]
const ROLES = ['Assistant Professor', 'Associate Professor', 'Professor', 'Lab Instructor']
const SDEPTS = ['CSE', 'IT', 'ECE', 'AI&DS']

export function makeStaff(email, name, seed = '') {
  const local = email.split('@')[0]
  const idr = rng(hash(email)) // identity: same email, same department, role and subject
  const profile = { dept: SDEPTS[Math.floor(idr() * 4)], role: ROLES[Math.floor(idr() * 4)] }
  const group = GROUPS[Math.floor(idr() * GROUPS.length)]
  profile.subject = group[0]
  const r = rng(hash(email + seed)) // new sections and submissions on every login
  const int = (a, b) => a + Math.floor(r() * (b - a + 1))
  const s0 = int(0, SUBS.length - 1), n = int(2, 4), sec0 = int(0, SECTIONS.length - 1)
  // the same subject taught to a different year in each class group (1st to 4th year)
  const groups = YEARS.map((y, i) => `${y} ${profile.dept}-${SECTIONS[(sec0 + i) % SECTIONS.length]}`)
  // 7 periods a day (Mon-Sat), 2 or 3 of them free. Sunday is fully free.
  const schedule = DAYS.map((_, d) => {
    const free = new Set(), want = int(2, 3)
    while (free.size < want) free.add(int(1, DAY_PERIODS.length))
    return DAY_PERIODS.map(p => {
      if (free.has(p.n)) return { n: p.n, t: p.t, free: true, title: 'Free period', meta: '' }
      const cls = groups[(d * 2 + p.n) % groups.length], sub = group[(d + p.n) % group.length]
      return { n: p.n, t: p.t, free: false, cls, sub, title: `${cls} · ${sub}`, meta: '' }
    })
  })
  schedule.push(DAY_PERIODS.map(p => ({ n: p.n, t: p.t, free: true, title: 'Free period', meta: '' })))
  const ref = Math.min((new Date().getDay() + 6) % 7, 5)
  const classes = [...new Set(schedule[ref].filter(x => !x.free).map(x => `${x.cls} · ${x.sub}`))]
  const submissions = Array.from({ length: n }, (_, i) => SUBS[(s0 + i) % SUBS.length])
  const notifs = [
    { id: 1, type: 'assignment', text: `${submissions.length} new submissions to review`, time: '1h ago', read: false },
    { id: 2, type: 'lab', text: 'You can book labs from the Lab Booking page', time: 'Yesterday', read: true },
    { id: 3, type: 'event', text: 'Hackathon 2026 starts tomorrow at 9 AM', time: '2d ago', read: true },
  ]
  const activity = ['Uploaded Unit 3 notes', `Entered IA 2 marks for ${profile.subject}`, 'Created assignment: File handling']
  return { profile, personal: staffPersonal(email, profile.dept, profile.role, profile.subject), classes, schedule, submissions, notifs, activity }
}
