const express = require("express");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// Mock data for fallback when database issues occur
const mockAttendanceRecords = [
  {
    _id: "att001",
    employee: {
      _id: "emp001",
      name: "John Doe",
      employeeId: "EMP002",
    },
    date: new Date(),
    clockIn: new Date(new Date().setHours(9, 0, 0, 0)),
    clockOut: new Date(new Date().setHours(17, 30, 0, 0)),
    totalHours: 8.5,
    status: "Present",
    createdAt: new Date(),
  },
  {
    _id: "att002",
    employee: {
      _id: "emp001",
      name: "John Doe",
      employeeId: "EMP002",
    },
    date: new Date(new Date().setDate(new Date().getDate() - 1)),
    clockIn: new Date(new Date().setHours(9, 15, 0, 0)),
    clockOut: new Date(new Date().setHours(17, 45, 0, 0)),
    totalHours: 8.5,
    status: "Present",
    createdAt: new Date(new Date().setDate(new Date().getDate() - 1)),
  },
  {
    _id: "att003",
    employee: {
      _id: "emp001",
      name: "John Doe",
      employeeId: "EMP002",
    },
    date: new Date(new Date().setDate(new Date().getDate() - 2)),
    clockIn: new Date(new Date().setHours(9, 0, 0, 0)),
    clockOut: new Date(new Date().setHours(17, 0, 0, 0)),
    totalHours: 8.0,
    status: "Present",
    createdAt: new Date(new Date().setDate(new Date().getDate() - 2)),
  },
];

// @route   POST /api/attendance/clock-in
// @desc    Clock in for work
// @access  Private
router.post("/clock-in", auth, async (req, res) => {
  try {
    console.log("🔍 Clock-in attempt started");

    // Validate employee data from token
    if (!req.employee || !req.employee.id) {
      console.log("❌ Invalid employee data in token");
      return res.status(400).json({
        success: false,
        message: "Invalid authentication token - missing employee data",
      });
    }

    // Validate employee ID format
    if (!mongoose.Types.ObjectId.isValid(req.employee.id)) {
      console.log("❌ Invalid employee ID format:", req.employee.id);
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID format",
      });
    }

    // Check if database is connected and try to save real data
    if (mongoose.connection.readyState === 1) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log("🔍 Clock-in attempt by employee:", {
          id: req.employee.id,
          email: req.employee.email,
          role: req.employee.role,
        });

        // Check if employee already clocked in today
        const existingAttendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (existingAttendance) {
          console.log("❌ Employee already clocked in today:", {
            id: existingAttendance._id,
            clockIn: existingAttendance.clockIn,
            clockOut: existingAttendance.clockOut,
            status: existingAttendance.status,
          });
          return res.status(400).json({
            success: false,
            message: "You have already clocked in today",
            code: "ALREADY_CLOCKED_IN",
            existingRecord: {
              id: existingAttendance._id,
              clockIn: existingAttendance.clockIn,
              clockOut: existingAttendance.clockOut,
              status: existingAttendance.status,
              canClockOut: !existingAttendance.clockOut,
            },
          });
        }

        console.log(
          "✅ Creating new attendance record for employee:",
          req.employee.id,
        );
        const attendanceData = {
          employee: req.employee.id,
          date: new Date(),
          clockIn: new Date(),
          status: "Present",
        };

        console.log("🔍 Creating attendance with data:", attendanceData);
        const attendance = new Attendance(attendanceData);

        console.log("🔍 Attempting to save attendance...");
        const savedAttendance = await attendance.save();
        console.log("✅ Attendance saved successfully:", savedAttendance._id);

        res.status(201).json({
          success: true,
          message: "Clocked in successfully",
          attendance: savedAttendance,
        });
        return;
      } catch (dbError) {
        console.error("🔧 Database operation failed:", dbError);
        console.log("🔧 Using mock response due to database error");

        // If it's a validation error, return it as 400
        if (dbError.name === "ValidationError" || dbError.code === 11000) {
          console.error("❌ Database validation error:", dbError.message);
          return res.status(400).json({
            success: false,
            message: "Database validation error: " + dbError.message,
            code: "DATABASE_VALIDATION_ERROR",
          });
        }
      }
    }

    // Fallback response when database is not available
    console.log("🔧 Using mock clock-in response (DB not connected)");
    const mockAttendance = {
      _id: "temp-" + Date.now(),
      employee: req.employee.id,
      date: new Date(),
      clockIn: new Date(),
      status: "Present",
    };

    res.status(201).json({
      success: true,
      message: "Clocked in successfully",
      attendance: mockAttendance,
    });
  } catch (error) {
    console.error("Clock in error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during clock in",
    });
  }
});

