import { useState, useEffect, useMemo, createContext, useContext, Fragment } from 'react'
import * as I from 'lucide-react'
import D from './data'
import { makeStudent, makeStaff, nameFromEmail, normEmail } from './users'
import { YEARS, CLASSES, SECTIONS, DAYS, PERIODS, BLOCKS, DAY_PERIODS, labsFor, blockTime, blockLabel, fromProfile, periodKey, periodText, dayIndex, dayOfDate, inPeriod } from './labTimetable'
import { BANDS, bandOf, rosterFor, sgpaNeeded } from './questionBank'
import { api } from './api'

/* ---------- helpers & shared components ---------- */
const Ctx = createContext()
const useApp = () => useContext(Ctx)
const useLS = (k, v, store = localStorage) => {
  const [s, set] = useState(() => { try { return JSON.parse(store.getItem(k)) ?? v } catch { return v } })
  useEffect(() => store.setItem(k, JSON.stringify(s)), [k, s])
  return [s, set]
}
// per-user storage: every email gets its own cart, orders, assignments, etc.
const useUS = (k, v) => { const { user } = useApp(); return useLS(`${k}:${user.email}:${user.seed}`, v) }
const pct = (p, t) => Math.round((p / t) * 100)

const Card = ({ title, action, children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 ${className}`}>
    {(title || action) && (
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-navy">{title}</h3>{action}
      </div>
    )}
    {children}
  </div>
)
const Btn = ({ v = 'solid', className = '', ...p }) => (
  <button {...p} className={`px-4 py-2 rounded-xl text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
    v === 'solid' ? 'bg-gradient-to-r from-teal-600 to-brand text-white hover:brightness-110' : 'bg-sky-50 text-brand hover:bg-blue-100'} ${className}`} />
)
const Tabs = ({ items, value, onChange }) => (
  <div className="flex gap-2 flex-wrap">
    {items.map(i => (
      <button key={i} onClick={() => onChange(i)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium ${value === i ? 'bg-brand text-white' : 'bg-white text-slate-600 hover:bg-sky-50'}`}>{i}</button>
    ))}
  </div>
)
const Bar = ({ value, low }) => (
  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
    <div className={`h-full rounded-full ${low ? 'bg-red-500' : 'bg-gradient-to-r from-teal-500 to-brand'}`} style={{ width: `${value}%` }} />
  </div>
)
const Badge = ({ children, tone = 'blue' }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
    { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700' }[tone]}`}>{children}</span>
)
const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-navy/60 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-navy text-lg">{title}</h3>
        <button onClick={onClose} aria-label="Close"><I.X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
)
const Search = ({ value, onChange, ph }) => (
  <div className="relative flex-1 min-w-[180px]">
    <I.Search size={16} className="absolute left-3 top-3 text-slate-400" />
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={ph}
      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm" />
  </div>
)
const Empty = ({ text }) => <p className="text-center text-sm text-slate-400 py-8">{text}</p>
const Input = p => <input {...p} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm" />
const Stat = ({ icon: Ic, label, value, sub }) => (
  <Card className="flex items-center gap-4">
    <div className="p-3 rounded-xl bg-sky-50 text-brand"><Ic size={22} /></div>
    <div><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-extrabold text-navy">{value}</p>{sub && <p className="text-xs text-slate-400">{sub}</p>}</div>
  </Card>
)

// One day as 7 periods. Used by the student and staff dashboards. `onBook` adds a Book lab button on periods the staff member teaches.
const WEEK = [...DAYS, 'Sun']
const BREAKS = { 2: 'Break · 10:40-10:55', 4: 'Lunch · 12:35-13:30' } // shown after that period
function DayPlan({ rows, onBook }) {
  return rows.map(r => {
    const live = inPeriod(r.n)
    return (
      <Fragment key={r.n}>
        <div className={`flex items-center gap-3 py-2.5 px-2 rounded-xl ${live ? 'bg-sky-50 ring-1 ring-brand/30' : ''}`}>
          <div className="w-[88px] shrink-0"><p className="text-xs font-bold text-brand">P{r.n}</p><p className="text-[11px] text-slate-400">{r.t}</p></div>
          {r.free ? (
            <div className="flex-1 flex items-center justify-between gap-2">
              <span className="text-sm text-slate-400">Free period</span>
            </div>
          ) : (
            <div className="flex-1 min-w-0"><p className="font-semibold text-navy text-sm">{r.title}</p>{r.meta && <p className="text-xs text-slate-500">{r.meta}</p>}</div>
          )}
          {onBook && !r.free && <Btn v="soft" className="!py-1 !px-3 !text-xs" onClick={() => onBook(r)}>Book lab</Btn>}
          {live && <Badge tone="green">Now</Badge>}
          {r.lab && <Badge>Lab</Badge>}
        </div>
        {BREAKS[r.n] && <p className="text-[11px] text-center text-slate-400 py-1">{BREAKS[r.n]}</p>}
      </Fragment>
    )
  })
}

