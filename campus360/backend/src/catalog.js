// Fixed lists: food menu, transport routes, campus places, event categories.
export const SHOPS = [
  { n: 'Royal Kitchen', tag: 'Meals and tiffin' },
  { n: 'Mario', tag: 'Fast food and fresh juice' },
  { n: 'Saral', tag: 'Bakery items' },
]
const RK = 'Royal Kitchen', MA = 'Mario', SA = 'Saral'
export const FOOD = [
  [RK, 'Veg Biryani', 90], [RK, 'Masala Dosa', 60], [RK, 'Idli (3 pcs)', 40], [RK, 'Curd Rice Meal', 70], [RK, 'Chapati Meal', 80],
  [RK, 'Paneer Butter Masala Meal', 110], [RK, 'Ven Pongal', 50], [RK, 'Parotta and Salna', 70], [RK, 'Filter Coffee', 25], [RK, 'Masala Tea', 20],
  [MA, 'Veg Burger', 70], [MA, 'Paneer Wrap', 80], [MA, 'French Fries', 50], [MA, 'Veg Pizza Slice', 60], [MA, 'Veg Noodles', 75],
  [MA, 'Cheese Sandwich', 55], [MA, 'Fresh Orange Juice', 40], [MA, 'Watermelon Juice', 35], [MA, 'Mango Shake', 55], [MA, 'Cold Lime Soda', 30],
  [SA, 'Veg Puff', 20], [SA, 'Egg Puff', 25], [SA, 'Chocolate Brownie', 45], [SA, 'Butter Croissant', 40], [SA, 'Choco Donut', 35],
  [SA, 'Cake Slice', 30], [SA, 'Cream Bun', 25], [SA, 'Fruit Cake Piece', 30],
].map(([shop, name, price], i) => ({ id: i + 1, shop, name, price }))
export const PICKUP_TIMES = ['12:00', '12:30', '13:00', '13:30']

export const TRANSPORT = [
  { id: 1, name: 'Route 12: Gandhipuram', next: '07:15', then: '07:45', stops: ['Gandhipuram', 'Peelamedu', 'Avinashi Rd', 'Campus'] },
  { id: 2, name: 'Route 7: Singanallur', next: '07:30', then: '08:00', stops: ['Singanallur', 'Ramanathapuram', 'Hopes', 'Campus'] },
  { id: 3, name: 'Route 3: Saravanampatti', next: '07:20', then: '07:50', stops: ['Saravanampatti', 'Vilankurichi', 'Neelambur', 'Campus'] },
]
// Same places and positions as the frontend map (x, y are percentages of the map box).
export const LOCATIONS = [
  { id: 'main', name: 'Main Block (AI&DS)', no: 1, desc: 'Building 1: Administrative and AI & DS Block', x: 53, y: 62, kind: 'block', w: 18, h: 10 },
  { id: 'cse', name: 'CSE Block', no: 19, desc: 'Building 19', x: 82, y: 64, kind: 'block', w: 16, h: 9 },
  { id: 'ece', name: 'ECE Block', no: 18, desc: 'Building 18', x: 80, y: 26, kind: 'block', w: 16, h: 9 },
  { id: 'lib', name: 'Library', no: 23, desc: 'Building 23: Central Library', x: 53, y: 84, kind: 'library', w: 14, h: 8 },
  { id: 'food', name: 'Food Court', no: 10, desc: 'Building 10', x: 32, y: 24, kind: 'food', w: 12, h: 7 },
  { id: 'car', name: 'Car Parking', no: 12, desc: 'Building 12', x: 22, y: 64, kind: 'parking', w: 14, h: 8 },
  { id: 'bike', name: 'Bike Parking', no: 11, desc: 'Building 11', x: 14, y: 28, kind: 'parking', w: 14, h: 8 },
]
export const EVENT_CATEGORIES = ['Tech', 'Workshop', 'Sports', 'Cultural', 'Other']
