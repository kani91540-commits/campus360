// All mock data lives here. Edit freely.
export default {
  student: { name: 'Kani', roll: '7376251CS101', dept: 'BE CSE', year: 'First Year', sem: 'Semester 2', email: 'kani@kpriet.ac.in', cgpa: 8.6, credits: 24, totalCredits: 160 },
  subjects: [
    { id: 1, n: 'Python Programming', present: 34, total: 38, marks: 88, ia: 42, lab: 24, asg: 22 },
    { id: 2, n: 'Web Design', present: 30, total: 36, marks: 92, ia: 45, lab: 25, asg: 22 },
    { id: 3, n: 'Engineering Mathematics', present: 26, total: 40, marks: 74, ia: 36, lab: 0, asg: 20 },
    { id: 4, n: 'Engineering Physics', present: 31, total: 37, marks: 81, ia: 40, lab: 20, asg: 21 },
    { id: 5, n: 'Communication Skills', present: 22, total: 24, marks: 90, ia: 44, lab: 0, asg: 23 },
  ],
  // Classroom and faculty for each subject's theory periods (used to fill the 7-period day).
  faculty: {
    'Python Programming': { r: 'A-201', who: 'Dr. Meena' },
    'Web Design': { r: 'A-203', who: 'Ms. Priya' },
    'Engineering Mathematics': { r: 'A-204', who: 'Prof. Raj' },
    'Engineering Physics': { r: 'B-110', who: 'Dr. Arun' },
    'Communication Skills': { r: 'A-205', who: 'Ms. Kavya' },
  },
  trend: [{ l: 'IA 1', v: 78 }, { l: 'IA 2', v: 83 }, { l: 'Model', v: 86 }, { l: 'Sem 1', v: 88 }],
  timetable: [
    { t: '09:00', s: 'Python Programming', r: 'Lab 2', who: 'Dr. Meena' },
    { t: '10:00', s: 'Engineering Mathematics', r: 'A-204', who: 'Prof. Raj' },
    { t: '11:30', s: 'Web Design', r: 'Lab 1', who: 'Ms. Priya' },
    { t: '14:00', s: 'Engineering Physics', r: 'B-110', who: 'Dr. Arun' },
  ],
  assignments: [
    { id: 1, t: 'Python: File handling', s: 'Python Programming', due: '2026-10-12', status: 'Pending' },
    { id: 2, t: 'Portfolio landing page', s: 'Web Design', due: '2026-10-15', status: 'Pending' },
    { id: 3, t: 'Calculus problem set 4', s: 'Engineering Mathematics', due: '2026-10-10', status: 'Pending' },
    { id: 4, t: 'Pendulum lab report', s: 'Engineering Physics', due: '2026-10-05', status: 'Submitted' },
  ],
  notifs: [
    { id: 1, type: 'assignment', text: 'Calculus problem set 4 is due in 2 days', time: '1h ago', read: false },
    { id: 2, type: 'attendance', text: 'Mathematics attendance is 65%. Minimum is 75%', time: '3h ago', read: false },
    { id: 3, type: 'food', text: 'Your order #1042 is ready for pickup', time: 'Yesterday', read: false },
    { id: 4, type: 'lab', text: 'Lab 2 booking confirmed for 14:00', time: 'Yesterday', read: true },
    { id: 5, type: 'event', text: 'Hackathon 2026 starts tomorrow at 9 AM', time: '2d ago', read: true },
  ],
  activity: ['Submitted Pendulum lab report', 'Booked Lab 2 for 14:00', 'Ordered Veg Biryani from Food Court', 'Registered for Hackathon 2026'],
  shops: [
    { n: 'Royal Kitchen', tag: 'Meals and tiffin' },
    { n: 'Mario', tag: 'Fast food and fresh juice' },
    { n: 'Saral', tag: 'Bakery items' },
  ],
  foods: [
    // Royal Kitchen
    { id: 1, s: 'Royal Kitchen', n: 'Veg Biryani', p: 90, e: '🍛' }, { id: 2, s: 'Royal Kitchen', n: 'Masala Dosa', p: 60, e: '🥞' },
    { id: 3, s: 'Royal Kitchen', n: 'Idli (3 pcs)', p: 40, e: '🍚' }, { id: 4, s: 'Royal Kitchen', n: 'Curd Rice Meal', p: 70, e: '🥣' },
    { id: 5, s: 'Royal Kitchen', n: 'Chapati Meal', p: 80, e: '🫓' }, { id: 6, s: 'Royal Kitchen', n: 'Paneer Butter Masala Meal', p: 110, e: '🍲' },
    { id: 7, s: 'Royal Kitchen', n: 'Ven Pongal', p: 50, e: '🍚' }, { id: 8, s: 'Royal Kitchen', n: 'Parotta and Salna', p: 70, e: '🫓' },
    { id: 9, s: 'Royal Kitchen', n: 'Filter Coffee', p: 25, e: '☕' }, { id: 10, s: 'Royal Kitchen', n: 'Masala Tea', p: 20, e: '🍵' },
    // Mario (fast food and juice)
    { id: 11, s: 'Mario', n: 'Veg Burger', p: 70, e: '🍔' }, { id: 12, s: 'Mario', n: 'Paneer Wrap', p: 80, e: '🌯' },
    { id: 13, s: 'Mario', n: 'French Fries', p: 50, e: '🍟' }, { id: 14, s: 'Mario', n: 'Veg Pizza Slice', p: 60, e: '🍕' },
    { id: 15, s: 'Mario', n: 'Veg Noodles', p: 75, e: '🍜' }, { id: 16, s: 'Mario', n: 'Cheese Sandwich', p: 55, e: '🥪' },
    { id: 17, s: 'Mario', n: 'Fresh Orange Juice', p: 40, e: '🍊' }, { id: 18, s: 'Mario', n: 'Watermelon Juice', p: 35, e: '🍉' },
    { id: 19, s: 'Mario', n: 'Mango Shake', p: 55, e: '🥭' }, { id: 20, s: 'Mario', n: 'Cold Lime Soda', p: 30, e: '🥤' },
    // Saral (bakery)
    { id: 21, s: 'Saral', n: 'Veg Puff', p: 20, e: '🥟' }, { id: 22, s: 'Saral', n: 'Egg Puff', p: 25, e: '🥟' },
    { id: 23, s: 'Saral', n: 'Chocolate Brownie', p: 45, e: '🍫' }, { id: 24, s: 'Saral', n: 'Butter Croissant', p: 40, e: '🥐' },
    { id: 25, s: 'Saral', n: 'Choco Donut', p: 35, e: '🍩' }, { id: 26, s: 'Saral', n: 'Cake Slice', p: 30, e: '🍰' },
    { id: 27, s: 'Saral', n: 'Cream Bun', p: 25, e: '🧁' }, { id: 28, s: 'Saral', n: 'Fruit Cake Piece', p: 30, e: '🍰' },
  ],
  labs: ['Computer Lab 1', 'Computer Lab 2', 'Physics Lab', 'Electronics Lab'],
  slots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  // Simple campus map: x and y are percentages of the map box. `no` is the building number from the KPRIET campus layout. kind/w/h control how it is drawn.
  locs: [
    { id: 'main', n: 'Main Block (AI&DS)', no: 1, b: 'Building 1: Administrative and AI & DS Block', x: 53, y: 62, kind: 'block', w: 18, h: 10 },
    { id: 'cse', n: 'CSE Block', no: 19, b: 'Building 19', x: 82, y: 64, kind: 'block', w: 16, h: 9 },
    { id: 'ece', n: 'ECE Block', no: 18, b: 'Building 18', x: 80, y: 26, kind: 'block', w: 16, h: 9 },
    { id: 'lib', n: 'Library', no: 23, b: 'Building 23: Central Library', x: 53, y: 84, kind: 'library', w: 14, h: 8 },
    { id: 'food', n: 'Food Court', no: 10, b: 'Building 10', x: 32, y: 24, kind: 'food', w: 12, h: 7 },
    { id: 'car', n: 'Car Parking', no: 12, b: 'Building 12', x: 22, y: 64, kind: 'parking', w: 14, h: 8 },
    { id: 'bike', n: 'Bike Parking', no: 11, b: 'Building 11', x: 14, y: 28, kind: 'parking', w: 14, h: 8 },
  ],
  events: [
    { id: 1, n: 'Hackathon 2026', c: 'Tech', date: 'Oct 9', where: 'Auditorium', d: '24-hour build challenge. Teams of 3-4.' },
    { id: 2, n: 'UI/UX Workshop', c: 'Workshop', date: 'Oct 14', where: 'Lab 1', d: 'Hands-on Figma session with portfolio review.' },
    { id: 3, n: 'Inter-Dept Cricket', c: 'Sports', date: 'Oct 18', where: 'Main Ground', d: 'Knockout matches, CSE vs ECE opens.' },
    { id: 4, n: 'Cultural Night', c: 'Cultural', date: 'Oct 25', where: 'Open Air Theatre', d: 'Music, dance and drama from all years.' },
  ],
  routes: [
    { id: 1, n: 'Route 12: Gandhipuram', next: '07:15', then: '07:45', stops: ['Gandhipuram', 'Peelamedu', 'Avinashi Rd', 'Campus'] },
    { id: 2, n: 'Route 7: Singanallur', next: '07:30', then: '08:00', stops: ['Singanallur', 'Ramanathapuram', 'Hopes', 'Campus'] },
    { id: 3, n: 'Route 3: Saravanampatti', next: '07:20', then: '07:50', stops: ['Saravanampatti', 'Vilankurichi', 'Neelambur', 'Campus'] },
  ],
  students: ['Aarav S', 'Divya R', 'Kani', 'Mohan K', 'Nisha P', 'Rahul T'],
  staffClasses: ['CSE-A Python (09:00)', 'CSE-B Web Design (11:30)', 'CSE-A Python Lab (14:00)'],
  submissions: [
    { id: 1, who: 'Aarav S', t: 'Python: File handling', at: 'Today 08:40' },
    { id: 2, who: 'Divya R', t: 'Portfolio landing page', at: 'Today 09:10' },
    { id: 3, who: 'Nisha P', t: 'Python: File handling', at: 'Yesterday' },
  ],
}
