const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected for seeding");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Clear existing data
const clearData = async () => {
  try {
    await Employee.deleteMany({});
    await Attendance.deleteMany({});
    await Leave.deleteMany({});
    console.log("Existing data cleared");
  } catch (error) {
    console.error("Error clearing data:", error);
  }
};

// Seed employees
const seedEmployees = async () => {
  try {
    const employees = [
      {
        name: "Admin User",
        email: "admin@company.com",
        password: "admin123",
        department: "Administration",
        position: "System Administrator",
        role: "admin",
        salary: 90000,
        phone: "555-0100",
        status: "Active",
      },
      {
        name: "John Doe",
        email: "john@company.com",
        password: "employee123",
        department: "Engineering",
        position: "Software Developer",
        role: "employee",
        salary: 75000,
        phone: "555-0123",
        status: "Active",
      },
      {
        name: "Jane Smith",
        email: "jane@company.com",
        password: "employee123",
        department: "Engineering",
        position: "UI/UX Designer",
        role: "employee",
        salary: 70000,
        phone: "555-0124",
        status: "Active",
      },
      {
        name: "Mike Johnson",
        email: "mike@company.com",
        password: "employee123",
        department: "Marketing",
        position: "Marketing Manager",
        role: "employee",
        salary: 80000,
        phone: "555-0125",
        status: "Active",
      },
      {
        name: "Sarah Wilson",
        email: "sarah@company.com",
        password: "employee123",
        department: "HR",
        position: "HR Manager",
        role: "employee",
        salary: 78000,
        phone: "555-0126",
        status: "Active",
      },
      {
        name: "David Brown",
        email: "david@company.com",
        password: "employee123",
        department: "Engineering",
        position: "Senior Developer",
        role: "employee",
        salary: 85000,
        phone: "555-0127",
        status: "Active",
      },
      {
        name: "Emily Davis",
        email: "emily@company.com",
        password: "employee123",
        department: "Finance",
        position: "Financial Analyst",
        role: "employee",
        salary: 72000,
        phone: "555-0128",
        status: "Active",
      },
      {
        name: "Robert Taylor",
        email: "robert@company.com",
        password: "employee123",
        department: "Sales",
        position: "Sales Representative",
        role: "employee",
        salary: 65000,
        phone: "555-0129",
        status: "Active",
      },
    ];

    const createdEmployees = await Employee.create(employees);
    console.log(`${createdEmployees.length} employees created`);
    return createdEmployees;
  } catch (error) {
    console.error("Error seeding employees:", error);
  }
};

// Seed attendance records
const seedAttendance = async (employees) => {
  try {
    const attendanceRecords = [];
    const today = new Date();

    // Create attendance for the last 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      employees.forEach((employee, index) => {
        // Random attendance pattern (90% attendance rate)
        if (Math.random() > 0.1) {
          const clockInHour = 8 + Math.floor(Math.random() * 2); // 8-9 AM
          const clockInMinute = Math.floor(Math.random() * 60);
          const clockOutHour = 17 + Math.floor(Math.random() * 2); // 5-6 PM
          const clockOutMinute = Math.floor(Math.random() * 60);

          const clockIn = new Date(date);
          clockIn.setHours(clockInHour, clockInMinute, 0, 0);

          const clockOut = new Date(date);
          clockOut.setHours(clockOutHour, clockOutMinute, 0, 0);

          const timeDiff = clockOut - clockIn;
          const totalHours =
            Math.round((timeDiff / (1000 * 60 * 60)) * 100) / 100;

          attendanceRecords.push({
            employee: employee._id,
            date: new Date(date),
            clockIn,
            clockOut,
            totalHours,
            status: clockInHour >= 9 ? "Late" : "Present",
          });
        }
      });
    }

    const createdAttendance = await Attendance.create(attendanceRecords);
    console.log(`${createdAttendance.length} attendance records created`);
  } catch (error) {
    console.error("Error seeding attendance:", error);
  }
};

// Seed leave requests
const seedLeaves = async (employees) => {
  try {
    const leaveTypes = ["Annual", "Sick", "Personal", "Emergency"];
    const statuses = ["Pending", "Approved", "Rejected"];
    const leaveRecords = [];

    // Create some leave requests for each employee
    employees.forEach((employee, index) => {
      // 2-3 leave requests per employee
      const numLeaves = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < numLeaves; i++) {
        const type = leaveTypes[Math.floor(Math.random() * leaveTypes.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        // Random dates in the next 60 days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60));

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);

        const timeDiff = endDate.getTime() - startDate.getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;

        leaveRecords.push({
          employee: employee._id,
          type,
          startDate,
          endDate,
          totalDays,
          reason: `${type} leave request`,
          status,
          createdAt: new Date(
            Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          ), // Random creation date in last 30 days
        });
      }
    });

    const createdLeaves = await Leave.create(leaveRecords);
    console.log(`${createdLeaves.length} leave requests created`);
  } catch (error) {
    console.error("Error seeding leaves:", error);
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectDB();

    console.log("Starting database seeding...");

    await clearData();
    const employees = await seedEmployees();

    if (employees && employees.length > 0) {
      await seedAttendance(employees);
      await seedLeaves(employees);
    }

    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

// Run seeding if script is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
