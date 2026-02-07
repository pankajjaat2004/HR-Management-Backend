const mongoose = require("mongoose");
require("dotenv").config();

const Employee = require("./models/Employee");
const Payslip = require("./models/Payslip");

async function debugPayslips() {
  try {
    // Connect to database
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("Connected to MongoDB");
    } else {
      console.log("No MONGODB_URI found");
      return;
    }

    // Check employees
    const employees = await Employee.find({});
    console.log(`\n📋 Found ${employees.length} employees:`);
    employees.forEach((emp) => {
      console.log(
        `  - ${emp.name} (${emp.email}) - Role: ${emp.role} - ID: ${emp._id}`,
      );
    });

    // Check payslips
    const payslips = await Payslip.find({})
      .populate("employee", "name email")
      .populate("uploadedBy", "name email");
    console.log(`\n💰 Found ${payslips.length} payslips:`);
    payslips.forEach((payslip) => {
      console.log(
        `  - ${payslip.monthYear} for ${payslip.employee?.name || "Unknown"} (Employee ID: ${payslip.employee?._id})`,
      );
      console.log(`    Uploaded by: ${payslip.uploadedBy?.name || "Unknown"}`);
      console.log(`    File: ${payslip.originalName}`);
    });

    // Create a test payslip for the first non-admin employee if none exist
    const regularEmployee = employees.find((emp) => emp.role !== "admin");
    if (regularEmployee && payslips.length === 0) {
      console.log(`\n🧪 Creating test payslip for ${regularEmployee.name}...`);

      const testPayslip = new Payslip({
        employee: regularEmployee._id,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        fileName: `test_payslip_${Date.now()}.pdf`,
        originalName: `${regularEmployee.name}_Payslip_${new Date().toISOString().split("T")[0]}.pdf`,
        filePath: `/fake/path/test.pdf`,
        fileSize: 1024,
        mimeType: "application/pdf",
        uploadedBy:
          employees.find((emp) => emp.role === "admin")?._id ||
          regularEmployee._id,
      });

      await testPayslip.save();
      console.log("✅ Test payslip created");
    }

    mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
    mongoose.disconnect();
  }
}

debugPayslips();
