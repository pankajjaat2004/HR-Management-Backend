const express = require("express");
const mongoose = require("mongoose");
const CallData = require("../models/CallData");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const auth = require("../middleware/auth");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// @route   POST /api/calls
// @desc    Add or update call data for the day
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const {
      totalCalls,
      totalCallTime,
      interestedStudents,
      visitedToday,
      notes,
      date,
      employee,
    } = req.body;

    // Validate required fields
    if (
      totalCalls === undefined ||
      totalCallTime === undefined ||
      interestedStudents === undefined ||
      visitedToday === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Determine which employee to add data for
    let employeeId = req.employee.id;

    // If admin is adding data for another employee
    if (employee && req.employee.role === "admin") {
      employeeId = employee;
    } else if (employee && req.employee.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can add data for other employees",
      });
    }

    const recordDate = date ? new Date(date) : new Date();
    recordDate.setHours(0, 0, 0, 0);

    // Check if employee has checked out for this day (skip for admins)
    if (req.employee.role !== "admin") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday =
        recordDate.getTime() === today.getTime();

      if (isToday) {
        // Check attendance status for today
        const attendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (attendance && attendance.clockOut) {
          return res.status(400).json({
            success: false,
            message: "Cannot add/edit call data after checking out",
          });
        }
      }
    }

    // Find or create call data for the day
    let callData = await CallData.findOne({
      employee: employeeId,
      date: {
        $gte: recordDate,
        $lt: new Date(recordDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (callData) {
      // Update existing record
      callData.totalCalls = totalCalls;
      callData.totalCallTime = totalCallTime;
      callData.interestedStudents = interestedStudents;
      callData.visitedToday = visitedToday;
      callData.notes = notes || callData.notes;
      callData.updatedAt = new Date();
      callData.updatedBy = req.employee.id;
    } else {
      // Create new record
      callData = new CallData({
        employee: employeeId,
        date: recordDate,
        totalCalls,
        totalCallTime,
        interestedStudents,
        visitedToday,
        notes,
      });
    }

    await callData.save();

    res.status(201).json({
      success: true,
      message: callData.updatedBy ? "Call data updated successfully" : "Call data added successfully",
      callData,
    });
  } catch (error) {
    console.error("Create/Update call data error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Call data for this date already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while adding/updating call data",
    });
  }
});

// @route   GET /api/calls/my
// @desc    Get current employee's call data records
// @access  Private
router.get("/my", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, month, year } = req.query;

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

    const callDataRecords = await CallData.find(query)
      .populate("employee", "name employeeId")
      .populate("updatedBy", "name")
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CallData.countDocuments(query);

    res.json({
      success: true,
      callDataRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get my call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching call data",
    });
  }
});

// @route   GET /api/calls/today
// @desc    Get today's call data for current employee
// @access  Private
router.get("/today", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const callData = await CallData.findOne({
      employee: req.employee.id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    }).populate("employee", "name employeeId");

    res.json({
      success: true,
      callData,
    });
  } catch (error) {
    console.error("Get today's call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching call data",
    });
  }
});

// @route   GET /api/calls/all
// @desc    Get all call data (Admin only)
// @access  Private (Admin)
router.get("/all", auth, adminAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      date,
      employee,
      sortBy = "performanceScore",
      order = "-1",
    } = req.query;

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

    let callQuery = CallData.find(query).populate(
      "employee",
      "name employeeId department"
    );

    // Filter by department if provided
    if (department && department !== "all") {
      callQuery = callQuery.populate({
        path: "employee",
        match: { department: department },
        select: "name employeeId department",
      });
    }

    const callDataRecords = await callQuery
      .sort({ [sortBy]: parseInt(order) })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Filter out null employees (when department filter doesn't match)
    const filteredRecords = callDataRecords.filter((record) => record.employee);

    const total = await CallData.countDocuments(query);

    res.json({
      success: true,
      callDataRecords: filteredRecords,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get all call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching call data",
    });
  }
});

