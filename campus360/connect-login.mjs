// Run from the campus360 folder:  node connect-login.mjs
// Connects the Login page to the real backend. Your original App.jsx is saved as App.jsx.backup first.
import fs from 'node:fs'

const need = ['src/App.jsx', 'backend/frontend-connect/api.js', 'backend/frontend-connect/vite.config.js']
const missing = need.filter(f => !fs.existsSync(f))
if (missing.length) { console.error('Run this inside the campus360 folder. Missing: ' + missing.join(', ')); process.exit(1) }

fs.copyFileSync('backend/frontend-connect/api.js', 'src/api.js')
fs.copyFileSync('backend/frontend-connect/vite.config.js', 'vite.config.js')
console.log('Copied src/api.js and vite.config.js')

let a = fs.readFileSync('src/App.jsx', 'utf8')
if (a.includes('api.login(')) { console.log('App.jsx is already connected. Nothing to change.'); process.exit(0) }
fs.writeFileSync('App.jsx.backup', a)

// 1. import api
const imports = [...a.matchAll(/^import .*$/gm)]
const end = imports[imports.length - 1].index + imports[imports.length - 1][0].length
a = a.slice(0, end) + "\nimport { api } from './api'" + a.slice(end)

// 2. real login
const submit = `const submit = async e => {
    e.preventDefault()
    if (!/^\\S+@\\S+\\.\\S+$/.test(id.trim()) || !pw) return setErr('Please enter your email address and password.')
    setErr(''); setBusy(true)
    try {
      const email = normEmail(id), seed = Math.random().toString(36).slice(2, 8)
      await api.login(email, pw, role) // the server checks the password
      onLogin({ role, email, name: nameFromEmail(id), seed })
    } catch (e) { setErr(e.message); setBusy(false) }
  }
`
const re = /const submit = e => \{[\s\S]*?\n  \}\n/
if (!re.test(a)) { console.error('Could not find the login submit function. Send me your App.jsx.'); process.exit(1) }
a = a.replace(re, submit)

// 3. remove the demo note
a = a.replace(/\s*<p className="[^"]*">Demo:[^<]*<\/p>/, '')

fs.writeFileSync('src/App.jsx', a)
console.log('Login is now connected to the backend. Restart "npm run dev".')
