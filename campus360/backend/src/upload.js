// File uploads (assignment submissions, question banks, notes). Files are stored on disk with random names.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import multer from 'multer'
import { db, idx, nextId } from './db.js'
import { HttpError } from './util.js'

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve('uploads')
fs.mkdirSync(UPLOAD_DIR, { recursive: true })
const ALLOWED = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.png', '.jpg', '.jpeg'])

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_r, _f, cb) => cb(null, UPLOAD_DIR),
    filename: (_r, f, cb) => cb(null, crypto.randomBytes(16).toString('hex') + path.extname(f.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_r, f, cb) => (ALLOWED.has(path.extname(f.originalname).toLowerCase())
    ? cb(null, true) : cb(new HttpError(400, 'File type not allowed. Use PDF, Word, PowerPoint, Excel, text, zip or an image.'))),
})

export function saveUploaded(file, uploadedBy) {
  const row = { id: nextId('files'), originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'), path: file.path, size: file.size, uploadedBy, createdAt: new Date().toISOString() }
  db.files.push(row); idx.files.set(row.id, row)
  return row
}
export function removeFile(id) {
  const f = idx.files.get(id)
  if (!f) return
  fs.rm(f.path, { force: true }, () => {})
  db.files = db.files.filter(x => x.id !== id); idx.files.delete(id)
}
export const discardUpload = file => { if (file) fs.rm(file.path, { force: true }, () => {}) } // when validation fails after multer saved it