// @route   GET /api/calls/performance
// @desc    Get performance analytics for all employees (Admin only)
// @access  Private (Admin)
router.get("/performance/stats", auth, adminAuth, async (req, res) => {
  try {
    const { month, year, department } = req.query;

    let query = {};

    // Filter by month and year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    let employeeQuery = Employee.find({ status: "Active" });

    // Filter by department if provided
    if (department && department !== "all") {
      employeeQuery = employeeQuery.where("department").equals(department);
    }

    const employees = await employeeQuery;
    const employeeIds = employees.map((emp) => emp._id);

    // Get call data for these employees
    const callDataRecords = await CallData.find({
      employee: { $in: employeeIds },
      ...query,
    }).populate("employee", "name employeeId department");

    // Group by employee and calculate stats
    const performanceData = {};

    callDataRecords.forEach((record) => {
      const empId = record.employee._id.toString();
      if (!performanceData[empId]) {
        performanceData[empId] = {
          employee: record.employee,
          totalCalls: 0,
          totalCallTime: 0,
          totalInterestedStudents: 0,
          totalVisited: 0,
          performanceScore: 0,
          recordCount: 0,
        };
      }

      performanceData[empId].totalCalls += record.totalCalls;
      performanceData[empId].totalCallTime += record.totalCallTime;
      performanceData[empId].totalInterestedStudents +=
        record.interestedStudents;
      performanceData[empId].totalVisited += record.visitedToday;
      performanceData[empId].performanceScore += record.performanceScore;
      performanceData[empId].recordCount += 1;
    });

    // Convert to array and sort by performance score
    const performanceArray = Object.values(performanceData).sort(
      (a, b) => b.performanceScore - a.performanceScore
    );

    // Get top performer
    const topPerformer =
      performanceArray.length > 0 ? performanceArray[0] : null;

    // Calculate overall stats
    const overallStats = {
      totalEmployeesTracked: performanceArray.length,
      totalCalls: performanceArray.reduce((sum, p) => sum + p.totalCalls, 0),
      totalCallTime: performanceArray.reduce(
        (sum, p) => sum + p.totalCallTime,
        0
      ),
      totalInterestedStudents: performanceArray.reduce(
        (sum, p) => sum + p.totalInterestedStudents,
        0
      ),
      totalVisited: performanceArray.reduce(
        (sum, p) => sum + p.totalVisited,
        0
      ),
      averagePerformanceScore:
        performanceArray.length > 0
          ? (
              performanceArray.reduce((sum, p) => sum + p.performanceScore, 0) /
              performanceArray.length
            ).toFixed(2)
          : 0,
    };

    res.json({
      success: true,
      topPerformer,
      performanceData: performanceArray,
      overallStats,
    });
  } catch (error) {
    console.error("Get performance stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching performance statistics",
    });
  }
});

// @route   PUT /api/calls/:id
// @desc    Update call data (Employee can update own data before checkout)
// @access  Private
router.put("/:id", auth, async (req, res) => {
  try {
    const { totalCalls, totalCallTime, interestedStudents, visitedToday, notes } = req.body;

    const callData = await CallData.findById(req.params.id);
    if (!callData) {
      return res.status(404).json({
        success: false,
        message: "Call data not found",
      });
    }

    // Check if user can edit this data
    if (
      callData.employee.toString() !== req.employee.id &&
      req.employee.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // For employees, check if they've checked out
    if (req.employee.role !== "admin") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recordDate = new Date(callData.date);
      recordDate.setHours(0, 0, 0, 0);

      const isToday = recordDate.getTime() === today.getTime();

      if (isToday) {
        const attendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (attendance && attendance.clockOut) {
          return res.status(400).json({
            success: false,
            message: "Cannot edit call data after checking out",
          });
        }
      }
    }

    // Update fields
    if (totalCalls !== undefined) callData.totalCalls = totalCalls;
    if (totalCallTime !== undefined) callData.totalCallTime = totalCallTime;
    if (interestedStudents !== undefined)
      callData.interestedStudents = interestedStudents;
    if (visitedToday !== undefined) callData.visitedToday = visitedToday;
    if (notes !== undefined) callData.notes = notes;

    callData.updatedAt = new Date();
    callData.updatedBy = req.employee.id;

    await callData.save();

    res.json({
      success: true,
      message: "Call data updated successfully",
      callData,
    });
  } catch (error) {
    console.error("Update call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating call data",
    });
  }
});

