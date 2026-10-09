import 'dotenv/config'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import multer from 'multer'
import { load, flush } from './src/db.js'
import { seed } from './src/seed.js'
import { HttpError } from './src/util.js'
import { router as authRouter, auth, role } from './src/routes/auth.js'
import { router as commonRouter } from './src/routes/common.js'
import { router as studentRouter } from './src/routes/student.js'
import { router as staffRouter } from './src/routes/staff.js'

load(seed)
export const app = express()
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000').split(',').map(s => s.trim()) }))
app.use(express.json({ limit: '200kb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/auth', authRouter)
app.use('/api/student', auth, role('student'), studentRouter)
app.use('/api/staff', auth, role('staff'), staffRouter)
app.use('/api', auth, commonRouter)
app.use('/api', (_req, _res, next) => next(new HttpError(404, 'No such API route')))

// every error becomes { error: "message" }
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (10 MB maximum)' : 'Upload failed' })
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body is not valid JSON' })
  if (!(err instanceof HttpError)) console.error(err)
  res.status(err.status || 500).json({ error: err instanceof HttpError ? err.message : 'Something went wrong on the server' })
})

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] || '')).href) {
  const port = process.env.PORT || 4000
  if (!process.env.JWT_SECRET) console.warn('Warning: JWT_SECRET is not set. Copy .env.example to .env and set one before deploying.')
  app.listen(port, () => console.log(`Campus 360 API running on http://localhost:${port}`))
  for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { flush(); process.exit(0) })
}
