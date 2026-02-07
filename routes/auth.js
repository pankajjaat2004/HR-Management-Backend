const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");

const router = express.Router();

// Mock users for when database is not available
const mockUsers = [
  {
    _id: "admin001",
    name: "Admin User",
    email: "admin@company.com",
    password: "admin123",
    employeeId: "EMP001",
    department: "Administration",
    position: "System Administrator",
    role: "admin",
    status: "Active",
  },
  {
    _id: "emp001",
    name: "John Doe",
    email: "john@company.com",
    password: "employee123",
    employeeId: "EMP002",
    department: "Engineering",
    position: "Software Developer",
    role: "employee",
    status: "Active",
  },
];

// @route   POST /api/auth/login
// @desc    Authenticate employee & get token
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    let employee = null;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      // Database connected - use real data
      employee = await Employee.findOne({ email }).select("+password");

      if (!employee) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check if employee is active
      if (employee.status !== "Active") {
        return res.status(401).json({
          success: false,
          message: "Account is not active. Please contact HR.",
        });
      }

      // Check password
      const isMatch = await employee.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }
    } else {
      // Database not connected - use mock data
      console.log("🔧 Using mock authentication (DB not connected)");
      employee = mockUsers.find((user) => user.email === email);

      if (!employee || employee.password !== password) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }
    }

    // Create JWT token
    const payload = {
      employee: {
        id: employee._id,
        email: employee.email,
        role: employee.role,
        employeeId: employee.employeeId,
      },
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || "fallback-secret",
      {
        expiresIn: "24h",
      },
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        employeeId: employee.employeeId,
        department: employee.department,
        position: employee.position,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
});

// @route   POST /api/auth/register
// @desc    Register new employee (Admin only)
// @access  Private (Admin)
router.post("/register", auth, async (req, res) => {
  try {
    // Check if user is admin
    if (req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    const {
      name,
      email,
      password,
      department,
      position,
      salary,
      phone,
      address,
      role = "employee",
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !department || !position || !salary) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if employee already exists
    const existingEmployee = await Employee.findOne({ email });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: "Employee with this email already exists",
      });
    }

    // Create new employee
    const employee = new Employee({
      name,
      email,
      password,
      department,
      position,
      salary,
      phone,
      address,
      role,
    });

    await employee.save();

    res.status(201).json({
      success: true,
      message: "Employee created successfully",
      employee: {
        id: employee._id,
        name: employee.name,
        email: employee.email,
        employeeId: employee.employeeId,
        department: employee.department,
        position: employee.position,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current employee
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    let employee = null;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      // Database connected - use real data
      employee = await Employee.findById(req.employee.id)
        .populate("manager", "name employeeId")
        .select("-password");
    } else {
      // Database not connected - use mock data
      console.log("🔧 Using mock user data (DB not connected)");
      employee = mockUsers.find((user) => user._id === req.employee.id);
      if (employee) {
        // Remove password from response
        const { password, ...employeeData } = employee;
        employee = employeeData;
      }
    }

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update employee profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const { phone, address, emergencyContact } = req.body;

    const employee = await Employee.findById(req.employee.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Update allowed fields
    if (phone) employee.phone = phone;
    if (address) employee.address = address;
    if (emergencyContact) employee.emergencyContact = emergencyContact;

    await employee.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      employee,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during profile update",
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change password
// @access  Private
router.put("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      });
    }

    const employee = await Employee.findById(req.employee.id).select(
      "+password",
    );
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check current password
    const isMatch = await employee.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    employee.password = newPassword;
    await employee.save();

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password change",
    });
  }
});

// @route   PUT /api/auth/reset-password/:employeeId
// @desc    Reset employee password (Admin only)
// @access  Private (Admin)
router.put("/reset-password/:employeeId", auth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { employeeId } = req.params;

    // Check if user is admin
    if (req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Update password
    employee.password = newPassword;
    await employee.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password reset",
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout employee
// @access  Private
router.post("/logout", auth, (req, res) => {
  // In a more advanced implementation, you might want to maintain a blacklist of tokens
  // For now, we'll just send a success response
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

module.exports = router;
