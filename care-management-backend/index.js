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
const cookieParser = require("cookie-parser");

require('./controller/missedTaskJob');
require("dotenv").config();
const app = express();

app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  }));
  
  app.use(cookieParser());
  app.options("*", cors());
  
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
// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
