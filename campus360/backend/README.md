# Campus 360 backend

Node.js + Express REST API with login (JWT), file uploads, and one shared database for staff and students.
Whatever staff change (attendance, marks, assignments, question banks, events) is what students see.

## Run it

```powershell
cd backend
npm install
copy .env.example .env      # then edit .env and set JWT_SECRET to a long random text
npm start                   # http://localhost:4000
npm test                    # 60+ checks of staff and student flows against a temporary database
npm run reset               # delete data and uploads, start fresh next time
```

The first start creates `data/db.json` with demo data (80 staff, 1,728 students). Uploads go to `uploads/`.
Needs Node 18 or newer. No database server to install.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Student (1st Year CSE-A) | kani@kpriet.ac.in | student123 |
| Staff (Python, 1st year CSE) | meena@kpriet.ac.in | staff123 |
| Other 1st year CSE staff | priya@, raj@, arun@, kavya@ `kpriet.ac.in` | staff123 |
| Any other student | roll number + `@kpriet.ac.in`, e.g. `7376251cs201@kpriet.ac.in` | student123 |

Every staff member teaches one subject to one year of one department (all 3 sections). Every class has 36 students.

## How staff and students stay consistent

- **Timetable:** one rule builds both views. A student's period shows the same staff member, and that staff member's timetable shows the same class.
- **Attendance:** staff can only mark periods that are on their timetable, not future dates, not Sunday. Re-marking a period corrects the numbers instead of adding to them. A student who drops below 75% gets a notification.
- **Marks and CGPA:** staff enter marks. The server calculates grade points and CGPA, so the student's Academics page and staff's CGPA bands always agree.
- **Question bank:** staff upload for a CGPA band (Below 6.5, 6.5-7.5, 7.5-8.5, 8.5-9, 9-10). A student sees and can download only the files for their own band. If their marks change, their band changes.
- **Assignments:** staff create, students submit a file, staff review with marks and feedback, students see the result. Each step sends notifications.
- **Labs:** a lab cannot be booked when a class already uses it, or when it is already booked. Sunday is closed.
- **Food:** the server prices the order from the menu, never from the browser.
- **Files:** downloads need login. Staff can open submissions to their assignments and their own uploads. Students can open their own submissions, their own band's question bank and their class notes.

## API

All routes start with `/api`. Send `Authorization: Bearer <token>` on everything except login and health. Errors are `{ "error": "message" }`.

**Auth:** `POST /auth/login {email, password, role?}`, `GET /auth/me`, `POST /auth/change-password`

**Student** (`/student/...`)
`GET dashboard`, `timetable`, `attendance`, `academics`, `assignments`, `question-bank`, `notes`, `orders`
`POST assignments/:id/submit` (multipart, field `file`), `POST orders {items:[{itemId,qty}], pickup}`
`POST events/:id/register`, `DELETE events/:id/register`

**Staff** (`/staff/...`)
`GET dashboard`, `timetable`, `classes`, `students?classKey=`
`GET attendance/slots?date=`, `GET attendance/session?date=&classKey=&period=`, `POST attendance {date, classKey, period, absentIds}`
`GET marks?classKey=`, `PUT marks {classKey, entries:[{studentId, ia1, ia2, lab, asg}]}`
`GET/POST assignments`, `DELETE assignments/:id`, `GET submissions?assignmentId=&status=pending|reviewed`, `PATCH submissions/:id {marks, feedback}`
`GET/POST notes` (multipart), `DELETE notes/:id`
`GET question-bank/report?classKey=all|<class>`, `POST question-bank` (multipart: file, band 0-4, unit, title), `DELETE question-bank/:id`
`POST events`, `DELETE events/:id`, `GET events/:id/registrations`, `POST announcements {text, classKey?}`
`GET/POST lab-bookings {lab, date, block, purpose}`, `DELETE lab-bookings/:id`

**Shared** (any logged-in user)
`GET notifications`, `POST notifications/:id/read`, `POST notifications/read-all`
`GET labs`, `labs/availability?lab=&date=`, `labs/class-timetable?classKey=`
`GET food/menu`, `transport`, `campus/locations`, `events`, `files/:id`

Class names look like `1st Year CSE-A`. Dates look like `2026-10-12`. Lab `block` is 0 to 3 (periods 1-2, 3-4, 5-6, 7-8).

## Connecting the React app

1. Copy `frontend-connect/api.js` to `src/api.js` and `frontend-connect/vite.config.js` over your `vite.config.js`. Run the backend and the frontend together (two terminals).
2. In the frontend, replace each page's demo data with calls like `api.get('/student/attendance')`. For example, login becomes `const user = await api.login(email, password, role)`.

The existing pages still use demo data until step 2 is done for them.

## Good to know

- Data is kept in a JSON file. That is fine for a project or demo. For real use with many people, move to PostgreSQL or MongoDB. All data access goes through the `db` arrays used in `src/routes`.
- Set a real `JWT_SECRET` in `.env`. Passwords are stored hashed (bcrypt).
- File types allowed: PDF, Word, PowerPoint, Excel, text, zip, images. Maximum 10 MB.
- Food order status moves by itself over 5 minutes (Placed, Preparing, Ready, Picked up). There is no canteen account yet.
