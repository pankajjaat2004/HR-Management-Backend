const mongoose = require("mongoose");
require("dotenv").config();

const Employee = require("../models/Employee");

const createAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Employee.findOne({
      email: "admin@company.com",
    });
    if (existingAdmin) {
      console.log("Admin user already exists");
      process.exit(0);
    }

    // Create admin user
    const admin = new Employee({
      name: "Admin User",
      email: "admin@company.com",
      password: "admin123",
      department: "Administration",
      position: "System Administrator",
      role: "admin",
      salary: 90000,
      phone: "555-0100",
      status: "Active",
    });

    await admin.save();
    console.log("Admin user created successfully!");
    console.log("Email: admin@company.com");
    console.log("Password: admin123");

    process.exit(0);
  } catch (error) {
    console.error("Error creating admin:", error);
    process.exit(1);
  }
};

createAdmin();
