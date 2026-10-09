// Mock weekly lab timetable for every Year / Class / Section.
// Built once when the app loads. Same input always gives the same timetable.
export const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']
export const CLASSES = ['CSE', 'IT', 'ECE', 'AI&DS']
export const SECTIONS = ['A', 'B', 'C']
export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const PERIODS = [
  { n: 1, t: '09:00-09:50' }, { n: 2, t: '09:50-10:40' }, { n: 3, t: '10:55-11:45' }, { n: 4, t: '11:45-12:35' },
  { n: 5, t: '13:30-14:20' }, { n: 6, t: '14:20-15:10' }, { n: 7, t: '15:10-16:00' }, { n: 8, t: '16:00-16:50' },
]
// A teaching day has 7 periods (P1-P7). Set TEACH_PERIODS to 8 to use every period above.
export const TEACH_PERIODS = 7
export const DAY_PERIODS = PERIODS.slice(0, TEACH_PERIODS)
export const periodKey = n => `P${n}`
export const periodText = key => { const m = /^P(\d)$/.exec(key || ''); return m && PERIODS[m[1] - 1] ? `${key} (${PERIODS[m[1] - 1].t})` : key }
export const dayIndex = (d = new Date()) => (d.getDay() + 6) % 7 // 0 = Mon ... 6 = Sun
export const dayOfDate = s => dayIndex(new Date(`${s}T00:00:00`))
export const inPeriod = (n, now = new Date()) => {
  const [a, b] = PERIODS[n - 1].t.split('-').map(x => { const [h, m] = x.split(':'); return +h * 60 + +m })
  const m = now.getHours() * 60 + now.getMinutes()
  return m >= a && m < b
}
// A lab session takes two periods in a row.
export const BLOCKS = [[1, 2], [3, 4], [5, 6], [7, 8]]
export const blockTime = b => `${PERIODS[BLOCKS[b][0] - 1].t.split('-')[0]}-${PERIODS[BLOCKS[b][1] - 1].t.split('-')[1]}`
export const blockLabel = b => `Period ${BLOCKS[b][0]}-${BLOCKS[b][1]}`

const SUBJ = {
  CSE: [['Python Programming Lab'], ['Data Structures Lab', 'Database Lab'], ['Networks Lab', 'Operating Systems Lab'], ['Cloud Computing Lab', 'Project Lab']],
  IT: [['Web Design Lab'], ['Data Structures Lab', 'Web Technology Lab'], ['Software Engineering Lab', 'Mobile App Lab'], ['Cloud Lab', 'Project Lab']],
  ECE: [['Basic Electrical Lab'], ['Circuits Lab', 'Digital Electronics Lab'], ['Microcontroller Lab', 'Communication Lab'], ['VLSI Lab', 'Project Lab']],
  'AI&DS': [['Python Programming Lab'], ['Data Structures Lab', 'Python for Data Lab'], ['Machine Learning Lab', 'Data Visualization Lab'], ['Deep Learning Lab', 'Project Lab']],
}
const PHYSICS = 'Engineering Physics Lab'
const COMP_ROOMS = ['Computer Lab 1', 'Computer Lab 2', 'Computer Lab 3', 'Computer Lab 4']
const ECE_ROOMS = ['Electronics Lab', 'Electronics Lab 2']

const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

function build() {
  const r = rng(360), roomUsed = new Set(), all = []
  YEARS.forEach((year, yi) => CLASSES.forEach(cls => SECTIONS.forEach(sec => {
    const subs = [...(yi === 0 ? [PHYSICS] : []), ...SUBJ[cls][yi]]
    const slotUsed = new Set(), dayUsed = new Set()
    subs.forEach(sub => {
      const rooms = sub === PHYSICS ? ['Physics Lab'] : cls === 'ECE' ? ECE_ROOMS : COMP_ROOMS
      const cand = []
      DAYS.forEach((_, d) => BLOCKS.forEach((__, b) => rooms.forEach(room => cand.push([d, b, room]))))
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]] }
      const free = ([d, b, room]) => !roomUsed.has(`${room}|${d}|${b}`) && !slotUsed.has(`${d}|${b}`)
      const pick = cand.find(c => free(c) && !dayUsed.has(c[0])) || cand.find(free)
      if (!pick) return
      const [day, block, lab] = pick
      roomUsed.add(`${lab}|${day}|${block}`); slotUsed.add(`${day}|${block}`); dayUsed.add(day)
      all.push({ year, cls, sec, day, block, lab, sub })
    })
  })))
  return all
}
const ALL = build()
export const labsFor = (year, cls, sec) => ALL.filter(s => s.year === year && s.cls === cls && s.sec === sec)

// Pre-select the student's own year and department.
export function fromProfile(st = {}) {
  const yi = ['First', 'Second', 'Third', 'Fourth'].findIndex(w => (st.year || '').startsWith(w))
  const cls = CLASSES.find(c => (st.dept || '').replace(/^BE\s*/i, '') === c) || CLASSES[0]
  return { year: YEARS[yi < 0 ? 0 : yi], cls, sec: 'A' }
}
