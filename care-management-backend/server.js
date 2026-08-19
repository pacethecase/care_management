// server.js
const express    = require("express");
const cors       = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const http       = require("http");
const socketIo   = require("socket.io");
require("dotenv").config();

// ─── Routes ───────────────────────────────────────────────────────────────────
const authRoutes         = require("./routes/authRoutes");
const userRoutes         = require("./routes/userRoutes");
const patientRoutes      = require("./routes/patientRoutes");
const taskRoutes         = require("./routes/taskRoutes");
const noteRoutes         = require("./routes/noteRoutes");
const reportRoutes       = require("./routes/reportRoutes");
const algorithmRoutes    = require("./routes/algorithmRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const hospitalRoutes     = require("./routes/hospitalRoutes");
const adminRoutes        = require("./routes/adminRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const publicRoutes       = require("./routes/publicRoutes");
const approvalRoutes     = require("./routes/approvalRoutes");
const path = require("path");
const setupMissedTaskJob    = require("./controller/missedTaskJob");
const setupCourtReminderJob = require("./controller/setupCourtReminderJob");

const app    = express();
const server = http.createServer(app);

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://care-management-nine.vercel.app",
  "https://www.pacethecase.com",
  "https://pacethecase.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-timezone"],
  credentials: true,
};

// FIX: define corsOptions once, use everywhere — was duplicated before
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(cookieParser());
app.use(bodyParser.json());
app.use('/static', express.static(path.join(__dirname, 'public')));
// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = socketIo(server, {
  cors: { origin: allowedOrigins, credentials: true },
  path: "/socket.io",
});

app.set("io", io);

io.on("connection", (socket) => {
  socket.on("join", (room) => {
    socket.join(room);
    console.log(`Joined room: ${room}`);
  });
  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});


setupMissedTaskJob(io);
setupCourtReminderJob(io);


app.use("/auth",          authRoutes);
app.use("/users",         userRoutes);
app.use("/patients",      patientRoutes);
app.use("/tasks",         taskRoutes);
app.use("/notes",         noteRoutes);
app.use("/reports",       reportRoutes);
app.use("/algorithms",    algorithmRoutes);
app.use("/notifications", notificationRoutes);
app.use("/hospitals",     hospitalRoutes);
app.use("/admin",         adminRoutes);
app.use("/organizations", organizationRoutes);
app.use("/public",        publicRoutes);
app.use("/approval", approvalRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});