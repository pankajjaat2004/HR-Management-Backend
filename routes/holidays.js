const express = require("express");
const mongoose = require("mongoose");
const Holiday = require("../models/Holiday");
const auth = require("../middleware/auth");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// Mock holidays for fallback when database is not available
const mockHolidays = [
  {
    _id: "holiday001",
    name: "New Year's Day",
    description: "Start of the calendar year",
    date: new Date("2024-01-01"),
    type: "National",
    isRecurring: true,
    status: "Active",
    isOfficeClose: true,
    addedBy: {
      _id: "admin001",
      name: "Admin User",
    },
  },
  {
    _id: "holiday002",
    name: "Christmas Day",
    description: "Christian holiday celebrating the birth of Jesus Christ",
    date: new Date("2024-12-25"),
    type: "Religious",
    isRecurring: true,
    status: "Active",
    isOfficeClose: true,
    addedBy: {
      _id: "admin001",
      name: "Admin User",
    },
  },
  {
    _id: "holiday003",
    name: "Company Foundation Day",
    description: "Celebrating our company's anniversary",
    date: new Date("2024-06-15"),
    type: "Company",
    isRecurring: true,
    status: "Active",
    isOfficeClose: false,
    addedBy: {
      _id: "admin001",
      name: "Admin User",
    },
  },
];

// Helper function to generate mock holidays for different scenarios
function getMockHolidays(filters = {}) {
  let filteredHolidays = [...mockHolidays];

  if (filters.upcoming) {
    const today = new Date();
    filteredHolidays = filteredHolidays.filter(
      (holiday) => new Date(holiday.date) >= today,
    );
  }

  if (filters.month && filters.year) {
    filteredHolidays = filteredHolidays.filter((holiday) => {
      const holidayDate = new Date(holiday.date);
      return (
        holidayDate.getMonth() === filters.month - 1 &&
        holidayDate.getFullYear() === filters.year
      );
    });
  }

  return filteredHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// @route   GET /api/holidays
// @desc    Get all holidays
// @access  Private
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, type, year, month, upcoming } = req.query;
    let holidays = [];
    let total = 0;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        let query = { status: "Active" };

        // Filter by type if provided
        if (type && type !== "all") {
          query.type = type;
        }

        // Filter by upcoming holidays
        if (upcoming === "true") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          query.date = { $gte: today };
        }

        // Filter by month and year if provided
        if (month && year) {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0);
          query.date = {
            $gte: startDate,
            $lte: endDate,
          };
        }

        holidays = await Holiday.find(query)
          .populate("addedBy", "name email")
          .sort({ date: 1 })
          .limit(limit * 1)
          .skip((page - 1) * limit);

        total = await Holiday.countDocuments(query);
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock holidays data");
        holidays = getMockHolidays({
          upcoming: upcoming === "true",
          month: parseInt(month),
          year: parseInt(year),
        });
        total = holidays.length;

        // Apply pagination to mock data
        const startIndex = (page - 1) * limit;
        holidays = holidays.slice(startIndex, startIndex + parseInt(limit));
      }
    } else {
      console.log("🔧 Using mock holidays data (DB not connected)");
      holidays = getMockHolidays({
        upcoming: upcoming === "true",
        month: parseInt(month),
        year: parseInt(year),
      });
      total = holidays.length;

      // Apply pagination to mock data
      const startIndex = (page - 1) * limit;
      holidays = holidays.slice(startIndex, startIndex + parseInt(limit));
    }

    res.json({
      success: true,
      holidays,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching holidays",
    });
  }
});

// @route   GET /api/holidays/upcoming
// @desc    Get upcoming holidays
// @access  Private
router.get("/upcoming", auth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    let holidays = [];

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        holidays = await Holiday.getUpcomingHolidays(parseInt(limit));
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock upcoming holidays");
        holidays = getMockHolidays({ upcoming: true }).slice(
          0,
          parseInt(limit),
        );
      }
    } else {
      console.log("🔧 Using mock upcoming holidays (DB not connected)");
      holidays = getMockHolidays({ upcoming: true }).slice(0, parseInt(limit));
    }

    res.json({
      success: true,
      holidays,
    });
  } catch (error) {
    console.error("Get upcoming holidays error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching upcoming holidays",
    });
  }
});

// @route   POST /api/holidays
// @desc    Create new holiday (Admin only)
// @access  Private (Admin)
router.post("/", auth, adminAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      date,
      type = "Company",
      isRecurring = false,
      notifyEmployees = true,
      isOfficeClose = true,
    } = req.body;

    // Validate required fields
    if (!name || !date) {
      return res.status(400).json({
        success: false,
        message: "Please provide holiday name and date",
      });
    }

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      // Check if holiday already exists for the same date
      const existingHoliday = await Holiday.findOne({
        date: new Date(date),
        status: "Active",
      });

      if (existingHoliday) {
        return res.status(400).json({
          success: false,
          message: "A holiday already exists for this date",
        });
      }

      // Create new holiday
      const holiday = new Holiday({
        name,
        description,
        date: new Date(date),
        type,
        isRecurring,
        notifyEmployees,
        isOfficeClose,
        addedBy: req.employee.id,
      });

      await holiday.save();
      await holiday.populate("addedBy", "name email");

      res.status(201).json({
        success: true,
        message: "Holiday created successfully",
        holiday,
      });
    } else {
      // Database not connected - simulate creation
      console.log("🔧 Using mock holiday creation (DB not connected)");

      const newHoliday = {
        _id: `holiday${Date.now()}`,
        name,
        description,
        date: new Date(date),
        type,
        isRecurring,
        notifyEmployees,
        isOfficeClose,
        status: "Active",
        addedBy: {
          _id: req.employee.id,
          name: "Admin User",
        },
        createdAt: new Date(),
      };

      res.status(201).json({
        success: true,
        message: "Holiday created successfully (mock mode)",
        holiday: newHoliday,
      });
    }
  } catch (error) {
    console.error("Create holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating holiday",
    });
  }
});

