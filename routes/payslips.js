const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const Payslip = require("../models/Payslip");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads/payslips");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: employeeId_month_year_timestamp.pdf
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const { employeeId, month, year } = req.body;
    const filename = `${employeeId}_${month}_${year}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

// File filter to only allow PDF files
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// @route   POST /api/payslips/upload
// @desc    Upload payslip for an employee (Admin only)
// @access  Private (Admin)
router.post("/upload", auth, upload.single("payslip"), async (req, res) => {
  try {
    // Check if user is admin
    if (req.employee.role !== "admin") {
      // Delete uploaded file if user is not admin
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const { employeeId, month, year } = req.body;

    // Validate required fields
    if (!employeeId || !month || !year) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Employee ID, month, and year are required",
      });
    }

    // Validate month and year
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Month must be between 1 and 12",
      });
    }

    if (yearNum < 2020 || yearNum > new Date().getFullYear() + 1) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        success: false,
        message: "Invalid year",
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Check if employee exists
    const employee = await Employee.findById(employeeId);
    if (!employee) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if payslip already exists for this employee and period
    const existingPayslip = await Payslip.findByEmployeeAndPeriod(
      employeeId,
      monthNum,
      yearNum,
    );

    if (existingPayslip) {
      // Delete old file
      if (fs.existsSync(existingPayslip.filePath)) {
        fs.unlinkSync(existingPayslip.filePath);
      }
      // Delete old record
      await Payslip.findByIdAndDelete(existingPayslip._id);
    }

    // Create new payslip record
    const payslip = new Payslip({
      employee: employeeId,
      month: monthNum,
      year: yearNum,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.employee.id,
    });

    await payslip.save();

    // Populate the payslip data for response
    await payslip.populate("employee", "name email employeeId");
    await payslip.populate("uploadedBy", "name email");

    res.status(201).json({
      success: true,
      message: "Payslip uploaded successfully",
      payslip: {
        id: payslip._id,
        employee: payslip.employee,
        monthYear: payslip.monthYear,
        fileName: payslip.originalName,
        fileSize: payslip.fileSize,
        uploadedBy: payslip.uploadedBy,
        uploadedAt: payslip.createdAt,
      },
    });
  } catch (error) {
    // Delete uploaded file if there's an error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Error uploading payslip:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Payslip for this employee and period already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while uploading payslip",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @route   GET /api/payslips
// @desc    Get all payslips (Admin) or employee's own payslips
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    console.log("📋 Fetching payslips for:", {
      id: req.employee.id,
      role: req.employee.role,
      email: req.employee.email,
    });

    let payslips;

    if (req.employee.role === "admin") {
      // Admin can see all payslips
      payslips = await Payslip.find()
        .populate("employee", "name email employeeId department")
        .populate("uploadedBy", "name email")
        .sort({ year: -1, month: -1 });
      console.log(`📋 Admin fetched ${payslips.length} payslips`);
    } else {
      // Employee can only see their own payslips
      payslips = await Payslip.findByEmployee(req.employee.id);
      console.log(
        `📋 Employee fetched ${payslips.length} payslips for ID: ${req.employee.id}`,
      );

      // Log each payslip to verify ownership
      payslips.forEach((payslip) => {
        console.log(
          `  - Payslip ${payslip._id}: ${payslip.monthYear} (Owner: ${payslip.employee._id})`,
        );
        console.log(
          `    Belongs to current employee: ${payslip.employee._id.toString() === req.employee.id.toString()}`,
        );
      });
    }

    const formattedPayslips = payslips.map((payslip) => ({
      id: payslip._id,
      employee: payslip.employee,
      month: payslip.month,
      year: payslip.year,
      monthYear: payslip.monthYear,
      fileName: payslip.originalName,
      fileSize: payslip.fileSize,
      uploadedBy: payslip.uploadedBy,
      uploadedAt: payslip.createdAt,
      downloadedAt: payslip.downloadedAt,
      downloadCount: payslip.downloadCount,
    }));

    res.json({
      success: true,
      payslips: formattedPayslips,
    });
  } catch (error) {
    console.error("Error fetching payslips:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching payslips",
    });
  }
});

// @route   GET /api/payslips/download/:id
// @desc    Download a specific payslip
// @access  Private
router.get("/download/:id", auth, async (req, res) => {
  try {
    console.log("🔍 Download request debug:");
    console.log("  - Requested payslip ID:", req.params.id);
    console.log("  - Current employee:", {
      id: req.employee.id,
      role: req.employee.role,
      email: req.employee.email,
    });

    // Validate payslip ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("❌ Invalid payslip ID format");
      return res.status(400).json({
        success: false,
        message: "Invalid payslip ID format",
      });
    }

    // Validate employee ID format
    if (!req.employee.id || !mongoose.Types.ObjectId.isValid(req.employee.id)) {
      console.log("❌ Invalid employee ID in token");
      return res.status(401).json({
        success: false,
        message: "Invalid employee ID in authentication token",
      });
    }

    const payslip = await Payslip.findById(req.params.id).populate(
      "employee",
      "name email employeeId",
    );

    if (!payslip) {
      console.log("❌ Payslip not found");
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    console.log("  - Payslip owner ID:", payslip.employee._id.toString());
    console.log("  - Requesting employee ID:", req.employee.id.toString());

    // Check if this is the employee's own payslip using direct comparison
    const isOwnPayslip =
      payslip.employee._id.toString() === req.employee.id.toString();
    const isAdmin = req.employee.role === "admin";

    console.log("  - Is own payslip?", isOwnPayslip);
    console.log("  - Is admin?", isAdmin);
    console.log(
      "  - Can download (legacy method)?",
      payslip.canEmployeeDownload(req.employee.id),
    );

    // Check permissions: Admin can download any payslip, employee can only download their own
    if (!isAdmin && !isOwnPayslip) {
      console.log(
        "❌ Access denied - employee trying to download another employee's payslip",
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only download your own payslips.",
        debug: {
          yourId: req.employee.id,
          payslipOwnerId: payslip.employee._id.toString(),
          isOwnPayslip: isOwnPayslip,
          isAdmin: isAdmin,
          payslipOwnerName: payslip.employee.name,
        },
      });
    }

    // Check if file exists
    if (!fs.existsSync(payslip.filePath)) {
      return res.status(404).json({
        success: false,
        message: "Payslip file not found on server",
      });
    }

    // Update download tracking (only for employees, not admin)
    if (!isAdmin) {
      payslip.downloadedAt = new Date();
      payslip.downloadCount += 1;
      await payslip.save();
      console.log(
        "📊 Download tracking updated - count:",
        payslip.downloadCount,
      );
    } else {
      console.log("📊 Admin download - no tracking update");
    }

    // Set proper headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${payslip.originalName}"`,
    );
    res.setHeader("Content-Length", payslip.fileSize);

    // Stream the file
    const fileStream = fs.createReadStream(payslip.filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error downloading payslip:", error);
    res.status(500).json({
      success: false,
      message: "Server error while downloading payslip",
    });
  }
});

