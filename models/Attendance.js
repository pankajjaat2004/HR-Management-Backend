const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      },
    },
    clockIn: {
      type: Date,
    },
    clockOut: {
      type: Date,
    },
    breakStart: {
      type: Date,
    },
    breakEnd: {
      type: Date,
    },
    totalHours: {
      type: Number,
      default: 0,
    },
    overtimeHours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Present", "Absent", "Late", "Half Day", "Holiday"],
      default: "Absent",
    },
    notes: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      enum: ["Office", "Remote", "Field"],
      default: "Office",
    },
    isManualEntry: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  {
    timestamps: true,
  },
);

// Calculate total hours when clock out is recorded
attendanceSchema.pre("save", function (next) {
  if (this.clockIn && this.clockOut) {
    const clockInTime = new Date(this.clockIn);
    const clockOutTime = new Date(this.clockOut);

    // Calculate total milliseconds worked
    let totalMs = clockOutTime - clockInTime;

    // Subtract break time if recorded
    if (this.breakStart && this.breakEnd) {
      const breakMs = new Date(this.breakEnd) - new Date(this.breakStart);
      totalMs -= breakMs;
    }

    // Convert to hours
    this.totalHours = Math.max(0, totalMs / (1000 * 60 * 60));

    // Calculate overtime (assuming 8 hours is standard)
    this.overtimeHours = Math.max(0, this.totalHours - 8);

    // Update status based on hours worked
    if (this.totalHours >= 8) {
      this.status = "Present";
    } else if (this.totalHours >= 4) {
      this.status = "Half Day";
    } else if (this.totalHours > 0) {
      this.status = "Late";
    }
  }

  next();
});

// Compound index to ensure one record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Static method to get attendance for a date range
attendanceSchema.statics.getAttendanceByDateRange = function (
  employeeId,
  startDate,
  endDate,
) {
  return this.find({
    employee: employeeId,
    date: {
      $gte: startDate,
      $lte: endDate,
    },
  })
    .populate("employee", "name employeeId department")
    .sort({ date: -1 });
};

// Static method to get monthly summary
attendanceSchema.statics.getMonthlySummary = function (
  employeeId,
  year,
  month,
) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  return this.aggregate([
    {
      $match: {
        employee: mongoose.Types.ObjectId(employeeId),
        date: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: 1 },
        presentDays: {
          $sum: {
            $cond: [{ $eq: ["$status", "Present"] }, 1, 0],
          },
        },
        totalHours: { $sum: "$totalHours" },
        overtimeHours: { $sum: "$overtimeHours" },
        avgHoursPerDay: { $avg: "$totalHours" },
      },
    },
  ]);
};

module.exports = mongoose.model("Attendance", attendanceSchema);