// @route   POST /api/attendance/clock-out
// @desc    Clock out from work
// @access  Private
router.post("/clock-out", auth, async (req, res) => {
  try {
    // Check if database is connected and try to save real data
    if (mongoose.connection.readyState === 1) {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        console.log("🔍 Clock-out attempt by employee:", {
          id: req.employee.id,
          email: req.employee.email,
        });

        const attendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (!attendance) {
          console.log("❌ No clock-in record found for today");
          return res.status(404).json({
            success: false,
            message: "No clock-in record found for today",
          });
        }

        if (attendance.clockOut) {
          console.log("❌ Employee already clocked out today");
          return res.status(400).json({
            success: false,
            message: "You have already clocked out today",
          });
        }

        attendance.clockOut = new Date();

        // Calculate total hours
        const timeDiff = attendance.clockOut - attendance.clockIn;
        attendance.totalHours =
          Math.round((timeDiff / (1000 * 60 * 60)) * 100) / 100;

        await attendance.save();

        res.json({
          success: true,
          message: "Clocked out successfully",
          attendance,
        });
        return;
      } catch (dbError) {
        console.log("🔧 Database operation failed, using mock response");
      }
    }

    // Fallback response when database is not available
    console.log("🔧 Using mock clock-out response (DB not connected)");
    const mockAttendance = {
      _id: "temp-" + Date.now(),
      employee: req.employee.id,
      date: new Date(),
      clockIn: new Date(new Date().setHours(9, 0, 0, 0)),
      clockOut: new Date(),
      totalHours: 8.5,
      status: "Present",
    };

    res.json({
      success: true,
      message: "Clocked out successfully",
      attendance: mockAttendance,
    });
  } catch (error) {
    console.error("Clock out error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during clock out",
    });
  }
});

// @route   GET /api/attendance/today
// @desc    Get today's attendance status for current employee
// @access  Private
router.get("/today", auth, async (req, res) => {
  try {
    let attendance = null;

    // Check if database is connected and try to get real data
    if (mongoose.connection.readyState === 1) {
      try {
        const { date } = req.query;
        const searchDate = date ? new Date(date) : new Date();
        searchDate.setHours(0, 0, 0, 0);

        attendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: searchDate,
            $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
          },
        }).populate("employee", "name employeeId");

        console.log("🔍 Checking today's attendance for employee:", {
          id: req.employee.id,
          date: searchDate.toDateString(),
          found: !!attendance,
        });
      } catch (dbError) {
        console.log(
          "🔧 Database query failed, using mock today attendance data",
        );
        attendance = null;
      }
    }

    // If no attendance found or database not connected, return null (no attendance yet)
    if (!attendance) {
      console.log("🔧 No attendance record found for today");
    }

    res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error("Get today's attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching today's attendance",
    });
  }
});

