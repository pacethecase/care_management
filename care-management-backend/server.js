const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const patientRoutes = require("./routes/patientRoutes");
const taskRoutes = require("./routes/taskRoutes");
const noteRoutes = require("./routes/noteRoutes");  
const reportRoutes = require("./routes/reportRoutes");  
const algorithmRoutes = require("./routes/algorithmRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const hospitalRoutes = require("./routes/hospitalRoutes");
const cookieParser = require("cookie-parser");
const http = require('http');
const socketIo = require('socket.io');

require("dotenv").config();
require("dotenv").config();

console.log("✅ ENV DEBUG:");
console.log("EMAIL_USERNAME:", process.env.EMAIL_USERNAME);
console.log("EMAIL_PASSWORD set:", !!process.env.EMAIL_PASSWORD); // shows true/false
console.log("EMAIL_PASSWORD length:", process.env.EMAIL_PASSWORD?.length);

const setupMissedTaskJob = require('./controller/missedTaskJob');
const setupCourtReminderJob = require("./controller/setupCourtReminderJob");

const app = express();
const server = http.createServer(app);
app.set('trust proxy', 1); 
// Allowed Origins (both development and production)
const allowedOrigins = [
  'http://localhost:5173', 
  'http://localhost:5174', 
  'https://care-management-nine.vercel.app',
  'https://www.pacethecase.com',
  'https://pacethecase.com',
];

// CORS Middleware Setup
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-timezone"],
  credentials: true
}));


// Body Parser and Cookie Parser
app.use(cookieParser());
app.use(bodyParser.json());

// Socket.IO CORS Configuration
const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set('io', io);

// Setup background job (missed task job)
setupMissedTaskJob(io);
setupCourtReminderJob(io);

// Socket.IO events handling
io.on('connection', (socket) => {
  socket.on('join', (room) => {
    socket.join(room);
    console.log(`🟡 Joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Socket disconnected: ${socket.id}`);
  });
});

// Routes
app.use("/auth", authRoutes);
app.use('/users', userRoutes); 
app.use('/patients', patientRoutes);
app.use('/tasks', taskRoutes);
app.use('/notes', noteRoutes);  
app.use('/reports', reportRoutes);  
app.use("/algorithms", algorithmRoutes);
app.use('/notifications', notificationRoutes);
app.use("/hospitals", hospitalRoutes);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server with Socket.IO running on http://localhost:${PORT}`);
});
