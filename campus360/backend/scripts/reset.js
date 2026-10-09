// Deletes the database and uploaded files so the next start creates fresh demo data.
import fs from 'node:fs'
import path from 'node:path'
fs.rmSync(path.resolve('data'), { recursive: true, force: true })
fs.rmSync(path.resolve('uploads'), { recursive: true, force: true })
console.log('Database and uploads removed. Run "npm start" to create fresh demo data.')
