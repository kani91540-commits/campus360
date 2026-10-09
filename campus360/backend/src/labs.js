// Fixed weekly lab timetable for every class. Same algorithm and seed as the frontend labTimetable.js.
import { YEARS, DEPTS, SECTIONS, DAYS, BLOCKS, rng } from './util.js'

const SUBJ = {
  CSE: [['Python Programming Lab'], ['Data Structures Lab', 'Database Lab'], ['Networks Lab', 'Operating Systems Lab'], ['Cloud Computing Lab', 'Project Lab']],
  IT: [['Web Design Lab'], ['Data Structures Lab', 'Web Technology Lab'], ['Software Engineering Lab', 'Mobile App Lab'], ['Cloud Lab', 'Project Lab']],
  ECE: [['Basic Electrical Lab'], ['Circuits Lab', 'Digital Electronics Lab'], ['Microcontroller Lab', 'Communication Lab'], ['VLSI Lab', 'Project Lab']],
  'AI&DS': [['Python Programming Lab'], ['Data Structures Lab', 'Python for Data Lab'], ['Machine Learning Lab', 'Data Visualization Lab'], ['Deep Learning Lab', 'Project Lab']],
}
const PHYSICS = 'Engineering Physics Lab'
const COMP_ROOMS = ['Computer Lab 1', 'Computer Lab 2', 'Computer Lab 3', 'Computer Lab 4']
const ECE_ROOMS = ['Electronics Lab', 'Electronics Lab 2']
export const LAB_ROOMS = [...COMP_ROOMS, 'Physics Lab', ...ECE_ROOMS]

function build() {
  const r = rng(360), roomUsed = new Set(), all = []
  YEARS.forEach((year, yi) => DEPTS.forEach(cls => SECTIONS.forEach(sec => {
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
      all.push({ classKey: `${year} ${cls}-${sec}`, year, cls, sec, day, block, lab, sub })
    })
  })))
  return all
}
export const ALL_SESSIONS = build()
const byClass = new Map()
ALL_SESSIONS.forEach(s => { if (!byClass.has(s.classKey)) byClass.set(s.classKey, []); byClass.get(s.classKey).push(s) })
export const labsOfClass = k => (byClass.get(k) || []).slice().sort((a, b) => a.day - b.day || a.block - b.block)
export const sessionsAt = (lab, day, block) => ALL_SESSIONS.filter(s => s.lab === lab && s.day === day && s.block === block)
