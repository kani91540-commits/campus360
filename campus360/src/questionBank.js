// CGPA bands, mock class rosters and improvement ideas for the staff Question Bank page.
export const BANDS = [
  { id: 'b0', label: 'Below 6.5', level: 'Foundation', tone: 'red', ideas: [
    'Run a weekly remedial hour on basic concepts, using the Foundation question bank.',
    'Pair each student with a 9+ CGPA peer mentor for doubt clearing.',
    'Take a short 10-mark test every week and share the mark with the student the same day.',
    'Track attendance closely. Call the student and parent after two absences in a row.',
    'Give previous-year 2-mark questions first, then move to 13-mark questions.',
    'Set a small target (for example +0.5 SGPA next semester) and review it at mid-semester.',
    'Help clear arrears early with a fixed study plan before the next exam.',
  ] },
  { id: 'b1', label: '6.5 - 7.5', level: 'Basic', tone: 'amber', ideas: [
    'Give a mix of 2-mark and 13-mark questions from every unit.',
    'Hold a weekly quiz on the units where their internal marks were low.',
    'Make sure lab records and assignments are submitted on time.',
    'Form study groups of 4 with one 8.5+ student in each group.',
  ] },
  { id: 'b2', label: '7.5 - 8.5', level: 'Intermediate', tone: 'blue', ideas: [
    'Give problem-based questions and previous university papers.',
    'Ask them to explain one topic to the class each month.',
    'Give extension assignments or a mini project for each unit.',
  ] },
  { id: 'b3', label: '8.5 - 9.0', level: 'Advanced', tone: 'teal', ideas: [
    'Give application and analytical questions.',
    'Ask them to mentor students in the lower bands.',
    'Encourage certification courses and GATE-style practice.',
  ] },
  { id: 'b4', label: '9.0 - 10', level: 'Top performers', tone: 'green', ideas: [
    'Give high-order questions, case studies and research-style problems.',
    'Involve them in hackathons, paper presentations and open-source work.',
    'Make them peer mentors for the Below 6.5 group.',
    'Guide them towards internships and higher-study preparation.',
  ] },
]
export const bandOf = c => (c < 6.5 ? 0 : c < 7.5 ? 1 : c < 8.5 ? 2 : c < 9 ? 3 : 4)

const hash = s => { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return h >>> 0 }
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const NAMES = ['Aarav', 'Divya', 'Mohan', 'Nisha', 'Rahul', 'Kavin', 'Priya', 'Sanjay', 'Harini', 'Vikram', 'Meena', 'Arjun', 'Lakshmi', 'Karthik', 'Swetha',
  'Naveen', 'Anitha', 'Dinesh', 'Pooja', 'Surya', 'Revathi', 'Ganesh', 'Janani', 'Bharath', 'Keerthi', 'Yogesh', 'Sowmya', 'Tarun', 'Ishwarya', 'Prakash']
const INITIALS = 'ABCDEGHJKLMNPRSTV'
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

// Semesters completed so far, used for the "SGPA needed" estimate. 1st year, sem 2 running = 1 completed.
export const semsDone = group => YEARS.indexOf(group.split(' ').slice(0, 2).join(' ')) * 2 + 1
// SGPA needed next semester to bring the CGPA up to 6.5 (all semesters weighted equally).
export const sgpaNeeded = (cgpa, group) => { const n = semsDone(group); return +(6.5 * (n + 1) - cgpa * n).toFixed(1) }

// Mock students for each class group the staff member teaches. Same email = same roster.
export function rosterFor(email, groups) {
  return groups.flatMap(g => {
    const r = rng(hash(`${email}|${g}`)), [yr1, yr2, ds] = g.split(' '), [dept, sec] = ds.split('-')
    const yi = Math.max(0, YEARS.indexOf(`${yr1} ${yr2}`))
    return Array.from({ length: 36 }, (_, i) => {
      const z = Math.sqrt(-2 * Math.log(r() || 0.5)) * Math.cos(2 * Math.PI * r())
      const cgpa = +Math.min(9.9, Math.max(4.8, 7.7 + z)).toFixed(1)
      return {
        id: `${g}-${i}`, group: g, cgpa,
        name: `${NAMES[Math.floor(r() * NAMES.length)]} ${INITIALS[Math.floor(r() * INITIALS.length)]}`,
        roll: `${25 - yi}${dept.replace('&', '')}${sec}${String(i + 1).padStart(2, '0')}`,
      }
    })
  })
}
