# Smart Education System — MERN Stack

A full-stack adaptive learning platform with role-based access (Student, Teacher, Admin), AI-powered skill extraction, gamification, real-time collaboration, and market trend analytics.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express.js |
| Database | MongoDB (Atlas or local) + Mongoose ODM |
| Auth | JWT (access + refresh tokens) |
| AI | Google Gemini 2.5 API |
| Realtime | Socket.io |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- MongoDB Atlas URI (or local MongoDB)
- Google Gemini API key

### 1. Clone & Install

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment

```bash
# server/.env
cp server/.env.example server/.env
# Fill in: MONGO_URI, JWT_SECRET, CLIENT_URL, GEMINI_API_KEY

# client/.env (optional for local dev)
cp client/.env.example client/.env
```

### 3. Seed the Database (optional)

```bash
cd server && npm run seed
```

### 4. Run Development Servers

```bash
# Terminal 1 — API server (port 8080)
cd server && npm run dev

# Terminal 2 — React client (port 5173)
cd client && npm run dev
```

---

## Deployment (Vercel + Render)

### Backend on Render

1. Create a new Web Service from this repository and set Root Directory to `server`.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Set environment variables:
    - `NODE_ENV=production`
    - `MONGO_URI=<your_mongodb_connection_string>`
    - `JWT_SECRET=<long_random_secret>`
    - `JWT_EXPIRES_IN=1d`
    - `GEMINI_API_KEY=<your_gemini_key>`
    - `CLIENT_URL=https://<your-vercel-domain>`

Notes:
- `CLIENT_URL` supports multiple origins via comma-separated values.
- The server already enables proxy trust for correct rate-limiting behind Render.

### Frontend on Vercel

1. Create a new Vercel project and set Root Directory to `client`.
2. Framework preset: Vite.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable:
    - `VITE_API_BASE_URL=https://<your-render-domain>/api`

Optional variables for live class:
- `VITE_CONNECTYCUBE_APP_ID`
- `VITE_CONNECTYCUBE_AUTH_KEY`
- `VITE_CONNECTYCUBE_AUTH_SECRET`
- `VITE_CONNECTYCUBE_LOGIN_PREFIX`
- `VITE_CONNECTYCUBE_USER_PASSWORD`

### Production Checklist

- Do not commit `.env` files.
- Keep `JWT_SECRET` long and unique.
- Use only your deployed Vercel domain(s) in `CLIENT_URL`.
- Verify `/api/health` on Render after deploy.

---

## Project Structure

```
smart-edu/
├── server/                  # Express API
│   ├── config/db.js         # MongoDB connection
│   ├── controllers/         # Route handlers
│   ├── middleware/          # Auth, role guards, error handler
│   ├── models/              # Mongoose schemas
│   ├── routes/              # Express routers
│   ├── utils/               # Helpers, AI client
│   └── server.js            # Entry point
│
└── client/                  # React + Vite
    └── src/
        ├── components/      # Shared UI components
        ├── context/         # Auth context
        ├── hooks/           # Custom hooks
        ├── lib/             # API client, utils
        ├── pages/           # Route pages
        └── types/           # TypeScript types
```

---

## Roles & Permissions

| Feature | Student | Teacher | Admin |
|---------|---------|---------|-------|
| Browse courses | ✓ | ✓ | ✓ |
| Enroll in courses | ✓ | — | — |
| Take quizzes | ✓ | — | — |
| Create courses | — | ✓ | ✓ |
| Grade submissions | — | ✓ | ✓ |
| Manage users | — | — | ✓ |
| View platform analytics | — | — | ✓ |

---

## API Endpoints

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/users/me
PUT    /api/users/profile

GET    /api/courses
POST   /api/courses
GET    /api/courses/:id
PUT    /api/courses/:id
DELETE /api/courses/:id
POST   /api/courses/:id/enroll

GET    /api/quizzes/:courseId
POST   /api/quizzes
POST   /api/quizzes/:id/attempt
GET    /api/quizzes/:id/results

GET    /api/assignments/:courseId
POST   /api/assignments
POST   /api/assignments/:id/submit

GET    /api/badges
GET    /api/users/:id/badges

GET    /api/skills/map
POST   /api/skills/analyze

GET    /api/discussions/:courseId
POST   /api/discussions
POST   /api/discussions/:id/reply

GET    /api/market-trends
POST   /api/admin/users
```