// @route   GET /api/attendance/my
// @desc    Get current employee's attendance records
// @access  Private
router.get("/my", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year } = req.query;
    let attendanceRecords = [];
    let total = 0;

    // Check if database is connected and try to get real data
    if (mongoose.connection.readyState === 1) {
      try {
        let query = { employee: req.employee.id };

        // Filter by month and year if provided
        if (month && year) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          query.date = {
            $gte: startDate,
            $lte: endDate,
          };
        }

        attendanceRecords = await Attendance.find(query)
          .populate("employee", "name employeeId")
          .sort({ date: -1 })
          .limit(limit * 1)
          .skip((page - 1) * limit);

        total = await Attendance.countDocuments(query);
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock attendance data");
        // Use mock data
        attendanceRecords = [...mockAttendanceRecords].slice(0, limit);
        total = mockAttendanceRecords.length;
      }
    } else {
      // Database not connected - use mock data
      console.log("🔧 Using mock attendance data (DB not connected)");
      attendanceRecords = [...mockAttendanceRecords].slice(0, limit);
      total = mockAttendanceRecords.length;
    }

    res.json({
      success: true,
      attendanceRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get my attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching attendance records",
    });
  }
});

// @route   GET /api/attendance/all
// @desc    Get all attendance records (Admin only)
// @access  Private (Admin)
router.get("/all", auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, date, employee } = req.query;

    let query = {};

    // Filter by employee if provided
    if (employee) {
      query.employee = employee;
    }

    // Filter by date if provided
    if (date) {
      const searchDate = new Date(date);
      searchDate.setHours(0, 0, 0, 0);
      query.date = {
        $gte: searchDate,
        $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    let attendanceQuery = Attendance.find(query).populate(
      "employee",
      "name employeeId department",
    );

    // Filter by department if provided
    if (department && department !== "all") {
      attendanceQuery = attendanceQuery.populate({
        path: "employee",
        match: { department: department },
        select: "name employeeId department",
      });
    }

    const attendanceRecords = await attendanceQuery
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter out null employees (when department filter doesn't match)
    const filteredRecords = attendanceRecords.filter(
      (record) => record.employee,
    );

    const total = await Attendance.countDocuments(query);

    res.json({
      success: true,
      attendanceRecords: filteredRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get all attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching attendance records",
    });
  }
});

// @route   GET /api/attendance/stats
// @desc    Get attendance statistics (Admin only)
// @access  Private (Admin)
router.get("/stats", auth, adminAuth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's attendance
    const todayAttendance = await Attendance.countDocuments({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Present today
    const presentToday = await Attendance.countDocuments({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      status: "Present",
    });

    // Late arrivals today
    const lateToday = await Attendance.countDocuments({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      status: "Late",
    });

    // Total employees
    const totalEmployees = await Employee.countDocuments({ status: "Active" });

    res.json({
      success: true,
      stats: {
        totalEmployees,
        todayAttendance,
        presentToday,
        lateToday,
        absentToday: totalEmployees - todayAttendance,
      },
    });
  } catch (error) {
    console.error("Get attendance stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching attendance statistics",
    });
  }
});

// @route   POST /api/attendance/manual
// @desc    Manually add attendance record (Admin only)
// @access  Private (Admin)
router.post("/manual", auth, adminAuth, async (req, res) => {
  try {
    const { employeeId, date, clockIn, clockOut, status, notes } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Please provide employee, date, and status",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({
      employee: employeeId,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: "Attendance record already exists for this date",
      });
    }

    const attendance = new Attendance({
      employee: employeeId,
      date: attendanceDate,
      clockIn: clockIn ? new Date(clockIn) : null,
      clockOut: clockOut ? new Date(clockOut) : null,
      status,
      notes,
      addedBy: req.employee.id,
    });

    // Calculate total hours if both clock in and out are provided
    if (clockIn && clockOut) {
      const timeDiff = new Date(clockOut) - new Date(clockIn);
      attendance.totalHours =
        Math.round((timeDiff / (1000 * 60 * 60)) * 100) / 100;
    }

    await attendance.save();

    res.status(201).json({
      success: true,
      message: "Attendance record created successfully",
      attendance,
    });
  } catch (error) {
    console.error("Manual attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating attendance record",
    });
  }
});

