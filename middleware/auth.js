const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization");

    // Check if no token
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token, authorization denied",
      });
    }

    // Verify token
    let actualToken = token;
    if (token.startsWith("Bearer ")) {
      actualToken = token.slice(7, token.length);
    }

    const decoded = jwt.verify(
      actualToken,
      process.env.JWT_SECRET || "fallback-secret",
    );

    console.log("🔍 JWT decoded successfully:", {
      hasEmployee: !!decoded.employee,
      employeeId: decoded.employee?.id,
      employeeEmail: decoded.employee?.email,
    });

    // Validate decoded token structure
    if (!decoded.employee) {
      console.log("❌ Invalid token structure - missing employee data");
      return res.status(401).json({
        success: false,
        message: "Invalid token structure",
      });
    }

    if (!decoded.employee.id) {
      console.log("❌ Invalid token structure - missing employee ID");
      return res.status(401).json({
        success: false,
        message: "Invalid token structure - missing employee ID",
      });
    }

    // Validate against database if connected
    if (mongoose.connection.readyState === 1) {
      const employee = await Employee.findById(decoded.employee.id);
      if (!employee || employee.status !== "Active") {
        console.log("❌ Employee not found or inactive in database");
        return res.status(401).json({
          success: false,
          message: "Token is no longer valid",
        });
      }
      console.log("✅ Employee validated against database");
    } else {
      // Database not connected - trust the token for now
      console.log(
        "🔧 Auth middleware using token validation only (DB not connected)",
      );
    }

    // Add employee info to request
    req.employee = decoded.employee;
    console.log("✅ req.employee set:", {
      id: req.employee.id,
      email: req.employee.email,
      role: req.employee.role,
    });
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(401).json({
      success: false,
      message: "Token is not valid",
    });
  }
};

// Admin authorization middleware
const adminAuth = (req, res, next) => {
  try {
    if (req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }
    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = auth;
module.exports.adminAuth = adminAuth;
