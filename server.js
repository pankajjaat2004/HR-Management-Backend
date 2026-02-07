const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const dbURL = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
if (dbURL) {
  mongoose
    .connect(dbURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    })
    .then(async () => {
      console.log("MongoDB connected successfully");

      // Create admin user if none exists
      try {
        const Employee = require("./models/Employee");
        const adminExists = await Employee.findOne({ role: "admin" });

        if (!adminExists) {
          const admin = new Employee({
            name: "Admin User",
            email: "admin@worldwiseedu.in",
            password: "admin123",
            department: "Administration",
            position: "System Administrator",
            role: "admin",
            salary: 1,
            phone: "",
            status: "Active",
          });

          await admin.save();
          console.log("🔑 Default admin user created:");
          console.log("   Email: admin@company.com");
          console.log("   Password: admin123");
        }
      } catch (error) {
        console.error("Error creating default admin:", error);
      }
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      console.log(
        "⚠️  Running without database connection - some features may not work",
      );
    });
} else {
  console.log("⚠️  No MONGODB_URI provided - running without database");
}

// Import routes
const authRoutes = require("./routes/auth");
const employeeRoutes = require("./routes/employees");
const attendanceRoutes = require("./routes/attendance");
const leaveRoutes = require("./routes/leaves");
const holidayRoutes = require("./routes/holidays");
const payslipRoutes = require("./routes/payslips");
const callsRoutes = require("./routes/calls");

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/payslips", payslipRoutes);
app.use("/api/calls", callsRoutes);

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    message: "WorkFlow HR Management API is running!",
    timestamp: new Date().toISOString(),
  });
});

// Note: Static files are served separately on Render
// Frontend is deployed as a static site on a separate Render service

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : {},
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 HR Management API: http://localhost:${PORT}/api/test`);
});