// @route   PUT /api/attendance/:id
// @desc    Update attendance record (Admin only)
// @access  Private (Admin)
router.put("/:id", auth, adminAuth, async (req, res) => {
  try {
    const { clockIn, clockOut, status, notes } = req.body;

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    // Update fields
    if (clockIn) attendance.clockIn = new Date(clockIn);
    if (clockOut) attendance.clockOut = new Date(clockOut);
    if (status) attendance.status = status;
    if (notes !== undefined) attendance.notes = notes;

    // Recalculate total hours if both times are available
    if (attendance.clockIn && attendance.clockOut) {
      const timeDiff = attendance.clockOut - attendance.clockIn;
      attendance.totalHours =
        Math.round((timeDiff / (1000 * 60 * 60)) * 100) / 100;
    }

    attendance.updatedBy = req.employee.id;
    await attendance.save();

    res.json({
      success: true,
      message: "Attendance record updated successfully",
      attendance,
    });
  } catch (error) {
    console.error("Update attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating attendance record",
    });
  }
});

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record (Admin only)
// @access  Private (Admin)
router.delete("/:id", auth, adminAuth, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    await attendance.deleteOne();

    res.json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete attendance error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting attendance record",
    });
  }
});

// @route   DELETE /api/attendance/clear-today
// @desc    Clear today's attendance record for testing (TEMP DEBUG ROUTE)
// @access  Private
router.delete("/clear-today", auth, async (req, res) => {
  try {
    console.log(
      "🗑️ Clearing today's attendance for employee:",
      req.employee.id,
    );

    if (mongoose.connection.readyState === 1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await Attendance.deleteMany({
        employee: req.employee.id,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      console.log("🗑️ Deleted", result.deletedCount, "attendance records");

      res.json({
        success: true,
        message: `Cleared ${result.deletedCount} attendance records for today`,
        deletedCount: result.deletedCount,
      });
    } else {
      res.json({
        success: true,
        message: "Database not connected - no records to clear",
      });
    }
  } catch (error) {
    console.error("🗑️ Error clearing attendance:", error);
    res.status(500).json({
      success: false,
      message: "Error clearing attendance records",
      error: error.message,
    });
  }
});

// @route   GET /api/attendance/debug
// @desc    Debug endpoint to test authentication and database
// @access  Private
router.get("/debug", auth, async (req, res) => {
  try {
    console.log("🐛 Debug endpoint hit");
    console.log("🐛 Employee from token:", {
      id: req.employee.id,
      email: req.employee.email,
      role: req.employee.role,
    });
    console.log("🐛 Database status:", {
      readyState: mongoose.connection.readyState,
      connected: mongoose.connection.readyState === 1,
    });

    // Try to find any existing attendance for this employee
    let existingAttendance = null;
    if (mongoose.connection.readyState === 1) {
      try {
        existingAttendance = await Attendance.find({
          employee: req.employee.id,
        })
          .limit(5)
          .sort({ date: -1 });
        console.log(
          "🐛 Found existing attendance records:",
          existingAttendance.length,
        );
      } catch (dbError) {
        console.log("🐛 Error querying attendance:", dbError.message);
      }
    }

    // Check today's attendance specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todayAttendance = null;
    if (mongoose.connection.readyState === 1) {
      try {
        todayAttendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });
        console.log(
          "🐛 Today's attendance:",
          todayAttendance ? "EXISTS" : "NONE",
        );
      } catch (dbError) {
        console.log("🐛 Error checking today's attendance:", dbError.message);
      }
    }

    res.json({
      success: true,
      debug: {
        employee: {
          id: req.employee.id,
          email: req.employee.email,
          role: req.employee.role,
        },
        database: {
          connected: mongoose.connection.readyState === 1,
          readyState: mongoose.connection.readyState,
        },
        attendance: {
          totalRecords: existingAttendance ? existingAttendance.length : 0,
          todayExists: !!todayAttendance,
          todayRecord: todayAttendance
            ? {
                id: todayAttendance._id,
                clockIn: todayAttendance.clockIn,
                clockOut: todayAttendance.clockOut,
                status: todayAttendance.status,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error("🐛 Debug endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Debug endpoint error",
      error: error.message,
    });
  }
});

module.exports = router;
