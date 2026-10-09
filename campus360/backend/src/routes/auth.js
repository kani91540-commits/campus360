import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { idx, save } from '../db.js'
import { HttpError, str } from '../util.js'
import { publicUser } from '../logic.js'

export const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me'
export const router = Router()

export function auth(req, _res, next) {
  const h = req.headers.authorization || ''
  if (!h.startsWith('Bearer ')) throw new HttpError(401, 'Please log in')
  let p
  try { p = jwt.verify(h.slice(7), SECRET) } catch { throw new HttpError(401, 'Session expired. Please log in again') }
  const u = idx.users.get(p.id)
  if (!u) throw new HttpError(401, 'Account not found. Please log in again')
  req.user = u
  next()
}
export const role = r => (req, _res, next) => (req.user.role === r ? next() : next(new HttpError(403, `This is only for ${r}s`)))

// 10 wrong attempts per email and address in 15 minutes
const tries = new Map()
router.post('/login', (req, res) => {
  const email = str(req.body?.email, 'Email', { max: 120 }).toLowerCase(), password = str(req.body?.password, 'Password', { max: 100 })
  const key = `${req.ip}|${email}`, t = tries.get(key)
  if (t && Date.now() - t.at < 15 * 60e3 && t.n >= 10) throw new HttpError(429, 'Too many wrong attempts. Try again in 15 minutes.')
  const u = idx.byEmail.get(email), want = req.body?.role
  if (!u || (want && u.role !== want) || !bcrypt.compareSync(password, u.passwordHash)) {
    tries.set(key, { n: (t && Date.now() - t.at < 15 * 60e3 ? t.n : 0) + 1, at: t?.at && Date.now() - t.at < 15 * 60e3 ? t.at : Date.now() })
    throw new HttpError(401, want && u && u.role !== want ? `This account is a ${u.role} account. Choose ${u.role} to sign in.` : 'Wrong email or password')
  }
  tries.delete(key)
  res.json({ token: jwt.sign({ id: u.id, role: u.role }, SECRET, { expiresIn: '12h' }), user: publicUser(u) })
})
router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }))
router.post('/change-password', auth, (req, res) => {
  const cur = str(req.body?.currentPassword, 'Current password', { max: 100 }), next = str(req.body?.newPassword, 'New password', { max: 100 })
  if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters')
  if (!bcrypt.compareSync(cur, req.user.passwordHash)) throw new HttpError(400, 'Current password is wrong')
  req.user.passwordHash = bcrypt.hashSync(next, 10); save()
  res.json({ ok: true })
})