// @route   DELETE /api/calls/:id
// @desc    Delete call data (Admin only or own data before checkout)
// @access  Private
router.delete("/:id", auth, async (req, res) => {
  try {
    const callData = await CallData.findById(req.params.id);
    if (!callData) {
      return res.status(404).json({
        success: false,
        message: "Call data not found",
      });
    }

    // Check if user can delete this data
    if (
      callData.employee.toString() !== req.employee.id &&
      req.employee.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // For employees, check if they've checked out (for today's data)
    if (req.employee.role !== "admin") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recordDate = new Date(callData.date);
      recordDate.setHours(0, 0, 0, 0);

      const isToday = recordDate.getTime() === today.getTime();

      if (isToday) {
        const attendance = await Attendance.findOne({
          employee: req.employee.id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (attendance && attendance.clockOut) {
          return res.status(400).json({
            success: false,
            message: "Cannot delete call data after checking out",
          });
        }
      }
    }

    await callData.deleteOne();

    res.json({
      success: true,
      message: "Call data deleted successfully",
    });
  } catch (error) {
    console.error("Delete call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting call data",
    });
  }
});

// @route   GET /api/calls/export/excel
// @desc    Export call data to Excel (Admin only)
// @access  Private (Admin)
router.get("/export/excel", auth, adminAuth, async (req, res) => {
  try {
    const {
      employee,
      month,
      year,
      department,
    } = req.query;

    let query = {};

    // Filter by employee if provided
    if (employee) {
      query.employee = employee;
    }

    // Filter by date if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    let callQuery = CallData.find(query).populate(
      "employee",
      "name employeeId department"
    );

    // Filter by department if provided
    if (department && department !== "all") {
      callQuery = callQuery.populate({
        path: "employee",
        match: { department: department },
        select: "name employeeId department",
      });
    }

    const callDataRecords = await callQuery.sort({ date: -1 });

    // Filter out null employees (when department filter doesn't match)
    const filteredRecords = callDataRecords.filter((record) => record.employee);

    if (filteredRecords.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No call data found for the given criteria",
      });
    }

    // Create Excel workbook
    const xl = require("excel4node");
    const wb = new xl.Workbook();
    const ws = wb.addWorksheet("Caller Data");

    // Define styles
    const headerStyle = wb.createStyle({
      font: {
        bold: true,
        color: "FFFFFF",
        size: 12,
      },
      fill: {
        type: "pattern",
        patternType: "solid",
        fgColor: "1F4E78",
      },
      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      },
      border: {
        left: { style: "thin" },
        right: { style: "thin" },
        top: { style: "thin" },
        bottom: { style: "thin" },
      },
    });

    const dataStyle = wb.createStyle({
      alignment: {
        horizontal: "center",
        vertical: "center",
      },
      border: {
        left: { style: "thin" },
        right: { style: "thin" },
        top: { style: "thin" },
        bottom: { style: "thin" },
      },
    });

    const dataStyleLeft = wb.createStyle({
      alignment: {
        horizontal: "left",
        vertical: "center",
      },
      border: {
        left: { style: "thin" },
        right: { style: "thin" },
        top: { style: "thin" },
        bottom: { style: "thin" },
      },
    });

    // Add headers
    const headers = [
      "Date",
      "Employee Name",
      "Employee ID",
      "Department",
      "Visited Students",
      "Interested Students",
      "Call Time (mins)",
      "Total Calls",
      "Performance Score",
      "Notes",
    ];

    headers.forEach((header, index) => {
      ws.cell(1, index + 1).string(header).style(headerStyle);
    });

    // Set column widths
    ws.column(1).setWidth(12);
    ws.column(2).setWidth(18);
    ws.column(3).setWidth(12);
    ws.column(4).setWidth(15);
    ws.column(5).setWidth(16);
    ws.column(6).setWidth(18);
    ws.column(7).setWidth(16);
    ws.column(8).setWidth(12);
    ws.column(9).setWidth(18);
    ws.column(10).setWidth(25);

    // Add data rows
    filteredRecords.forEach((record, rowIndex) => {
      const row = rowIndex + 2;
      ws.cell(row, 1)
        .date(new Date(record.date))
        .style(dataStyle);
      ws.cell(row, 2).string(record.employee?.name || "N/A").style(dataStyleLeft);
      ws.cell(row, 3).string(record.employee?.employeeId || "N/A").style(dataStyle);
      ws.cell(row, 4).string(record.employee?.department || "N/A").style(dataStyleLeft);
      ws.cell(row, 5).number(record.visitedToday).style(dataStyle);
      ws.cell(row, 6).number(record.interestedStudents).style(dataStyle);
      ws.cell(row, 7).number(record.totalCallTime).style(dataStyle);
      ws.cell(row, 8).number(record.totalCalls).style(dataStyle);
      ws.cell(row, 9).number(parseFloat(record.performanceScore.toFixed(1))).style(dataStyle);
      ws.cell(row, 10).string(record.notes || "").style(dataStyleLeft);
    });

    // Generate file name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const fileName = `caller_data_${timestamp}.xlsx`;

    // Send file
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    wb.write(fileName, res);
  } catch (error) {
    console.error("Export call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while exporting call data",
    });
  }
});

// @route   GET /api/calls/:id
// @desc    Get single call data record
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const callData = await CallData.findById(req.params.id)
      .populate("employee", "name employeeId department")
      .populate("updatedBy", "name");

    if (!callData) {
      return res.status(404).json({
        success: false,
        message: "Call data not found",
      });
    }

    // Check if user can access this data
    if (
      callData.employee._id.toString() !== req.employee.id &&
      req.employee.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      callData,
    });
  } catch (error) {
    console.error("Get call data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching call data",
    });
  }
});

module.exports = router;
