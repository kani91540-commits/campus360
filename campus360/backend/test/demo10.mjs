// Shows that staff and students are in the same department, and that 10 students
// get a notification when staff create an assignment or book a lab.
// Start the backend first (npm start), then in another terminal:  node test/demo10.mjs
const base = process.env.API || 'http://localhost:4000/api'
const call = async (method, url, { token, body } = {}) => {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  let r
  try { r = await fetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined }) }
  catch { console.error('Cannot reach the backend. Run "npm start" in the backend folder first.'); process.exit(1) }
  return { status: r.status, data: await r.json().catch(() => ({})) }
}
const login = async (email, password, role) => {
  const r = await call('POST', '/auth/login', { body: { email, password, role } })
  if (r.status !== 200) { console.error(`Login failed for ${email}: ${r.data.error}`); process.exit(1) }
  return r.data
}
const ymd = d => d.toLocaleDateString('en-CA') // 2026-10-12

// 10 students of 1st Year CSE-A (Kani and the next nine roll numbers)
const emails = ['kani@kpriet.ac.in', ...Array.from({ length: 9 }, (_, i) => `7376251cs1${String(i + 2).padStart(2, '0')}@kpriet.ac.in`)]

const staff = await login('meena@kpriet.ac.in', 'staff123', 'staff')
console.log(`Staff: ${staff.user.name} | ${staff.user.dept} | teaches ${staff.user.subject}\n`)

const stamp = new Date().toTimeString().slice(0, 5), title = `Demo assignment ${stamp}`
const due = new Date(); due.setDate(due.getDate() + 7)
const a = await call('POST', '/staff/assignments', { token: staff.token, body: { title, description: 'Created by the demo script.', due: ymd(due) } })
console.log(a.status === 201 ? `1. Assignment created: "${title}"` : `1. Assignment FAILED: ${a.data.error}`)

let booked = null
for (let d = 1; d <= 14 && !booked; d++) {
  const day = new Date(); day.setDate(day.getDate() + d)
  for (const lab of ['Computer Lab 1', 'Computer Lab 2', 'Computer Lab 3', 'Computer Lab 4']) {
    for (let block = 0; block < 4 && !booked; block++) {
      const r = await call('POST', '/staff/lab-bookings', { token: staff.token, body: { lab, date: ymd(day), block, purpose: 'Python practice' } })
      if (r.status === 201) booked = r.data.booking
    }
    if (booked) break
  }
}
console.log(booked ? `2. Lab booked: ${booked.lab} on ${booked.date}, ${booked.label}\n` : '2. Lab booking FAILED (no free slot found)\n')

console.log('Student'.padEnd(14) + 'Email'.padEnd(34) + 'Dept'.padEnd(6) + 'Assignment  Lab')
let good = 0
for (const email of emails) {
  const s = await login(email, 'student123', 'student')
  const n = (await call('GET', '/notifications', { token: s.token })).data.items || []
  const gotA = n.some(x => x.type === 'assignment' && x.text.includes(title))
  const gotL = booked ? n.some(x => x.type === 'lab' && x.text.includes(booked.date)) : false
  const sameDept = s.user.dept === staff.user.dept
  if (gotA && gotL && sameDept) good++
  console.log(s.user.name.padEnd(14) + email.padEnd(34) + (sameDept ? s.user.dept : 'DIFF').padEnd(6) + `${gotA ? 'yes' : 'NO'}`.padEnd(12) + (gotL ? 'yes' : 'NO'))
}
console.log(`\n${good} of ${emails.length} students are in ${staff.user.dept} and received both notifications.`)
process.exit(good === emails.length ? 0 : 1)