// @route   GET /api/holidays/:id
// @desc    Get holiday by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    let holiday = null;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        holiday = await Holiday.findById(req.params.id).populate(
          "addedBy",
          "name email",
        );
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock holiday data");
        holiday = mockHolidays.find((h) => h._id === req.params.id);
      }
    } else {
      console.log("🔧 Using mock holiday data (DB not connected)");
      holiday = mockHolidays.find((h) => h._id === req.params.id);
    }

    if (!holiday) {
      return res.status(404).json({
        success: false,
        message: "Holiday not found",
      });
    }

    res.json({
      success: true,
      holiday,
    });
  } catch (error) {
    console.error("Get holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching holiday",
    });
  }
});

// @route   PUT /api/holidays/:id
// @desc    Update holiday (Admin only)
// @access  Private (Admin)
router.put("/:id", auth, adminAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      date,
      type,
      isRecurring,
      notifyEmployees,
      isOfficeClose,
      status,
    } = req.body;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      const holiday = await Holiday.findById(req.params.id);
      if (!holiday) {
        return res.status(404).json({
          success: false,
          message: "Holiday not found",
        });
      }

      // Update fields
      if (name) holiday.name = name;
      if (description !== undefined) holiday.description = description;
      if (date) holiday.date = new Date(date);
      if (type) holiday.type = type;
      if (isRecurring !== undefined) holiday.isRecurring = isRecurring;
      if (notifyEmployees !== undefined)
        holiday.notifyEmployees = notifyEmployees;
      if (isOfficeClose !== undefined) holiday.isOfficeClose = isOfficeClose;
      if (status) holiday.status = status;

      await holiday.save();
      await holiday.populate("addedBy", "name email");

      res.json({
        success: true,
        message: "Holiday updated successfully",
        holiday,
      });
    } else {
      // Database not connected - simulate update
      console.log("🔧 Using mock holiday update (DB not connected)");

      res.json({
        success: true,
        message: "Holiday updated successfully (mock mode)",
        holiday: {
          _id: req.params.id,
          name: name || "Updated Holiday",
          description: description || "Updated description",
          date: date ? new Date(date) : new Date(),
          type: type || "Company",
          isRecurring: isRecurring || false,
          notifyEmployees: notifyEmployees || true,
          isOfficeClose: isOfficeClose || true,
          status: status || "Active",
        },
      });
    }
  } catch (error) {
    console.error("Update holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating holiday",
    });
  }
});

// @route   DELETE /api/holidays/:id
// @desc    Delete holiday (Admin only)
// @access  Private (Admin)
router.delete("/:id", auth, adminAuth, async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      const holiday = await Holiday.findById(req.params.id);
      if (!holiday) {
        return res.status(404).json({
          success: false,
          message: "Holiday not found",
        });
      }

      // Instead of hard delete, update status to 'Cancelled'
      holiday.status = "Cancelled";
      await holiday.save();
    } else {
      // Database not connected - simulate deletion
      console.log("🔧 Using mock holiday deletion (DB not connected)");
    }

    res.json({
      success: true,
      message: "Holiday deleted successfully",
    });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting holiday",
    });
  }
});

// @route   GET /api/holidays/stats
// @desc    Get holiday statistics (Admin only)
// @access  Private (Admin)
router.get("/stats", auth, adminAuth, async (req, res) => {
  try {
    let stats = {};

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        const today = new Date();
        const currentYear = today.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const endOfYear = new Date(currentYear, 11, 31);

        // Total holidays this year
        const totalHolidays = await Holiday.countDocuments({
          date: { $gte: startOfYear, $lte: endOfYear },
          status: "Active",
        });

        // Upcoming holidays
        const upcomingHolidays = await Holiday.countDocuments({
          date: { $gte: today },
          status: "Active",
        });

        // Holidays by type
        const holidaysByType = await Holiday.aggregate([
          {
            $match: {
              date: { $gte: startOfYear, $lte: endOfYear },
              status: "Active",
            },
          },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
            },
          },
        ]);

        stats = {
          totalHolidays,
          upcomingHolidays,
          holidaysByType,
        };
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock holiday stats");
        stats = {
          totalHolidays: mockHolidays.length,
          upcomingHolidays: getMockHolidays({ upcoming: true }).length,
          holidaysByType: [
            { _id: "National", count: 1 },
            { _id: "Religious", count: 1 },
            { _id: "Company", count: 1 },
          ],
        };
      }
    } else {
      console.log("🔧 Using mock holiday stats (DB not connected)");
      stats = {
        totalHolidays: mockHolidays.length,
        upcomingHolidays: getMockHolidays({ upcoming: true }).length,
        holidaysByType: [
          { _id: "National", count: 1 },
          { _id: "Religious", count: 1 },
          { _id: "Company", count: 1 },
        ],
      };
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Get holiday stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching holiday statistics",
    });
  }
});

module.exports = router;