/* ---------- logo & login ---------- */
// Put the real KPRIET logo at public/kpriet-logo.jpg. Until then a simple drawn version is shown.
function Logo({ size = 56, className = '' }) {
  const [ok, setOk] = useState(true)
  return (
    <div className={`bg-white rounded-2xl grid place-items-center shrink-0 overflow-hidden shadow-md ${className}`} style={{ width: size, height: size }}>
      {ok ? <img src="/kpriet-logo.jpg" alt="KPRIET logo" className="w-full h-full object-contain p-1" onError={() => setOk(false)} /> : (
        <svg viewBox="0 0 100 100" className="w-full h-full p-1" role="img" aria-label="KPRIET logo">
          <path d="M50 62 C40 45 42 28 50 16 C58 28 60 45 50 62Z" fill="#1E9E6A" />
          <path d="M46 64 C26 62 18 50 18 36 C34 36 44 48 46 64Z" fill="#1F86B5" />
          <path d="M54 64 C74 62 82 50 82 36 C66 36 56 48 54 64Z" fill="#1B4E9B" />
          <g fill="#1B4E9B" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="sans-serif">
            <text x="50" y="78">KPR Institute of</text><text x="50" y="87">Engineering and</text><text x="50" y="96">Technology</text>
          </g>
        </svg>
      )}
    </div>
  )
}
// Large faint copy of the college logo used as a background watermark (public/kpriet-logo.jpg)
function LogoMark({ className = '' }) {
  const [ok, setOk] = useState(true)
  if (!ok) return null
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute rounded-full overflow-hidden bg-white ${className}`}>
      <img src="/kpriet-logo.jpg" alt="" className="w-full h-full object-contain p-[14%]" onError={() => setOk(false)} />
    </div>
  )
}
const ADDRESS = 'KPR Institute of Engineering and Technology, Avinashi - Coimbatore Road, Arasur, Tamil Nadu 641407'
const FEATURES = [[I.GraduationCap, 'Academics & classroom navigation'], [I.CalendarCheck, 'Compact attendance management'], [I.Utensils, 'Zomato-style campus food ordering'], [I.Bus, 'Bus search, routes & live details']]

function Login({ onLogin }) {
  const [role, setRole] = useState('student')
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(id.trim()) || !pw) return setErr('Please enter your email address and password.')
    setErr(''); setBusy(true)
    try {
      const email = normEmail(id), seed = Math.random().toString(36).slice(2, 8)
      await api.login(email, pw, role) // the server checks the password
      onLogin({ role, email, name: nameFromEmail(id), seed })
    } catch (e) { setErr(e.message); setBusy(false) }
  }
  const field = 'w-full pl-12 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-700 placeholder:text-slate-400'
  return (
    <div className="relative overflow-hidden min-h-screen bg-gradient-to-br from-[#0B3E50] via-[#0E6B7A] to-[#2563EB] flex items-center justify-center p-4 sm:p-8 pb-20">
      <LogoMark className="w-[560px] h-[560px] -top-40 -right-40 opacity-[0.08]" />
      <LogoMark className="w-[420px] h-[420px] -bottom-48 -left-32 opacity-[0.07]" />
      <div className="relative z-[1] w-full max-w-6xl min-h-[600px] rounded-[2rem] overflow-hidden border border-white/40 shadow-2xl grid lg:grid-cols-[1.05fr_1fr] bg-white">
        <div className="hidden lg:flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-[#0B4A5C] via-[#0E6B7A] to-[#2563EB] p-12 text-white">
          <div className="absolute -bottom-52 -left-16 w-[560px] h-[560px] rounded-full bg-white/5" />
          <div className="absolute -bottom-32 left-10 w-[380px] h-[380px] rounded-full bg-white/5" />
          <LogoMark className="w-[360px] h-[360px] -bottom-16 -right-20 opacity-[0.12]" />
          <div className="relative">
            <div className="flex items-center gap-5">
              <Logo size={84} />
              <div><p className="text-xs font-bold tracking-[0.2em] text-blue-100">KPRIET</p><h1 className="text-4xl font-extrabold leading-tight">Campus 360</h1><p className="text-sm text-blue-50">One portal for your complete campus experience</p></div>
            </div>
            <ul className="mt-12 space-y-4">
              {FEATURES.map(([Ic, t]) => (
                <li key={t} className="flex items-center gap-4 text-sm"><span className="w-11 h-11 rounded-xl bg-white/10 grid place-items-center"><Ic size={20} /></span>{t}</li>
              ))}
            </ul>
          </div>
          <div className="relative border-t border-white/20 pt-5 text-xs text-blue-50">
            <p className="font-bold">KPR Institute of Engineering and Technology</p>
            <p className="mt-1">Avinashi - Coimbatore Road, Arasur, Tamil Nadu 641407</p>
          </div>
        </div>
        <div className="flex items-center justify-center p-8 sm:p-12">
          <form onSubmit={submit} noValidate className="w-full max-w-md space-y-5">
            <div className="lg:hidden flex items-center gap-3"><Logo size={52} /><div><p className="text-[10px] font-bold tracking-[0.2em] text-slate-500">KPRIET</p><p className="text-xl font-extrabold text-navy">Campus 360</p></div></div>
            <div>
              <h2 className="text-3xl font-semibold text-navy">Welcome back</h2>
              <p className="text-sm text-slate-500 mt-2">Sign in to access your academic, attendance, food, transport and campus services.</p>
            </div>
            <div className="grid grid-cols-2 bg-slate-100 rounded-xl p-1">
              {['student', 'staff'].map(r => (
                <button type="button" key={r} onClick={() => setRole(r)}
                  className={`py-2 rounded-lg text-sm font-semibold capitalize ${role === r ? 'bg-white shadow text-brand' : 'text-slate-500'}`}>{r}</button>
              ))}
            </div>
            <div>
              <label htmlFor="uid" className="block text-sm font-bold text-navy mb-2 capitalize">{role} Email</label>
              <div className="relative"><I.Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="uid" type="email" autoComplete="email" className={field} placeholder={`Enter your ${role} email`} value={id} onChange={e => setId(e.target.value)} /></div>
            </div>
            <div>
              <label htmlFor="pw" className="block text-sm font-bold text-navy mb-2">Password</label>
              <div className="relative"><I.Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input id="pw" type="password" className={field} placeholder="Enter your password" value={pw} onChange={e => setPw(e.target.value)} /></div>
            </div>
            {err && <p className="text-sm text-red-600 flex gap-1"><I.AlertCircle size={16} className="mt-0.5 shrink-0" />{err}</p>}
            <Btn className="w-full !py-3.5 !rounded-2xl !text-base font-bold shadow-lg flex items-center justify-center gap-2" disabled={busy}>{busy ? 'Signing in...' : <>Sign in to Campus 360 <I.ArrowRight size={18} /></>}</Btn>
            <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1"><I.Lock size={12} />Secure {role} portal • KPRIET Campus Services</p>
          </form>
        </div>
      </div>
      <div className="fixed bottom-0 inset-x-0 h-11 bg-[#0B1F33] text-white text-xs flex items-center overflow-hidden z-10">
        <span className="h-full px-4 flex items-center gap-1.5 font-bold bg-teal-600 shrink-0"><I.MapPin size={13} />CAMPUS</span>
        <div className="flex-1 overflow-hidden">
          <style>{'@keyframes c360ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
          <div className="flex w-max whitespace-nowrap hover:[animation-play-state:paused]" style={{ animation: 'c360ticker 25s linear infinite' }}>
            {[0, 1].map(k => <span key={k} className="flex">{[0, 1, 2, 3, 4, 5].map(j => <span key={j} className="px-6">{ADDRESS}<span className="ml-6">•</span></span>)}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- student pages ---------- */
function Dashboard() {
  const { setPage, notifs, me } = useApp()
  const [asg] = useUS('c360_asg', me.assignments)
  const avg = me.attendance
  const quick = [['navigation', 'Navigate', I.Map], ['food', 'Order food', I.Utensils], ['lab', 'Lab availability', I.FlaskConical], ['assignments', 'Assignments', I.ClipboardList]]
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-navy to-brand text-white p-6">
        <p className="text-blue-200 text-sm">Good day,</p>
        <h2 className="text-2xl font-extrabold">{me.student.name}</h2>
        <p className="text-sm text-blue-100">{me.student.dept} · {me.student.sem}</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={I.CalendarCheck} label="Attendance" value={`${avg}%`} sub="Overall" />
        <Stat icon={I.Award} label="CGPA" value={me.student.cgpa} sub="Out of 10" />
        <Stat icon={I.BookOpen} label="Credits" value={`${me.student.credits}/${me.student.totalCredits}`} sub="Earned" />
      </div>
      <div className="grid sm:grid-cols-4 gap-3">
        {quick.map(([id, l, Ic]) => (
          <button key={id} onClick={() => setPage(id)} className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 border border-slate-100 hover:shadow-md hover:-translate-y-0.5 transition">
            <Ic className="text-brand" /><span className="text-sm font-semibold text-navy">{l}</span>
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Today's timetable" action={<Badge>{WEEK[dayIndex()]} · 7 periods</Badge>}>
          {me.schedule[dayIndex()] ? <DayPlan rows={me.schedule[dayIndex()]} /> : <Empty text="No classes on Sunday." />}
        </Card>
        <Card title="Upcoming assignments" action={<Btn v="soft" onClick={() => setPage('assignments')}>View all</Btn>}>
          {asg.filter(a => a.status === 'Pending').slice(0, 3).map(a => (
            <div key={a.id} className="flex justify-between py-2 border-b last:border-0 border-slate-100 text-sm">
              <div><p className="font-semibold text-navy">{a.t}</p><p className="text-xs text-slate-500">{a.s}</p></div>
              <Badge tone="amber">{a.due}</Badge>
            </div>
          )) }
          {!asg.some(a => a.status === 'Pending') && <Empty text="All caught up. No pending assignments." />}
        </Card>
        <Card title="Notifications">
          {notifs.slice(0, 3).map(n => <p key={n.id} className={`text-sm py-2 border-b last:border-0 border-slate-100 ${n.read ? 'text-slate-400' : 'text-navy font-medium'}`}>{n.text}</p>)}
        </Card>
        <Card title="Recent activity">
          {me.activity.map(a => <p key={a} className="text-sm py-2 border-b last:border-0 border-slate-100 flex gap-2"><I.CircleDot size={14} className="text-brand mt-1 shrink-0" />{a}</p>)}
        </Card>
      </div>
    </div>
  )
}

const ROAD_Y = 31.5, ROAD_XS = [40, 66]
const SIDE = { car: 'top', cse: 'top', main: 'top', bike: 'bottom', food: 'bottom', ece: 'bottom', lib: 'left' } // which side of the building its road spur uses
const TREES = [[5, 6], [15, 5], [26, 6], [34, 5], [58, 6], [72, 5], [92, 6], [95, 22], [4, 24], [35, 27], [56, 25], [6, 40], [34, 38], [96, 40], [34, 52], [8, 56], [22, 58], [30, 62], [72, 56], [94, 56], [80, 62], [92, 66]]
const CAR_COLORS = ['#ef4444', '#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#0ea5e9']

// Where each place meets the road: `a` is on the building edge, `r` is the point on the road.
const spot = l => {
  const cx = l.x, cy = l.y * 0.7, s = SIDE[l.id]
  return s === 'left' ? { a: [cx - l.w / 2, cy], r: [ROAD_XS[0], cy] } : { a: [cx, s === 'top' ? cy - l.h / 2 : cy + l.h / 2], r: [cx, ROAD_Y] }
}
const kp = p => p.join(',')
// Road network as a graph, built from the places in data.js so the roads and the route always agree.
function buildGraph() {
  const g = {}
  const node = p => (g[kp(p)] = g[kp(p)] || { p, e: [] })
  const add = (p, q) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); node(p).e.push([kp(q), d]); node(q).e.push([kp(p), d]) }
  const chain = pts => pts.slice(1).forEach((q, i) => add(pts[i], q))
  const spots = D.locs.map(spot)
  const xs = [...new Set([3, 96, ...ROAD_XS, ...spots.filter(s => s.r[1] === ROAD_Y).map(s => s.r[0])])].sort((a, b) => a - b)
  chain(xs.map(x => [x, ROAD_Y]))
  ROAD_XS.forEach(x => {
    const ys = [...new Set([6, ROAD_Y, 66, ...spots.filter(s => s.r[0] === x && s.r[1] !== ROAD_Y).map(s => s.r[1])])].sort((a, b) => a - b)
    chain(ys.map(y => [x, y]))
  })
  spots.forEach(s => add(s.a, s.r))
  return g
}
const GRAPH = buildGraph()
// Shortest walk along the roads between two places.
function routeBetween(a, b) {
  const start = kp(spot(a).a), goal = kp(spot(b).a)
  const dist = { [start]: 0 }, prev = {}, todo = new Set(Object.keys(GRAPH))
  while (todo.size) {
    let u = null
    todo.forEach(k => { if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k })
    if (u === null || u === goal) break
    todo.delete(u)
    GRAPH[u].e.forEach(([v, d]) => { if (todo.has(v) && (dist[v] === undefined || dist[u] + d < dist[v])) { dist[v] = dist[u] + d; prev[v] = u } })
  }
  const nodes = []
  for (let k = goal; k !== undefined; k = prev[k]) { nodes.unshift(GRAPH[k].p); if (k === start) break }
  const pts = [[a.x, a.y * 0.7], ...nodes, [b.x, b.y * 0.7]]
  const len = pts.slice(1).reduce((t, p, i) => t + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0)
  return { pts, meters: Math.round(len * 5) } // 1 map unit is about 5 m
}

const Road = ({ pts, w, dash }) => {
  const p = pts.map(q => q.join(',')).join(' ')
  return (
    <g>
      <polyline points={p} fill="none" stroke="#a9b4c2" strokeWidth={w + 0.6} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={p} fill="none" stroke="#e3e8ef" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      {dash && <polyline points={p} fill="none" stroke="#fff" strokeWidth=".3" strokeDasharray="1.6 1.4" />}
    </g>
  )
}
const Windows = ({ x, y, w, rows }) => {
  const n = Math.max(2, Math.floor(w / 2.4)), gap = w / n
  return Array.from({ length: rows * n }, (_, i) => (
    <rect key={i} x={x + (i % n) * gap + gap * 0.22} y={y + Math.floor(i / n) * 2.1} width={gap * 0.56} height="1.1" rx=".2" fill="#fff" opacity=".9" />
  ))
}
function Building({ l }) {
  const { w, h, x: cx } = l, x = cx - w / 2, y = l.y * 0.7 - h / 2
  const ly = SIDE[l.id] === 'bottom' ? y - 2.4 : y + h + 2.4, tw = l.n.length * 1.3 + 3
  let body
  if (l.kind === 'parking') {
    const car = l.id === 'car', n = Math.floor((w - 2) / 1.8)
    body = (
      <g>
        <rect x={x} y={y} width={w} height={h} rx=".8" fill={car ? '#667085' : '#8a96a6'} stroke="#475467" strokeWidth=".35" />
        {car
          ? Array.from({ length: n }, (_, i) => (
            <g key={i}>
              <line x1={x + 1 + i * 1.8} y1={y + 1} x2={x + 1 + i * 1.8} y2={y + 3.6} stroke="#fff" strokeWidth=".2" />
              <line x1={x + 1 + i * 1.8} y1={y + h - 3.6} x2={x + 1 + i * 1.8} y2={y + h - 1} stroke="#fff" strokeWidth=".2" />
              {i % 3 !== 1 && <rect x={x + 1.35 + i * 1.8} y={y + 1.2} width="1.1" height="2.2" rx=".4" fill={CAR_COLORS[i % 6]} />}
              {i % 2 === 0 && <rect x={x + 1.35 + i * 1.8} y={y + h - 3.4} width="1.1" height="2.2" rx=".4" fill={CAR_COLORS[(i + 3) % 6]} />}
            </g>))
          : [0, 1].flatMap(r => [0, 1, 2, 3, 4].map(i => {
            const bx = x + 2.2 + i * 2.5, by = y + 2.4 + r * 3.2
            return (
              <g key={`${r}${i}`} fill="none" stroke="#fff" strokeWidth=".22">
                <circle cx={bx - 0.8} cy={by} r=".55" /><circle cx={bx + 0.8} cy={by} r=".55" /><path d={`M${bx - 0.8} ${by} L${bx - 0.1} ${by - 0.9} L${bx + 0.8} ${by}`} />
              </g>)
          }))}
        <circle cx={x + 0.2} cy={y + 0.2} r="1.5" fill="#2563EB" stroke="#fff" strokeWidth=".4" />
        <text x={x + 0.2} y={y + 0.9} textAnchor="middle" fontSize="2" fontWeight="800" fill="#fff">P</text>
      </g>
    )
  } else if (l.kind === 'block') {
    const main = l.id === 'main'
    body = (
      <g>
        <rect x={x} y={y} width={w} height={h} rx=".8" fill="url(#gBlue)" stroke="#1d4ed8" strokeWidth=".35" />
        <rect x={x} y={y + h - 2.2} width={w} height="2.2" rx=".8" fill="#1e40af" opacity=".18" />
        <Windows x={x + 0.8} y={y + 1.2} w={w - 1.6} rows={main ? 3 : 2} />
        <rect x={cx - 1.2} y={y + h - 2.2} width="2.4" height="2.2" rx=".3" fill="#1e3a8a" />
      </g>
    )
  } else if (l.kind === 'food') {
    const n = Math.floor(w / 1.5)
    body = (
      <g>
        <rect x={x} y={y} width={w} height={h} rx=".8" fill="url(#gOrange)" stroke="#ea580c" strokeWidth=".35" />
        {Array.from({ length: n }, (_, i) => <rect key={i} x={x + i * (w / n)} y={y} width={w / n} height="1.9" fill={i % 2 ? '#fff' : '#f97316'} />)}
        {[0, 1, 2].map(i => <circle key={i} cx={x + 2.2 + i * 3.8} cy={y + h - 2} r=".8" fill="#fff" stroke="#f97316" strokeWidth=".3" />)}
      </g>
    )
  } else {
    body = (
      <g>
        <polygon points={`${x + 0.6},${y} ${cx},${y - 2.4} ${x + w - 0.6},${y}`} fill="#e9defc" stroke="#7c3aed" strokeWidth=".35" strokeLinejoin="round" />
        <rect x={x} y={y} width={w} height={h} rx=".6" fill="url(#gViolet)" stroke="#7c3aed" strokeWidth=".35" />
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={x + 1.4 + i * ((w - 2.8) / 5) - 0.3} y={y + 1.2} width=".6" height={h - 3} fill="#fff" opacity=".9" />)}
        <rect x={x - 0.4} y={y + h - 1.2} width={w + 0.8} height="1.2" rx=".3" fill="#cbb5f5" />
      </g>
    )
  }
  return (
    <g>
      <g filter="url(#sh)">{body}</g>
      <rect x={cx - tw / 2} y={ly - 1.6} width={tw} height="3.2" rx="1.6" fill="#fff" opacity=".93" stroke="#cbd5e1" strokeWidth=".2" />
      <text x={cx} y={ly + 0.15} textAnchor="middle" dominantBaseline="middle" fontSize="2.2" fontWeight="700" fill="#0A1A3F">{l.n}</text>
    </g>
  )
}

// Drawn campus map (no image file). Uses the places in data.js. `route` is the walking path to draw.
function CampusArt({ route, go }) {
  const d = route ? `M${route.pts.map(p => p.join(' ')).join(' L')}` : ''
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 70" aria-hidden="true">
      <defs>
        <linearGradient id="gGrass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eaf6e3" /><stop offset="1" stopColor="#d6ebcc" /></linearGradient>
        <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#eff5ff" /><stop offset="1" stopColor="#b9d0ff" /></linearGradient>
        <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff1e0" /><stop offset="1" stopColor="#ffc790" /></linearGradient>
        <linearGradient id="gViolet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6f0ff" /><stop offset="1" stopColor="#d8c6fb" /></linearGradient>
        <filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx=".4" dy=".7" stdDeviation=".45" floodColor="#0f172a" floodOpacity=".28" /></filter>
      </defs>
      <rect width="100" height="70" fill="url(#gGrass)" />
      <ellipse cx="53" cy="12.5" rx="8" ry="3.8" fill="#bcdcf5" stroke="#8fbfe6" strokeWidth=".4" />
      <ellipse cx="51" cy="11.6" rx="3" ry=".9" fill="#fff" opacity=".5" />
      {TREES.map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x + 0.5} cy={y + 0.6} r="1.9" fill="#3f7d3a" opacity=".22" />
          <circle cx={x} cy={y} r="1.8" fill="#8fc77f" />
          <circle cx={x - 0.5} cy={y - 0.5} r=".9" fill="#b3dfa3" />
        </g>
      ))}
      <Road pts={[[3, ROAD_Y], [96, ROAD_Y]]} w={5} dash />
      {ROAD_XS.map(x => <Road key={x} pts={[[x, 6], [x, 66]]} w={5} dash />)}
      {D.locs.map(l => { const s = spot(l); return <Road key={l.id} pts={[s.a, s.r]} w={2.4} /> })}
      {D.locs.map(l => <Building key={l.id} l={l} />)}
      {route && (
        <g>
          <path d={d} fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke="#2563EB" strokeWidth="1.1" strokeDasharray="2 1.4" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dashoffset" from="0" to="-3.4" dur=".7s" repeatCount="indefinite" />
          </path>
          {go && (
            <circle key={d} r="1.3" fill="#16a34a" stroke="#fff" strokeWidth=".5">
              <animateMotion path={d} dur={`${Math.max(4, route.meters / 20)}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      )}
      <g transform="translate(93 6)">
        <circle r="3.4" fill="#fff" opacity=".92" stroke="#cbd5e1" strokeWidth=".2" />
        <polygon points="0,-2.6 1.1,0.6 0,0 -1.1,0.6" fill="#dc2626" /><text y="2.7" textAnchor="middle" fontSize="1.7" fontWeight="800" fill="#0A1A3F">N</text>
      </g>
      <g transform="translate(4 66.5)">
        <rect width="20" height="1" fill="#fff" stroke="#0A1A3F" strokeWidth=".2" /><rect width="10" height="1" fill="#0A1A3F" />
        <text y="-.7" fontSize="1.8" fontWeight="700" fill="#0A1A3F">0</text><text x="20" y="-.7" textAnchor="end" fontSize="1.8" fontWeight="700" fill="#0A1A3F">100 m</text>
      </g>
    </svg>
  )
}

