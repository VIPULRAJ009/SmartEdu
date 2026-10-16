require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const quizRoutes = require('./routes/quizzes');
const assignmentRoutes = require('./routes/assignments');
const badgeRoutes = require('./routes/badges');
const discussionRoutes = require('./routes/discussions');
const skillRoutes = require('./routes/skills');
const marketRoutes = require('./routes/market');
const adminRoutes = require('./routes/admin');
const liveClassRoutes = require('./routes/liveClasses');

const app = express();
const server = http.createServer(app);

app.disable('x-powered-by');

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (e.g., health checks, curl, server-to-server)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, '');
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Socket.io for real-time discussions
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Connect to MongoDB
connectDB();

// Render/other platforms sit behind a proxy; trust first hop for rate limiting and IPs.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth endpoints get stricter limiting
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Too many auth attempts, please try again later.' },
});
app.use('/api/auth', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Logging (development only)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Attach io to request for use in controllers
app.use((req, _res, next) => {
  req.io = io;
  next();
});

// API Routes
app.get('/', (_req, res) => {
  res.json({ message: 'Api is running!' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/live-classes', liveClassRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV, timestamp: new Date() });
});

// Socket.io — real-time discussions
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  const getLiveClassParticipants = (classId) => {
    const roomName = `live-class:${classId}`;
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) return [];

    return Array.from(room)
      .map((socketId) => {
        const peer = io.sockets.sockets.get(socketId);
        const meta = peer?.data?.liveClassMeta;
        if (!meta) return null;

        return {
          socketId,
          userId: String(meta.userId),
          name: meta.name || 'User',
          role: meta.role || 'student',
        };
      })
      .filter(Boolean);
  };

  const leaveLiveClass = () => {
    const meta = socket.data.liveClassMeta;
    if (!meta?.classId) return;

    const roomName = `live-class:${meta.classId}`;
    socket.leave(roomName);

    io.to(roomName).emit('live-class:presence', {
      type: 'left',
      socketId: socket.id,
      userId: String(meta.userId),
    });

    socket.data.liveClassMeta = null;
  };

  socket.on('join-user', (userId) => {
    if (!userId) return;
    socket.join(`user:${userId}`);
  });

  socket.on('leave-user', (userId) => {
    if (!userId) return;
    socket.leave(`user:${userId}`);
  });

  socket.on('join-course', (courseId) => {
    socket.join(`course:${courseId}`);
  });

  socket.on('join-chat', (chatId) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on('leave-course', (courseId) => {
    socket.leave(`course:${courseId}`);
  });

  socket.on('leave-chat', (chatId) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on('join-live-class', (payload = {}) => {
    const classId = String(payload.classId || '').trim();
    const userId = String(payload.userId || '').trim();

    if (!classId || !userId) return;

    leaveLiveClass();

    const roomName = `live-class:${classId}`;
    socket.join(roomName);
    socket.join(`live-user:${userId}`);

    socket.data.liveClassMeta = {
      classId,
      userId,
      name: String(payload.name || 'User').trim(),
      role: String(payload.role || 'student').trim(),
    };

    socket.emit('live-class:participants', getLiveClassParticipants(classId));

    io.to(roomName).emit('live-class:presence', {
      type: 'joined',
      socketId: socket.id,
      userId,
      name: socket.data.liveClassMeta.name,
      role: socket.data.liveClassMeta.role,
    });
  });

  socket.on('leave-live-class', () => {
    leaveLiveClass();
  });

  socket.on('live-class:webrtc-signal', (payload = {}) => {
    const classId = String(payload.classId || '').trim();
    const targetSocketId = String(payload.targetSocketId || '').trim();
    if (!classId || !targetSocketId || !payload.signal) return;

    io.to(targetSocketId).emit('live-class:webrtc-signal', {
      classId,
      fromSocketId: socket.id,
      fromUserId: String(socket.data.liveClassMeta?.userId || ''),
      signal: payload.signal,
    });
  });

  socket.on('live-class:camera-state', (payload = {}) => {
    const classId = String(payload.classId || '').trim();
    if (!classId) return;

    io.to(`live-class:${classId}`).emit('live-class:camera-state', {
      classId,
      socketId: socket.id,
      userId: String(socket.data.liveClassMeta?.userId || ''),
      cameraOn: Boolean(payload.cameraOn),
    });
  });

  socket.on('disconnect', () => {
    leaveLiveClass();
    console.log('Client disconnected:', socket.id);
  });
});

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n🎓 Smart Education API running on port ${PORT} [${process.env.NODE_ENV}]\n`);
});

module.exports = { app, io };
