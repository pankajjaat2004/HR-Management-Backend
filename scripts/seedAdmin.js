const mongoose = require("mongoose");
const Employee = require("../models/Employee");
require("dotenv").config();

const dbURL = process.env.MONGODB_URI;

const seedAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      dbURL,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );

    console.log("📡 Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Employee.findOne({
      email: "admin@company.com",
    });

    if (existingAdmin) {
      console.log("👤 Admin user already exists");
      process.exit(0);
    }

    // Create admin user
    const adminUser = new Employee({
      name: "System Administrator",
      email: "admin@company.com",
      password: "admin123", // This will be hashed by the pre-save middleware
      employeeId: "ADMIN001",
      department: "Administration",
      position: "System Administrator",
      salary: 120000,
      role: "admin",
      status: "Active",
      phone: "+1 (555) 000-0001",
      address: {
        street: "123 Admin Street",
        city: "Tech City",
        state: "CA",
        zipCode: "90210",
        country: "USA",
      },
      emergencyContact: {
        name: "IT Support",
        relationship: "Department",
        phone: "+1 (555) 000-0002",
      },
    });

    await adminUser.save();

    console.log("✅ Admin user created successfully!");
    console.log("📧 Email: admin@company.com");
    console.log("🔐 Password: admin123");
    console.log("🎭 Role: admin");
    console.log("🆔 Employee ID:", adminUser.employeeId);

    // Also create a demo employee
    const demoEmployee = new Employee({
      name: "Demo Employee",
      email: "demo@company.com",
      password: "demo123",
      employeeId: "DEMO0001",
      department: "Engineering",
      position: "Software Developer",
      salary: 75000,
      role: "manager",
      status: "Active",
      phone: "+1 (555) 123-4567",
      address: {
        street: "456 Demo Avenue",
        city: "Dev City",
        state: "CA",
        zipCode: "90211",
        country: "USA",
      },
    });

    await demoEmployee.save();

    console.log("✅ Demo employee created successfully!");
    console.log("📧 Email: demo@company.com");
    console.log("🔐 Password: demo123");
    console.log("🎭 Role: employee");
    console.log("🆔 Employee ID:", demoEmployee.employeeId);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding admin user:", error);
    process.exit(1);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  seedAdminUser();
}

module.exports = seedAdminUser;
