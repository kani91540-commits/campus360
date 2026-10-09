// Shared constants and small helpers.
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status } }
export const bad = m => new HttpError(400, m)

export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']
export const DEPTS = ['CSE', 'IT', 'ECE', 'AI&DS']
export const DEPT_CODE = { CSE: 'CS', IT: 'IT', ECE: 'EC', 'AI&DS': 'AD' }
export const SECTIONS = ['A', 'B', 'C']
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const PERIODS = [
  { n: 1, t: '09:00-09:50' }, { n: 2, t: '09:50-10:40' }, { n: 3, t: '10:55-11:45' }, { n: 4, t: '11:45-12:35' },
  { n: 5, t: '13:30-14:20' }, { n: 6, t: '14:20-15:10' }, { n: 7, t: '15:10-16:00' }, { n: 8, t: '16:00-16:50' },
]
export const DAY_PERIODS = PERIODS.slice(0, 7) // a teaching day has 7 periods
export const BLOCKS = [[1, 2], [3, 4], [5, 6], [7, 8]] // a lab session is two periods in a row
export const blockTime = b => `${PERIODS[BLOCKS[b][0] - 1].t.split('-')[0]}-${PERIODS[BLOCKS[b][1] - 1].t.split('-')[1]}`
export const blockLabel = b => `Period ${BLOCKS[b][0]}-${BLOCKS[b][1]}`

export const SUBJECTS = [
  { id: 1, name: 'Python Programming', credits: 4, lab: true },
  { id: 2, name: 'Web Design', credits: 3, lab: true },
  { id: 3, name: 'Engineering Mathematics', credits: 4, lab: false },
  { id: 4, name: 'Engineering Physics', credits: 3, lab: true },
  { id: 5, name: 'Communication Skills', credits: 2, lab: false },
]
export const subjectById = id => SUBJECTS.find(s => s.id === id)
export const ROOMS = { 1: 'A-201', 2: 'A-203', 3: 'A-204', 4: 'B-110', 5: 'A-205' }

export const classKey = (yi, dept, sec) => `${YEARS[yi]} ${dept}-${sec}`
export function parseClassKey(k) {
  const m = /^(\d)(?:st|nd|rd|th) Year (.+)-([A-Z])$/.exec(k || '')
  if (!m || +m[1] < 1 || +m[1] > 4 || !DEPTS.includes(m[2]) || !SECTIONS.includes(m[3])) return null
  return { yi: +m[1] - 1, dept: m[2], sec: m[3] }
}

export const hash = s => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return h >>> 0 }
export const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

const p2 = n => String(n).padStart(2, '0')
export const fmtDate = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const todayISO = () => fmtDate(new Date())
export const isISO = s => { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; const d = new Date(`${s}T00:00:00`); return !Number.isNaN(d.getTime()) && fmtDate(d) === s }
export const dayIdx = d => (d.getDay() + 6) % 7 // 0 = Mon ... 6 = Sun
export const dayOfISO = s => dayIdx(new Date(`${s}T00:00:00`))

// ---- validation helpers ----
export const str = (v, name, { max = 200, optional = false } = {}) => {
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) { if (optional) return ''; throw bad(`${name} is required`) }
  if (s.length > max) throw bad(`${name} is too long (max ${max} characters)`)
  return s
}
export const int = (v, name, lo, hi) => {
  const n = Number(v)
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < lo || n > hi) throw bad(`${name} must be a whole number from ${lo} to ${hi}`)
  return n
}

// ---- grades and CGPA ----
export const gradePoint = m => (m >= 91 ? 10 : m >= 81 ? 9 : m >= 71 ? 8 : m >= 61 ? 7 : m >= 56 ? 6 : m >= 50 ? 5 : 0)
export const gradeLetter = m => (m >= 91 ? 'O' : m >= 81 ? 'A+' : m >= 71 ? 'A' : m >= 61 ? 'B+' : m >= 56 ? 'B' : m >= 50 ? 'C' : 'U')

export const BANDS = [
  { index: 0, label: 'Below 6.5', level: 'Foundation', ideas: [
    'Run a weekly remedial hour on basic concepts, using the Foundation question bank.',
    'Pair each student with a 9+ CGPA peer mentor for doubt clearing.',
    'Take a short 10-mark test every week and share the mark with the student the same day.',
    'Track attendance closely. Call the student and parent after two absences in a row.',
    'Give previous-year 2-mark questions first, then move to 13-mark questions.',
    'Set a small target (for example +0.5 SGPA next semester) and review it at mid-semester.',
    'Help clear arrears early with a fixed study plan before the next exam.',
  ] },
  { index: 1, label: '6.5 - 7.5', level: 'Basic', ideas: [
    'Give a mix of 2-mark and 13-mark questions from every unit.',
    'Hold a weekly quiz on the units where their internal marks were low.',
    'Make sure lab records and assignments are submitted on time.',
    'Form study groups of 4 with one 8.5+ student in each group.',
  ] },
  { index: 2, label: '7.5 - 8.5', level: 'Intermediate', ideas: [
    'Give problem-based questions and previous university papers.',
    'Ask them to explain one topic to the class each month.',
    'Give extension assignments or a mini project for each unit.',
  ] },
  { index: 3, label: '8.5 - 9.0', level: 'Advanced', ideas: [
    'Give application and analytical questions.',
    'Ask them to mentor students in the lower bands.',
    'Encourage certification courses and GATE-style practice.',
  ] },
  { index: 4, label: '9.0 - 10', level: 'Top performers', ideas: [
    'Give high-order questions, case studies and research-style problems.',
    'Involve them in hackathons, paper presentations and open-source work.',
    'Make them peer mentors for the Below 6.5 group.',
    'Guide them towards internships and higher-study preparation.',
  ] },
]
export const bandOf = c => (c < 6.5 ? 0 : c < 7.5 ? 1 : c < 8.5 ? 2 : c < 9 ? 3 : 4)
export const semsDone = yi => yi * 2 + 1 // semesters finished before the current one
// SGPA needed next semester to lift the CGPA to 6.5 (every semester counts equally).
export const sgpaNeeded = (cgpa, yi) => { const n = semsDone(yi); return +(6.5 * (n + 1) - cgpa * n).toFixed(1) }
