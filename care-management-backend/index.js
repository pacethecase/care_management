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
const cookieParser = require("cookie-parser");
const http = require('http');
const socketIo = require('socket.io');


require("dotenv").config();
const setupMissedTaskJob = require('./controller/missedTaskJob');


const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));
  
  app.use(cookieParser());
  app.options("*", cors());
  const io = socketIo(server, {
    cors: {
      origin: function (origin, callback) {
        const allowedOrigins = [
          'http://localhost:5173',
          'https://care-management-umber.vercel.app'
        ];
    
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }
  });
  app.set('io', io);
  setupMissedTaskJob(io); 
  io.on('connection', (socket) => {
  
  
    socket.on('join', (room) => {
      socket.join(room);
      console.log(`🟡 Joined room: ${room}`);
    });
  
    socket.on('disconnect', () => {
      console.log(`🔴 Socket disconnected: ${socket.id}`);
    });
  });

  // Middleware
  app.use(bodyParser.json());
  
  // Routes
  app.use("/auth", authRoutes);
  app.use('/users', userRoutes); 
  app.use('/patients', patientRoutes);
  app.use('/tasks', taskRoutes);
  app.use('/notes', noteRoutes);  
  app.use('/reports', reportRoutes);  
  app.use("/algorithms", algorithmRoutes);
  app.use('/notifications', notificationRoutes);
// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server with Socket.IO running on http://localhost:${PORT}`);
});