// @route   DELETE /api/payslips/:id
// @desc    Delete a payslip (Admin only)
// @access  Private (Admin)
router.delete("/:id", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({
        success: false,
        message: "Payslip not found",
      });
    }

    // Delete the file from filesystem
    if (fs.existsSync(payslip.filePath)) {
      fs.unlinkSync(payslip.filePath);
    }

    // Delete the record from database
    await Payslip.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Payslip deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting payslip:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting payslip",
    });
  }
});

// @route   GET /api/payslips/employee/:employeeId
// @desc    Get payslips for a specific employee (Admin only)
// @access  Private (Admin)
router.get("/employee/:employeeId", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const payslips = await Payslip.findByEmployee(req.params.employeeId);

    const formattedPayslips = payslips.map((payslip) => ({
      id: payslip._id,
      employee: payslip.employee,
      month: payslip.month,
      year: payslip.year,
      monthYear: payslip.monthYear,
      fileName: payslip.originalName,
      fileSize: payslip.fileSize,
      uploadedBy: payslip.uploadedBy,
      uploadedAt: payslip.createdAt,
      downloadedAt: payslip.downloadedAt,
      downloadCount: payslip.downloadCount,
    }));

    res.json({
      success: true,
      payslips: formattedPayslips,
    });
  } catch (error) {
    console.error("Error fetching employee payslips:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching employee payslips",
    });
  }
});

// @route   GET /api/payslips/debug/my-payslips
// @desc    Debug route to check employee's payslips
// @access  Private
router.get("/debug/my-payslips", auth, async (req, res) => {
  try {
    console.log("🐛 Debug: Checking payslips for employee:", {
      id: req.employee.id,
      role: req.employee.role,
      email: req.employee.email,
    });

    // Find all payslips for this employee
    const payslips = await Payslip.find({ employee: req.employee.id })
      .populate("employee", "name email employeeId")
      .populate("uploadedBy", "name email");

    console.log(
      `🐛 Found ${payslips.length} payslips for employee ${req.employee.id}`,
    );

    // Also find all payslips in the system
    const allPayslips = await Payslip.find({})
      .populate("employee", "name email employeeId")
      .populate("uploadedBy", "name email");

    console.log(`🐛 Total payslips in system: ${allPayslips.length}`);
    allPayslips.forEach((p) => {
      console.log(
        `  - Payslip ${p._id} belongs to employee ${p.employee._id} (${p.employee.name})`,
      );
    });

    res.json({
      success: true,
      employee: {
        id: req.employee.id,
        role: req.employee.role,
        email: req.employee.email,
      },
      myPayslips: payslips.map((p) => ({
        id: p._id,
        monthYear: p.monthYear,
        employee: p.employee,
        canDownload: p.employee._id.toString() === req.employee.id.toString(),
      })),
      allPayslips: allPayslips.map((p) => ({
        id: p._id,
        monthYear: p.monthYear,
        employeeId: p.employee._id,
        employeeName: p.employee.name,
        belongsToMe: p.employee._id.toString() === req.employee.id.toString(),
      })),
    });
  } catch (error) {
    console.error("🐛 Debug route error:", error);
    res.status(500).json({
      success: false,
      message: "Debug route error",
      error: error.message,
    });
  }
});

module.exports = router;