function CampusNav() {
  const { say } = useApp()
  const [q, setQ] = useState(''), [from, setFrom] = useState('car'), [to, setTo] = useState(''), [go, setGo] = useState(false)
  const L = id => D.locs.find(l => l.id === id)
  const a = L(from), b = L(to), ready = a && b && from !== to
  const route = useMemo(() => (ready ? routeBetween(a, b) : null), [from, to])
  const meters = route ? route.meters : 0, mins = Math.max(1, Math.ceil(meters / 80))
  const hits = D.locs.filter(l => `${l.n} ${l.b}`.toLowerCase().includes(q.toLowerCase()))
  const pick = id => { setTo(id); setGo(false) }
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2" title="Campus map">
        <div className="relative mx-auto w-full max-w-[860px] rounded-xl overflow-hidden border border-slate-200 shadow-inner" style={{ aspectRatio: '100 / 70' }}>
          <CampusArt route={route} go={go} />
          {D.locs.map(l => {
            const on = hits.includes(l), role = l.id === to ? 'to' : l.id === from ? 'from' : ''
            return (
              <button key={l.id} title={l.n} onClick={() => pick(l.id)} style={{ left: `${l.x}%`, top: `${l.y}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition ${on ? '' : 'opacity-25'} ${role ? 'z-10' : ''}`}>
                {role === 'from' && <span className="absolute inset-0 rounded-full bg-green-500 opacity-60 animate-ping" />}
                <span className={`relative w-6 h-6 rounded-full grid place-items-center text-[10px] font-extrabold text-white border-2 border-white shadow-lg ${role === 'to' ? 'bg-brand scale-125' : role === 'from' ? 'bg-green-600' : 'bg-red-600'}`}>{l.no}</span>
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-4 justify-center">
          {D.locs.map(l => (
            <button key={l.id} onClick={() => pick(l.id)} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${l.id === to ? 'bg-brand text-white border-brand' : 'bg-white text-navy border-slate-200 hover:border-brand'}`}>
              <b>{l.no}</b> {l.n}
            </button>
          ))}
        </div>
      </Card>
      <Card title="Find a route">
        <div className="space-y-3">
          <Search value={q} onChange={setQ} ph="Search location" />
          <select value={from} onChange={e => { setFrom(e.target.value); setGo(false) }} className="w-full p-2 rounded-xl border border-slate-200 text-sm">
            {D.locs.map(l => <option key={l.id} value={l.id}>From: {l.n}</option>)}
          </select>
          <select value={to} onChange={e => { setTo(e.target.value); setGo(false) }} className="w-full p-2 rounded-xl border border-slate-200 text-sm">
            <option value="">To: choose a place</option>
            {D.locs.map(l => <option key={l.id} value={l.id}>To: {l.n}</option>)}
          </select>
          {ready ? (
            <div className="bg-sky-50 rounded-xl p-3 text-sm text-navy">
              <p className="font-bold">{a.n} to {b.n}</p>
              <p className="text-slate-500">About {mins} min walk · {meters} m</p>
              <p className="text-xs text-slate-400 mt-1">{b.b}</p>
            </div>
          ) : <Empty text="Pick two different places to see a route." />}
          <Btn className="w-full" disabled={!ready} onClick={() => { setGo(true); say(`Navigating to ${b.n}`) }}>Start navigation</Btn>
          {go && <ol className="text-sm space-y-1 list-decimal ml-5"><li>Leave {a.n}</li><li>Follow the campus road for about {meters} m</li><li>Arrive at {b.n}</li></ol>}
          <p className="text-xs text-slate-400">Simple map, not to scale. Walking time and distance are estimates.</p>
        </div>
      </Card>
    </div>
  )
}

const SHOP_TAG = { 'Royal Kitchen': 'bg-amber-100 text-amber-800', Mario: 'bg-red-100 text-red-700', Saral: 'bg-pink-100 text-pink-700' }
// Shows a photo only when the item has an `img` in data.js. No `img` means no picture area.
const FoodImg = ({ f }) => {
  const [bad, setBad] = useState(false)
  if (!f.img || bad) return null
  return <img src={f.img} alt={f.n} loading="lazy" onError={() => setBad(true)} className="w-full h-36 object-cover rounded-xl mb-3" />
}

function Food() {
  const { say, notify } = useApp()
  const [q, setQ] = useState(''), [cat, setCat] = useState('All'), [pick, setPick] = useState('12:30')
  const [cart, setCart] = useUS('c360_cart', {}), [orders, setOrders] = useUS('c360_orders', [])
  const steps = ['Placed', 'Preparing', 'Ready', 'Picked up']
  useEffect(() => {
    const t = setInterval(() => setOrders(o => o.map(x => (x.step < 3 ? { ...x, step: x.step + 1 } : x))), 6000)
    return () => clearInterval(t)
  }, [])
  const items = D.foods.filter(f => (cat === 'All' || f.s === cat) && `${f.n} ${f.s}`.toLowerCase().includes(q.toLowerCase()))
  const lines = D.foods.filter(f => cart[f.id])
  const total = lines.reduce((a, f) => a + f.p * cart[f.id], 0)
  const chg = (id, d) => setCart(c => { const n = (c[id] || 0) + d; const x = { ...c }; n <= 0 ? delete x[id] : (x[id] = n); return x })
  const place = () => {
    const id = 1043 + orders.length
    setOrders(o => [{ id, total, pick, step: 0 }, ...o]); setCart({})
    notify(`Order #${id} placed. Pickup at ${pick}`, 'food'); say('Order placed')
  }
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex gap-3 flex-wrap"><Search value={q} onChange={setQ} ph="Search food" /></div>
        <Tabs items={['All', ...D.shops.map(s => s.n)]} value={cat} onChange={setCat} />
        {cat !== 'All' && <p className="text-sm text-slate-500">{cat}: {D.shops.find(s => s.n === cat)?.tag}</p>}
        {items.length ? (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map(f => (
              <Card key={f.id} className="flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <FoodImg f={f} />
                  <span className={`inline-block text-xs font-semibold rounded-full px-2 py-0.5 ${SHOP_TAG[f.s] || 'bg-sky-100 text-brand'}`}>{f.s}</span>
                  <p className="font-semibold text-navy mt-2">{f.n}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-lg font-extrabold text-navy">₹{f.p}</span>
                  <Btn onClick={() => chg(f.id, 1)}>Add to cart</Btn>
                </div>
              </Card>
            ))}
          </div>
        ) : <Empty text="No food matches your search." />}
      </div>
      <div className="space-y-4">
        <Card title="Your cart">
          {lines.length === 0 && <Empty text="Your cart is empty. Add something tasty." />}
          {lines.map(f => (
            <div key={f.id} className="flex items-center justify-between py-2 text-sm">
              <span>{f.n}<span className="block text-xs text-slate-400">{f.s}</span></span>
              <span className="flex items-center gap-2">
                <button onClick={() => chg(f.id, -1)} aria-label="Less"><I.Minus size={16} /></button>{cart[f.id]}
                <button onClick={() => chg(f.id, 1)} aria-label="More"><I.Plus size={16} /></button>
              </span>
            </div>
          ))}
          {lines.length > 0 && (
            <div className="space-y-3 mt-3 border-t pt-3">
              <label className="text-sm block">Pickup time
                <select value={pick} onChange={e => setPick(e.target.value)} className="w-full mt-1 p-2 rounded-xl border border-slate-200">
                  {['12:00', '12:30', '13:00', '13:30'].map(t => <option key={t}>{t}</option>)}
                </select>
              </label>
              <p className="font-bold text-navy flex justify-between"><span>Total</span><span>₹{total}</span></p>
              <Btn className="w-full" onClick={place}>Place order</Btn>
            </div>
          )}
        </Card>
        <Card title="Order status">
          {orders.length === 0 && <Empty text="No orders yet." />}
          {orders.slice(0, 3).map(o => (
            <div key={o.id} className="mb-4 text-sm">
              <p className="font-semibold text-navy">#{o.id} · ₹{o.total} · pickup {o.pick}</p>
              <div className="flex gap-1 mt-2">{steps.map((s, i) => <div key={s} className={`flex-1 h-1.5 rounded-full ${i <= o.step ? 'bg-brand' : 'bg-slate-200'}`} />)}</div>
              <p className="text-xs text-slate-500 mt-1">{steps[o.step]}</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

function Attendance() {
  const { me } = useApp()
  const total = me.subjects.reduce((a, s) => a + s.total, 0), pres = me.subjects.reduce((a, s) => a + s.present, 0)
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={I.CalendarCheck} label="Overall" value={`${pct(pres, total)}%`} />
        <Stat icon={I.CheckCircle2} label="Classes attended" value={`${pres}/${total}`} />
        <Stat icon={I.AlertTriangle} label="Below 75%" value={me.subjects.filter(s => pct(s.present, s.total) < 75).length} sub="Subjects" />
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {me.subjects.map(s => {
          const p = pct(s.present, s.total), low = p < 75
          const need = Math.ceil((0.75 * s.total - s.present) / 0.25)
          return (
            <Card key={s.id}>
              <div className="flex justify-between mb-2"><p className="font-semibold text-navy">{s.n}</p><Badge tone={low ? 'red' : 'green'}>{p}%</Badge></div>
              <Bar value={p} low={low} />
              <p className="text-xs text-slate-500 mt-2">{s.present} present of {s.total} classes</p>
              {low && <p className="text-xs text-red-600 mt-2 flex gap-1"><I.AlertTriangle size={14} />Attend the next {need} classes to reach 75%.</p>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- labs: staff book, students only see availability ---------- */
const LAB_KEY = 'c360_labbk' // shared by everyone so student view reflects staff bookings
const today = () => new Date().toISOString().slice(0, 10)
const blocked = (lab, date, i) => (i + lab.length + date.charCodeAt(9)) % 4 === 0 // demo: slots held by other departments
// Lab bookings are made by period: slot is 'P1' ... 'P7'.
const slotInfo = (bk, lab, date, t, i) => {
  const b = bk.find(x => x.lab === lab && x.date === date && x.slot === t)
  if (b) return { taken: true, label: `Booked by ${b.by}` }
  if (blocked(lab, date, i)) return { taken: true, label: 'Reserved by another department' }
  return { taken: false, label: 'Free' }
}
const byWhen = (a, b) => (a.date + a.slot).localeCompare(b.date + b.slot)

function Lab() {
  const [tab, setTab] = useState('My class labs')
  return (
    <div className="space-y-4">
      <Tabs items={['My class labs', 'Lab slots']} value={tab} onChange={setTab} />
      {tab === 'My class labs' ? <LabClass /> : <LabSlots />}
    </div>
  )
}

const Pick = ({ label, value, onChange, items }) => (
  <label className="text-sm block font-medium text-navy">{label}
    <select value={value} onChange={onChange} className="w-full mt-1 p-2 rounded-xl border border-slate-200 text-sm font-normal bg-white">
      {items.map(i => <option key={i}>{i}</option>)}
    </select>
  </label>
)

// Student picks Year / Class / Section and sees only that class's lab timetable.
function LabClass() {
  const { me } = useApp()
  const [sel, setSel] = useUS('c360_labsel', fromProfile(me.student))
  const set = k => e => setSel(s => ({ ...s, [k]: e.target.value }))
  const list = labsFor(sel.year, sel.cls, sel.sec).sort((a, b) => a.day - b.day || a.block - b.block)
  const now = new Date(), td = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes()
  const startMin = b => { const [h, m] = PERIODS[BLOCKS[b][0] - 1].t.split('-')[0].split(':'); return +h * 60 + +m }
  const next = list.find(s => s.day > td || (s.day === td && startMin(s.block) > nowMin)) || list[0]
  return (
    <div className="space-y-5">
      <Card title="Choose your class">
        <div className="grid sm:grid-cols-3 gap-3">
          <Pick label="Year" value={sel.year} onChange={set('year')} items={YEARS} />
          <Pick label="Class" value={sel.cls} onChange={set('cls')} items={CLASSES} />
          <Pick label="Section" value={sel.sec} onChange={set('sec')} items={SECTIONS} />
        </div>
        {next && (
          <p className="mt-4 text-sm bg-sky-50 text-navy rounded-xl p-3">
            <b>Next lab:</b> {next.sub} in {next.lab}, {DAYS[next.day]} {blockLabel(next.block)} ({blockTime(next.block)})
          </p>
        )}
      </Card>
      <Card title={`Weekly lab timetable: ${sel.year}, ${sel.cls} ${sel.sec}`}>
        {list.length === 0 && <Empty text="No lab sessions found for this class." />}
        {list.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-1">
                <thead>
                  <tr><th className="w-12" />{PERIODS.map(p => (
                    <th key={p.n} className="text-xs font-semibold text-slate-500 pb-1">P{p.n}<span className="block font-normal text-[10px] text-slate-400">{p.t}</span></th>
                  ))}</tr>
                </thead>
                <tbody>
                  {DAYS.map((d, di) => (
                    <tr key={d}>
                      <td className={`text-xs font-bold ${di === td ? 'text-brand' : 'text-navy'}`}>{d}</td>
                      {BLOCKS.map((_, bi) => {
                        const s = list.find(x => x.day === di && x.block === bi)
                        return (
                          <td key={bi} colSpan={2}>
                            {s
                              ? <div className="rounded-xl bg-brand text-white p-2"><p className="text-xs font-semibold">{s.sub}</p><p className="text-[11px] text-blue-100">{s.lab}</p></div>
                              : <div className="rounded-xl bg-slate-50 h-12" />}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-3">Break 10:40-10:55 · Lunch 12:35-13:30. Empty slots are regular classes.</p>
          </>
        )}
      </Card>
      <Card title="Your lab sessions">
        {list.map(s => (
          <div key={`${s.day}-${s.block}`} className="flex flex-wrap items-center justify-between gap-2 py-3 border-b last:border-0 border-slate-100 text-sm">
            <div><p className="font-semibold text-navy">{s.sub}</p><p className="text-xs text-slate-500">{s.lab}</p></div>
            <div className="text-right">
              <p className="font-semibold text-navy">{DAYS[s.day]} · {blockLabel(s.block)}</p>
              <p className="text-xs text-slate-500">{blockTime(s.block)}</p>
            </div>
            {s.day === td && <Badge tone="green">Today</Badge>}
          </div>
        ))}
      </Card>
    </div>
  )
}

function LabSlots() {
  const [bk] = useLS(LAB_KEY, [])
  const [lab, setLab] = useState(D.labs[0]), [date, setDate] = useState(today())
  const upcoming = bk.filter(b => b.date >= today()).sort(byWhen)
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Lab availability">
        <div className="space-y-3">
          <select value={lab} onChange={e => setLab(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 text-sm">{D.labs.map(l => <option key={l}>{l}</option>)}</select>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <p className="text-sm font-semibold text-navy">Periods</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DAY_PERIODS.map((p, i) => {
              const s = slotInfo(bk, lab, date, periodKey(p.n), i)
              return (
                <div key={p.n} title={s.label} className={`py-2 rounded-xl text-center border ${s.taken ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  <p className="text-sm font-bold">P{p.n}</p><p className="text-[10px]">{p.t}</p><p className="text-[11px] font-medium">{s.taken ? 'Booked' : 'Free'}</p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500">Labs are booked by faculty. Ask your lab in-charge if you need a slot.</p>
        </div>
      </Card>
      <Card title="Scheduled lab sessions">
        {upcoming.length === 0 && <Empty text="No lab sessions have been scheduled yet." />}
        {upcoming.map(b => (
          <div key={b.id} className="py-2 border-b last:border-0 border-slate-100 text-sm">
            <p className="font-semibold text-navy">{b.lab}</p>
            <p className="text-xs text-slate-500">{b.date} · {periodText(b.slot)} · {b.by}{b.cls ? ` · ${b.cls}` : ''}</p>
          </div>
        ))}
      </Card>
    </div>
  )
}

function StaffLab() {
  const { say, notify, user, me } = useApp()
  const [bk, setBk] = useLS(LAB_KEY, [])
  const [pick, setPick] = useUS('c360_labpick', null) // set when staff taps "Book lab" on a free period of the dashboard
  const [lab, setLab] = useState(D.labs[0]), [date, setDate] = useState(today()), [slot, setSlot] = useState(pick ? periodKey(pick) : '')
  useEffect(() => { if (pick) setPick(null) }, [])
  const plan = me.schedule[dayOfDate(date)] || []
  const teachCount = plan.filter(r => !r.free).length
  const row = plan.find(r => periodKey(r.n) === slot), cls = row?.title
  const mine = bk.filter(b => b.email === user.email && b.date >= today()).sort(byWhen)
  const book = () => {
    if (date < today()) return say('Pick today or a future date', 'err')
    if (!slot) return say('Choose a period to book', 'err')
    if (!row || row.free) return say('You can only book a lab in a period you teach', 'err')
    if (bk.some(b => b.lab === lab && b.date === date && b.slot === slot)) return say('That period was just taken', 'err')
    setBk(b => [...b, { id: Date.now(), lab, date, slot, cls, by: user.name, email: user.email }])
    notify(`${lab} booked for ${date}, ${periodText(slot)}`, 'lab'); say('Lab booked'); setSlot('')
  }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Book a lab">
        <div className="space-y-3">
          <select value={lab} onChange={e => { setLab(e.target.value); setSlot('') }} className="w-full p-2 rounded-xl border border-slate-200 text-sm">{D.labs.map(l => <option key={l}>{l}</option>)}</select>
          <Input type="date" min={today()} value={date} onChange={e => { setDate(e.target.value); setSlot('') }} />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">Which of your periods do you want to book?</p>
            <Badge tone="green">{teachCount} teaching on {WEEK[dayOfDate(date)]}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DAY_PERIODS.map((p, i) => {
              const rw = plan[i] || { free: true }, k = periodKey(p.n), s = slotInfo(bk, lab, date, k, i)
              const off = s.taken || rw.free
              const note = rw.free ? 'Free period: no class' : s.taken ? s.label : rw.title
              return (
                <button key={p.n} disabled={off} title={note} onClick={() => setSlot(k)}
                  className={`p-2 rounded-xl text-left border ${slot === k ? 'bg-brand text-white border-brand' : 'bg-white border-slate-200 hover:border-brand'} disabled:bg-slate-100 disabled:text-slate-400 disabled:hover:border-slate-200`}>
                  <span className="flex justify-between text-sm font-bold"><span>P{p.n}</span><span className="text-[11px] font-medium">{p.t}</span></span>
                  <span className={`block text-[11px] truncate ${slot === k ? 'text-blue-100' : ''}`}>{note}</span>
                </button>
              )
            })}
          </div>
          {cls && <p className="text-xs text-slate-500">Booking for: <b className="text-navy">{cls}</b></p>}
          <Btn className="w-full" disabled={!slot || date < today()} onClick={book}>{slot ? `Book ${lab}, ${periodText(slot)}` : 'Book lab'}</Btn>
        </div>
      </Card>
      <Card title="My bookings">
        {mine.length === 0 && <Empty text="No bookings yet. Pick a lab and a period." />}
        {mine.map(b => (
          <div key={b.id} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-100 text-sm">
            <div><p className="font-semibold text-navy">{b.lab}</p><p className="text-xs text-slate-500">{b.date} · {periodText(b.slot)}{b.cls ? ` · ${b.cls}` : ''}</p></div>
            <div className="flex gap-2 items-center"><Badge tone="green">Confirmed</Badge>
              <button onClick={() => setBk(x => x.filter(y => y.id !== b.id))} aria-label="Cancel booking"><I.Trash2 size={16} className="text-red-500" /></button></div>
          </div>
        ))}
      </Card>
    </div>
  )
}
function Academics() {
  const { me } = useApp()
  const [sel, setSel] = useState(null)
  const tot = useMemo(() => { const internal = Math.round(me.subjects.reduce((x, s) => x + s.internal, 0) / me.subjects.length); return { internal, p: internal * 2 } }, [me])
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat icon={I.Award} label="CGPA" value={me.student.cgpa} />
        <Stat icon={I.BookOpen} label="Credits" value={`${me.student.credits}/${me.student.totalCredits}`} />
        <Stat icon={I.Layers} label="Current" value="Sem 2" sub={me.student.year} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Academic progress">
          <div className="flex items-end gap-4 h-44">
            {me.trend.map(t => (
              <div key={t.l} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs font-bold text-navy">{t.v}%</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-sky-300" style={{ height: `${t.v}%` }} />
                <span className="text-xs text-slate-500 mt-1">{t.l}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Subject performance">
          {me.subjects.map(s => (
            <div key={s.id} className="py-2">
              <div className="flex justify-between text-sm mb-1"><span className="font-semibold text-navy">{s.n}</span>
                <button className="text-brand font-semibold" onClick={() => setSel(s)}>View details</button></div>
              <Bar value={s.marks} /><p className="text-xs text-slate-500 mt-1">{s.marks}%</p>
            </div>
          ))}
        </Card>
      </div>
      <Card title="Internal marks and final total">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead><tr className="text-left text-xs text-slate-500 border-b">
              <th className="py-2 pr-2">Subject</th><th className="px-2 text-center">IA 1 /50</th><th className="px-2 text-center">IA 2 /50</th>
              <th className="px-2 text-center">Lab /25</th><th className="px-2 text-center">Assign /25</th><th className="px-2 text-center">Total internal /50</th>
            </tr></thead>
            <tbody>
              {me.subjects.map(s => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-2 font-semibold text-navy">{s.n}</td>
                  <td className="px-2 text-center">{s.ia1}</td><td className="px-2 text-center">{s.ia2}</td>
                  <td className="px-2 text-center">{s.max === 100 ? s.lab : '-'}</td><td className="px-2 text-center">{s.asg}</td>
                  <td className="px-2 text-center font-bold text-navy">{s.internal}/50</td>

                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-sky-50 font-bold text-navy">
              <td className="py-2.5 px-2 rounded-l-xl" colSpan={5}>Overall (average)</td>
              <td className="px-2 text-center rounded-r-xl">{tot.internal}/50</td>
            </tr></tfoot>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3">Total internal /50 combines the average of IA 1 and IA 2, lab (if any) and assignments, scaled to 50.</p>
      </Card>
      {sel && (
        <Modal title={sel.n} onClose={() => setSel(null)}>
          {[['Internal 1', sel.ia1, 50], ['Internal 2', sel.ia2, 50], ['Internal average (IA 1 + IA 2) / 2', sel.ia, 50], ['Lab', sel.lab, 25], ['Assignments', sel.asg, 25]]
            .filter(([l]) => l !== 'Lab' || sel.max === 100).map(([l, v, m]) => (
            <p key={l} className="flex justify-between py-2 border-b text-sm"><span>{l}</span><b>{v}/{m}</b></p>
          ))}
          <p className="mt-3 text-xs text-slate-500">Combined: {sel.score}/{sel.max}</p>
          <p className="font-bold text-navy">Total internal: {sel.internal}/50</p>
        </Modal>
      )}
    </div>
  )
}

function Assignments() {
  const { say, notify, me } = useApp()
  const [list, setList] = useUS('c360_asg', me.assignments)
  const [f, setF] = useState('All'), [view, setView] = useState(null), [sub, setSub] = useState(null), [file, setFile] = useState('')
  const rows = list.filter(a => f === 'All' || a.status === f)
  const submit = () => {
    if (!file) return say('Choose a file before submitting', 'err')
    setList(l => l.map(a => (a.id === sub.id ? { ...a, status: 'Submitted' } : a)))
    notify(`${sub.t} submitted`, 'assignment'); say('Assignment submitted'); setSub(null); setFile('')
  }
  return (
    <div className="space-y-4">
      <Tabs items={['All', 'Pending', 'Submitted']} value={f} onChange={setF} />
      <Card>
        {rows.length === 0 && <Empty text="Nothing here." />}
        {rows.map(a => (
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b last:border-0 border-slate-100">
            <div><p className="font-semibold text-navy">{a.t}</p><p className="text-xs text-slate-500">{a.s} · Due {a.due}</p></div>
            <div className="flex items-center gap-2">
              <Badge tone={a.status === 'Submitted' ? 'green' : 'amber'}>{a.status}</Badge>
              <Btn v="soft" onClick={() => setView(a)}>View</Btn>
              {a.status === 'Pending' && <Btn onClick={() => setSub(a)}>Submit</Btn>}
            </div>
          </div>
        ))}
      </Card>
      {view && <Modal title={view.t} onClose={() => setView(null)}><p className="text-sm">Subject: {view.s}</p><p className="text-sm">Due: {view.due}</p><p className="text-sm mt-2 text-slate-500">Follow the lab manual and upload a PDF or ZIP.</p></Modal>}
      {sub && (
        <Modal title={`Submit: ${sub.t}`} onClose={() => setSub(null)}>
          <input type="file" onChange={e => setFile(e.target.files[0]?.name || '')} className="text-sm mb-4" />
          <Btn className="w-full" onClick={submit}>Submit assignment</Btn>
        </Modal>
      )}
    </div>
  )
}

function Events() {
  const { say } = useApp()
  const [q, setQ] = useState(''), [c, setC] = useState('All'), [open, setOpen] = useState(null), [reg, setReg] = useUS('c360_reg', [])
  const rows = D.events.filter(e => (c === 'All' || e.c === c) && e.n.toLowerCase().includes(q.toLowerCase()))
  const join = e => { setReg(r => [...r, e.id]); say(`Registered for ${e.n}`) }
  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap"><Search value={q} onChange={setQ} ph="Search events" />
        <select value={c} onChange={e => setC(e.target.value)} className="p-2 rounded-xl border border-slate-200 text-sm">
          {['All', 'Tech', 'Workshop', 'Sports', 'Cultural'].map(x => <option key={x}>{x}</option>)}</select></div>
      {rows.length === 0 && <Empty text="No events match your filters." />}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map(e => (
          <Card key={e.id}>
            <div className="flex justify-between"><Badge>{e.c}</Badge><span className="text-sm font-bold text-brand">{e.date}</span></div>
            <p className="font-bold text-navy mt-3">{e.n}</p>
            <p className="text-xs text-slate-500 flex gap-1 mt-1"><I.MapPin size={14} />{e.where}</p>
            <div className="flex gap-2 mt-4">
              <Btn v="soft" onClick={() => setOpen(e)}>Details</Btn>
              {reg.includes(e.id) ? <Badge tone="green">Registered</Badge> : <Btn onClick={() => join(e)}>Register</Btn>}
            </div>
          </Card>
        ))}
      </div>
      {open && <Modal title={open.n} onClose={() => setOpen(null)}><p className="text-sm">{open.d}</p><p className="text-sm mt-2 text-slate-500">{open.date} · {open.where}</p></Modal>}
    </div>
  )
}

function Transport() {
  const [track, setTrack] = useState(null), [pos, setPos] = useState(0)
  useEffect(() => {
    if (!track) return
    setPos(0); const t = setInterval(() => setPos(p => (p >= 100 ? 100 : p + 5)), 500)
    return () => clearInterval(t)
  }, [track])
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-4">
        {D.routes.map(r => (
          <Card key={r.id}>
            <p className="font-bold text-navy">{r.n}</p>
            <p className="text-sm mt-2">Next bus <b className="text-brand">{r.next}</b> · then {r.then}</p>
            <p className="text-xs text-slate-500 mt-2">Pickup points: {r.stops.slice(0, -1).join(', ')}</p>
            <Btn className="w-full mt-4" onClick={() => setTrack(r)}>Track transport</Btn>
          </Card>
        ))}
      </div>
      {track ? (
        <Card title={`Live: ${track.n}`}>
          <div className="relative mx-4 my-8 h-1 bg-slate-200 rounded">
            <div className="absolute h-1 bg-brand rounded" style={{ width: `${pos}%` }} />
            <I.Bus className="absolute -top-3 text-brand bg-white rounded" style={{ left: `calc(${pos}% - 12px)` }} />
            {track.stops.map((s, i) => (
              <div key={s} className="absolute -top-1.5" style={{ left: `${(i / (track.stops.length - 1)) * 100}%` }}>
                <div className="w-4 h-4 rounded-full bg-white border-4 border-brand -ml-2" />
                <p className="text-xs mt-2 -ml-6 w-16 text-center">{s}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-center mt-10">{pos >= 100 ? 'Arrived at campus' : 'Bus is on the way'}</p>
        </Card>
      ) : <Empty text="Choose a route and select Track transport to see the bus move." />}
    </div>
  )
}

const nIcon = { assignment: I.ClipboardList, attendance: I.AlertTriangle, food: I.Utensils, lab: I.FlaskConical, event: I.PartyPopper }
function Notifications() {
  const { notifs, setNotifs } = useApp()
  const [f, setF] = useState('all')
  const rows = notifs.filter(n => f === 'all' || n.type === f)
  return (
    <div className="space-y-4">
      <div className="flex justify-between flex-wrap gap-3">
        <Tabs items={['all', 'assignment', 'attendance', 'food', 'lab', 'event']} value={f} onChange={setF} />
        <Btn v="soft" onClick={() => setNotifs(n => n.map(x => ({ ...x, read: true })))}>Mark all as read</Btn>
      </div>
      <Card>
        {rows.length === 0 && <Empty text="No notifications in this category." />}
        {rows.map(n => {
          const Ic = nIcon[n.type] || I.Bell
          return (
            <div key={n.id} className={`flex gap-3 items-center py-3 border-b last:border-0 border-slate-100 ${n.read ? 'opacity-60' : ''}`}>
              <div className="p-2 rounded-xl bg-sky-50 text-brand"><Ic size={18} /></div>
              <div className="flex-1"><p className="text-sm font-medium text-navy">{n.text}</p><p className="text-xs text-slate-400">{n.time}</p></div>
              {!n.read && <Btn v="soft" onClick={() => setNotifs(x => x.map(y => (y.id === n.id ? { ...y, read: true } : y)))}>Mark as read</Btn>}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

const EDITABLE = [['phone', 'Phone'], ['gender', 'Gender'], ['bloodGroup', 'Blood group'], ['address', 'Address'], ['emergencyName', 'Emergency contact name'], ['emergencyPhone', 'Emergency contact phone']]
function Profile() {
  const { user, me, say } = useApp()
  const staff = user.role === 'staff'
  const [extra, setExtra] = useUS('c360_profile', {})
  const [form, setForm] = useState(null)
  const p = { ...me.personal, ...extra }, show = v => v || 'Not set'
  const sections = staff ? [
    ['Employment', [['Name', user.name], ['Employee ID', p.empId], ['Department', me.profile.dept], ['Designation', me.profile.role], ['Subject handled', me.profile.subject], ['Official email', user.email], ['Date of joining', p.joined], ['Experience', p.experience], ['Cabin', p.cabin]]],
    ['Qualification', [['Highest qualification', p.qualification], ['Specialization', p.specialization]]],
    ['Personal details', [['Date of birth', p.dob], ['Gender', show(p.gender)], ['Blood group', p.bloodGroup], ['Phone', p.phone], ['Address', p.address]]],
    ['Emergency contact', [['Name', show(p.emergencyName)], ['Phone', show(p.emergencyPhone)]]],
  ] : [
    ['Academic details', [['Name', me.student.name], ['Roll number', me.student.roll], ['Department', me.student.dept], ['Year', me.student.year], ['Semester', me.student.sem], ['Section', p.section], ['Batch', p.batch], ['Class mentor', p.mentor], ['College email', user.email]]],
    ['Personal details', [['Date of birth', p.dob], ['Gender', show(p.gender)], ['Blood group', p.bloodGroup], ['Phone', p.phone], ['Address', p.address], ['Residence', p.residence]]],
    ['Parent / guardian', [['Name', p.parentName], ['Phone', p.parentPhone]]],
    ['Emergency contact', [['Name', show(p.emergencyName)], ['Phone', show(p.emergencyPhone)]]],
  ]
  const save = () => { setExtra(x => ({ ...x, ...form })); setForm(null); say('Profile updated') }
  return (
    <div className="space-y-5 max-w-3xl">
      <Card>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-navy text-white grid place-items-center text-2xl font-bold">{user.name[0]}</div>
          <div className="flex-1"><p className="font-bold text-navy text-lg">{user.name}</p><div className="flex gap-2 mt-1"><Badge>{user.role}</Badge><Badge tone="green">{staff ? me.profile.dept : me.student.dept}</Badge></div></div>
          <Btn v="soft" onClick={() => setForm(Object.fromEntries(EDITABLE.map(([k]) => [k, p[k] || ''])))}>Edit details</Btn>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-5">
        {sections.map(([title, rows]) => (
          <Card key={title} title={title}>
            {rows.map(([k, v]) => <p key={k} className="flex justify-between gap-4 py-2 border-b last:border-0 text-sm"><span className="text-slate-500 shrink-0">{k}</span><b className="text-navy text-right break-words min-w-0">{v}</b></p>)}
          </Card>
        ))}
      </div>
      {form && (
        <Modal title="Edit personal details" onClose={() => setForm(null)}>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {EDITABLE.map(([k, l]) => (
              <label key={k} className="block text-xs text-slate-500">{l}
                {k === 'gender' ? (
                  <select value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
                    <option value="">Not set</option><option>Male</option><option>Female</option><option>Other</option>
                  </select>
                ) : k === 'bloodGroup' ? (
                  <select value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700">
                    {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                ) : <div className="mt-1"><Input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>}
              </label>
            ))}
          </div>
          <Btn className="mt-4 w-full" onClick={save}>Save changes</Btn>
        </Modal>
      )}
    </div>
  )
}

function Settings() {
  const { say } = useApp()
  const [o, setO] = useUS('c360_set', { assignment: true, attendance: true, food: true, event: false })
  return (
    <div className="space-y-4 max-w-xl">
      <Card title="Notification preferences">
        {Object.keys(o).map(k => (
          <label key={k} className="flex justify-between py-2 text-sm capitalize cursor-pointer">{k} alerts
            <input type="checkbox" checked={o[k]} onChange={() => setO(x => ({ ...x, [k]: !x[k] }))} className="w-5 h-5 accent-brand" /></label>
        ))}
      </Card>
      <Card title="Demo data">
        <Btn onClick={() => { localStorage.clear(); say('Demo data reset. Reloading'); setTimeout(() => location.reload(), 800) }}>Reset all demo data</Btn>
      </Card>
    </div>
  )
}

/* ---------- staff pages ---------- */
function StaffHome() {
  const { me, user, setPage } = useApp()
  const [pending] = useUS('c360_subs', me.submissions)
  const [, setPick] = useUS('c360_labpick', null)
  const rows = me.schedule[dayIndex()], busy = rows.filter(r => !r.free).length
  const [bk] = useLS(LAB_KEY, [])
  const todays = bk.filter(b => b.email === user.email && b.date === today()).length
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-r from-navy to-brand text-white p-6">
        <p className="text-blue-200 text-sm">Welcome,</p>
        <h2 className="text-2xl font-extrabold">{user.name}</h2>
        <p className="text-sm text-blue-100">{me.profile.role} · {me.profile.dept}</p>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat icon={I.Presentation} label="Classes today" value={busy} sub={`of ${rows.length} periods`} />
        <Stat icon={I.Clock} label="Free periods" value={rows.length - busy} sub="Today" />
        <Stat icon={I.FlaskConical} label="Lab bookings" value={todays} sub="Today" />
        <Stat icon={I.Inbox} label="Pending submissions" value={pending.length} />
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Today's periods" action={<Badge tone="green">{WEEK[dayIndex()]} · {rows.length - busy} free</Badge>}>
          <DayPlan rows={rows} onBook={r => { setPick(r.n); setPage('lab') }} />
        </Card>
        <Card title="Recent activity">{me.activity.map(a => <p key={a} className="py-2 border-b last:border-0 text-sm">{a}</p>)}</Card>
      </div>
    </div>
  )
}
function StaffAttendance() {
  const { say, me } = useApp()
  const [cls, setCls] = useState(me.classes[0]), [p, setP] = useState(() => Object.fromEntries(D.students.map(s => [s, true])))
  return (
    <Card title="Mark attendance" className="max-w-xl">
      <select value={cls} onChange={e => setCls(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 text-sm mb-3">{me.classes.map(c => <option key={c}>{c}</option>)}</select>
      {D.students.map(s => (
        <label key={s} className="flex justify-between py-2 border-b text-sm cursor-pointer">{s}
          <button onClick={() => setP(x => ({ ...x, [s]: !x[s] }))} className={`px-3 rounded-full text-xs font-bold ${p[s] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p[s] ? 'Present' : 'Absent'}</button></label>
      ))}
      <Btn className="mt-4" onClick={() => say(`Attendance saved: ${Object.values(p).filter(Boolean).length}/${D.students.length} present`)}>Save attendance</Btn>
    </Card>
  )
}
function StaffAssign() {
  const { say } = useApp()
  const [list, setList] = useUS('c360_staff_asg', [{ id: 1, t: 'Python: File handling', due: '2026-10-12' }])
  const [t, setT] = useState(''), [due, setDue] = useState('')
  const add = () => { if (!t || !due) return say('Add a title and due date', 'err'); setList(l => [{ id: Date.now(), t, due }, ...l]); setT(''); setDue(''); say('Assignment created') }
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Create assignment"><div className="space-y-3"><Input placeholder="Title" value={t} onChange={e => setT(e.target.value)} /><Input type="date" value={due} onChange={e => setDue(e.target.value)} /><Btn onClick={add}>Create assignment</Btn></div></Card>
      <Card title="Created assignments">{list.map(a => <p key={a.id} className="flex justify-between py-2 border-b last:border-0 text-sm">{a.t}<Badge tone="amber">{a.due}</Badge></p>)}</Card>
    </div>
  )
}
function StaffMarks() {
  const { say } = useApp()
  const [exam, setExam] = useState('Internal 1')
  const [m, setM] = useUS('c360_marks', { 'Internal 1': {}, 'Internal 2': {} })
  const cur = m[exam] || {}
  const total = s => ['Internal 1', 'Internal 2'].reduce((x, e) => x + (m[e]?.[s] || 0), 0)
  return (
    <Card title={`Enter ${exam} marks (out of 50)`} className="max-w-xl">
      <div className="mb-3"><Tabs items={['Internal 1', 'Internal 2']} value={exam} onChange={setExam} /></div>
      {D.students.map(s => (
        <div key={s} className="flex justify-between items-center gap-3 py-2 border-b text-sm">
          <span className="flex-1">{s}</span>
          <span className="text-xs text-slate-400">Both: {total(s)}/100</span>
          <input type="number" min="0" max="50" value={cur[s] ?? ''} onChange={e => setM(x => ({ ...x, [exam]: { ...x[exam], [s]: Math.max(0, Math.min(50, +e.target.value)) } }))} className="w-20 p-1 rounded-lg border border-slate-200 text-right" />
        </div>
      ))}
      <Btn className="mt-4" onClick={() => say(`${exam} marks saved`)}>Save {exam} marks</Btn>
    </Card>
  )
}
function StaffNotes() {
  const { say } = useApp()
  const [files, setFiles] = useUS('c360_notes', [])
  return (
    <Card title="Upload notes or syllabus" className="max-w-xl">
      <input type="file" className="text-sm" onChange={e => { const f = e.target.files[0]; if (f) { setFiles(x => [f.name, ...x]); say('Uploaded (demo only)') } }} />
      {files.length === 0 ? <Empty text="No files uploaded yet." /> : files.map(f => <p key={f} className="py-2 border-b text-sm flex gap-2"><I.FileText size={16} className="text-brand" />{f}</p>)}
    </Card>
  )
}
function StaffSubs() {
  const { say, me } = useApp()
  const [rows, setRows] = useUS('c360_subs', me.submissions)
  return (
    <Card title="Student submissions">
      {rows.length === 0 && <Empty text="All submissions reviewed." />}
      {rows.map(r => (
        <div key={r.id} className="flex justify-between items-center py-3 border-b last:border-0 text-sm">
          <div><p className="font-semibold text-navy">{r.who}</p><p className="text-xs text-slate-500">{r.t} · {r.at}</p></div>
          <Btn onClick={() => { setRows(x => x.filter(y => y.id !== r.id)); say('Marked as reviewed') }}>Mark reviewed</Btn>
        </div>
      ))}
    </Card>
  )
}
function StaffEvents() {
  const { say } = useApp()
  const [ev, setEv] = useUS('c360_staff_ev', D.events.slice(0, 2).map(e => ({ id: e.id, n: e.n, date: e.date }))), [n, setN] = useState('')
  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card title="Add event"><div className="space-y-3"><Input placeholder="Event name" value={n} onChange={e => setN(e.target.value)} />
        <Btn onClick={() => { if (!n) return say('Enter an event name', 'err'); setEv(x => [{ id: Date.now(), n, date: 'TBA' }, ...x]); setN(''); say('Event added') }}>Add event</Btn></div></Card>
      <Card title="Manage events">{ev.map(e => <p key={e.id} className="flex justify-between py-2 border-b last:border-0 text-sm">{e.n} · {e.date}
        <button onClick={() => setEv(x => x.filter(y => y.id !== e.id))} aria-label="Delete event"><I.Trash2 size={16} className="text-red-500" /></button></p>)}</Card>
    </div>
  )
}

/* ---------- shell ---------- */
const TONE = { red: 'bg-red-50 border-red-200', amber: 'bg-amber-50 border-amber-200', blue: 'bg-blue-50 border-blue-200', teal: 'bg-teal-50 border-teal-200', green: 'bg-green-50 border-green-200' }
// Staff: students grouped by CGPA, with a question bank for each group (for the subject this staff member handles).
function StaffQBank() {
  const { me, user, say } = useApp()
  const subject = me.profile.subject
  const groups = useMemo(() => [...new Set(me.schedule.flat().filter(x => !x.free).map(x => x.cls))].sort(), [me])
  const roster = useMemo(() => rosterFor(user.email, groups), [user.email, groups])
  const [grp, setGrp] = useState('All classes'), [band, setBand] = useState(0), [showAll, setShowAll] = useState(false)
  const [bank, setBank] = useLS('c360_qbank', []) // shared, so a student page can read it later
  const [title, setTitle] = useState(''), [unit, setUnit] = useState('Unit 1'), [file, setFile] = useState(null), [fk, setFk] = useState(0)
  const list = grp === 'All classes' ? roster : roster.filter(s => s.group === grp)
  const counts = BANDS.map((_, i) => list.filter(s => bandOf(s.cgpa) === i).length)
  const avg = list.length ? (list.reduce((t, s) => t + s.cgpa, 0) / list.length).toFixed(2) : '0.00'
  const B = BANDS[band], weak = band === 0
  const inBand = list.filter(s => bandOf(s.cgpa) === band).sort((x, y) => x.cgpa - y.cgpa)
  const files = bank.filter(f => f.subject === subject && f.band === band)
  const upload = () => {
    if (!file) return say('Choose a file before uploading', 'err')
    setBank(x => [{ id: Date.now(), subject, band, unit, title: title.trim() || file.name, file: file.name, by: user.name, at: new Date().toLocaleDateString('en-IN') }, ...x])
    say(`Question bank uploaded for CGPA ${B.label} (demo only)`); setTitle(''); setFile(null); setFk(k => k + 1)
  }
  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs text-slate-500">Subject you handle</p><h2 className="text-xl font-extrabold text-navy">{subject}</h2></div>
          <select value={grp} onChange={e => { setGrp(e.target.value); setShowAll(false) }} className="p-2 rounded-xl border border-slate-200 text-sm bg-white">
            {['All classes', ...groups].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <p className="text-sm text-slate-600 mt-3">
          <b className="text-navy">{list.length}</b> students · average CGPA <b className="text-navy">{avg}</b> ·{' '}
          <b className="text-green-700">{counts[4]}</b> students are between 9 and 10 CGPA · <b className="text-red-600">{counts[0]}</b> are below 6.5
        </p>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {BANDS.map((b, i) => (
          <button key={b.id} onClick={() => { setBand(i); setShowAll(false) }}
            className={`text-left rounded-2xl border p-4 transition hover:shadow-md ${TONE[b.tone]} ${band === i ? 'ring-2 ring-brand' : ''}`}>
            <p className="text-xs font-semibold text-slate-500">CGPA {b.label}</p>
            <p className="text-3xl font-extrabold text-navy mt-1">{counts[i]}</p>
            <p className="text-xs text-slate-500">{list.length ? Math.round((counts[i] / list.length) * 100) : 0}% · {b.level}</p>
          </button>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Students with CGPA ${B.label}`} action={<Badge tone={weak ? 'red' : 'blue'}>{inBand.length}</Badge>}>
          {inBand.length === 0 && <Empty text="No students in this CGPA range." />}
          <div className="max-h-80 overflow-y-auto">
            {inBand.slice(0, showAll ? inBand.length : 8).map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 border-slate-100 text-sm">
                <div><p className="font-semibold text-navy">{s.name}</p><p className="text-xs text-slate-500">{s.roll} · {s.group}</p></div>
                <div className="text-right"><p className="font-bold text-navy">{s.cgpa.toFixed(1)}</p>
                  {weak && <p className="text-[11px] text-red-600">Needs SGPA {sgpaNeeded(s.cgpa, s.group)} next sem</p>}</div>
              </div>
            ))}
          </div>
          {inBand.length > 8 && <Btn v="soft" className="w-full mt-3" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${inBand.length}`}</Btn>}
        </Card>
        <Card title={weak ? 'Ideas to help them raise their CGPA' : `Focus for CGPA ${B.label} students`}>
          <ul className="space-y-2">{B.ideas.map(t => <li key={t} className="flex gap-2 text-sm"><I.CircleCheck size={16} className="text-brand mt-0.5 shrink-0" />{t}</li>)}</ul>
          {weak && <p className="text-xs text-slate-500 mt-3">"Needs SGPA" assumes every semester counts equally. Real figures depend on credits.</p>}
        </Card>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Upload question bank: CGPA ${B.label}`}>
          <p className="text-xs text-slate-500 mb-3">{subject} · {B.level} level questions for this group</p>
          <div className="space-y-3">
            <Input placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} />
            <select value={unit} onChange={e => setUnit(e.target.value)} className="w-full p-2 rounded-xl border border-slate-200 text-sm bg-white">
              {['Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'All units'].map(u => <option key={u}>{u}</option>)}
            </select>
            <input key={fk} type="file" accept=".pdf,.doc,.docx" className="text-sm" onChange={e => setFile(e.target.files[0] || null)} />
            <Btn className="w-full" onClick={upload}>Upload for CGPA {B.label}</Btn>
          </div>
        </Card>
        <Card title={`Uploaded question banks: CGPA ${B.label}`}>
          {files.length === 0 && <Empty text="Nothing uploaded for this group yet." />}
          {files.map(f => (
            <div key={f.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-0 border-slate-100 text-sm">
              <div className="flex gap-2 min-w-0"><I.FileText size={16} className="text-brand mt-0.5 shrink-0" />
                <div className="min-w-0"><p className="font-semibold text-navy truncate">{f.title}</p><p className="text-xs text-slate-500">{f.unit} · {f.file} · {f.at}</p></div></div>
              <button onClick={() => { setBank(x => x.filter(y => y.id !== f.id)); say('Removed') }} aria-label="Remove"><I.Trash2 size={16} className="text-red-500" /></button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

const studentNav = [['dashboard', 'Dashboard', I.LayoutDashboard, Dashboard], ['navigation', 'Campus Navigation', I.Map, CampusNav], ['food', 'Food Pre-Order', I.Utensils, Food],
  ['attendance', 'Attendance', I.CalendarCheck, Attendance], ['lab', 'Lab Availability', I.FlaskConical, Lab], ['academics', 'Academics', I.GraduationCap, Academics],
  ['assignments', 'Assignments', I.ClipboardList, Assignments], ['events', 'Events', I.PartyPopper, Events], ['transport', 'Transport', I.Bus, Transport],
  ['notifications', 'Notifications', I.Bell, Notifications], ['profile', 'Profile', I.User, Profile], ['settings', 'Settings', I.Settings, Settings]]
const staffNav = [['dashboard', 'Dashboard', I.LayoutDashboard, StaffHome], ['attendance', 'Attendance', I.CalendarCheck, StaffAttendance], ['assign', 'Assignments', I.ClipboardList, StaffAssign],
  ['lab', 'Lab Booking', I.FlaskConical, StaffLab], ['food', 'Food Pre-Order', I.Utensils, Food], ['marks', 'Enter Marks', I.PenLine, StaffMarks], ['notes', 'Notes & Syllabus', I.Upload, StaffNotes], ['qbank', 'Question Bank', I.BookOpenCheck, StaffQBank], ['subs', 'Submissions', I.Inbox, StaffSubs],
  ['events', 'Manage Events', I.PartyPopper, StaffEvents], ['notifications', 'Notifications', I.Bell, Notifications], ['profile', 'Profile', I.User, Profile]]

export default function App() {
  const [stored, setUser] = useLS('c360_user', null, sessionStorage) // session only: reopening the site shows the login page
  const user = stored?.email && stored?.seed ? stored : null
  // wipe the previous login's per-user data (shared lab bookings are kept)
  const login = u => { Object.keys(localStorage).filter(k => k.startsWith('c360_') && k.includes(':')).forEach(k => localStorage.removeItem(k)); setUser(u) }
  if (!user) return <Login onLogin={login} />
  return <Shell key={`${user.role}:${user.email}:${user.seed}`} user={user} onLogout={() => setUser(null)} />
}

function Shell({ user, onLogout }) {
  const me = useMemo(() => (user.role === 'staff' ? makeStaff(user.email, user.name, user.seed) : makeStudent(user.email, user.name, user.seed)), [user])
  const [page, setPage] = useState('dashboard')
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState(null)
  const [notifs, setNotifs] = useLS(`c360_n:${user.email}:${user.seed}`, me.notifs)
  const say = (m, t = 'ok') => { setToast({ m, t }); setTimeout(() => setToast(null), 2500) }
  const notify = (text, type) => setNotifs(n => [{ id: Date.now(), type, text, time: 'Just now', read: false }, ...n])
  const nav = user.role === 'staff' ? staffNav : studentNav
  const cur = nav.find(n => n[0] === page) || nav[0], Page = cur[3]
  const unread = notifs.filter(n => !n.read).length
  const go = id => { setPage(id); setMenu(false) }
  const Side = (
    <nav className="flex flex-col h-full p-4 text-blue-100">
      <div className="flex items-center gap-3 px-2 mb-1"><Logo size={40} className="!rounded-xl" /><div className="text-white leading-tight"><p className="text-[10px] font-bold tracking-[0.2em] text-blue-200">KPRIET</p><p className="font-extrabold text-lg">Campus 360</p></div></div>
      <p className="text-xs text-blue-300 px-2 mb-5">{user.role === 'staff' ? 'Staff portal' : 'Student portal'}</p>
      <div className="flex-1 space-y-1 overflow-y-auto">
        {nav.map(([id, l, Ic]) => (
          <button key={id} onClick={() => go(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${page === id ? 'bg-brand text-white shadow' : 'hover:bg-white/10'}`}>
            <Ic size={18} />{l}{id === 'notifications' && unread > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2">{unread}</span>}
          </button>
        ))}
      </div>
      <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10"><I.LogOut size={18} />Log out</button>
    </nav>
  )
  return (
    <Ctx.Provider value={{ say, notify, notifs, setNotifs, setPage: go, user, me }}>
      <div className="min-h-screen flex">
        <aside className="hidden lg:block w-64 bg-gradient-to-b from-navy via-[#0E5A72] to-[#1E4FBF] fixed inset-y-0">{Side}</aside>
        {menu && <div className="lg:hidden fixed inset-0 z-40 flex"><div className="w-64 bg-gradient-to-b from-navy via-[#0E5A72] to-[#1E4FBF]">{Side}</div><div className="flex-1 bg-black/50" onClick={() => setMenu(false)} /></div>}
        <main className="flex-1 lg:ml-64 min-w-0">
          <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><I.Menu /></button>
            <h1 className="font-extrabold text-navy text-lg flex-1">{cur[1]}</h1>
            <button onClick={() => go('notifications')} className="relative p-2 rounded-xl hover:bg-sky-50" aria-label="Notifications"><I.Bell size={20} />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 grid place-items-center">{unread}</span>}</button>
            <button onClick={() => go('profile')} className="w-9 h-9 rounded-full bg-brand text-white font-bold">{user.name[0]}</button>
          </header>
          <div className="p-4 sm:p-6"><Page /></div>
        </main>
        {toast && <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${toast.t === 'err' ? 'bg-red-600' : 'bg-navy'}`}>{toast.m}</div>}
      </div>
    </Ctx.Provider>
  )
}
