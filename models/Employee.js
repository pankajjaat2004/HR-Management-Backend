const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    employeeId: {
      type: String,
      unique: true,
      
    },
    department: {
      type: String,
      required: [true, "Department is required"],
      enum: [
        "Engineering",
        "Marketing",
        "Sales",
        "HR",
        "Finance",
        "Operations",
        "Administration",  // Add 'Administration' here
      ],
    },
    position: {
      type: String,
      required: [true, "Position is required"],
    },
    salary: {
      type: Number,
      required: [true, "Salary is required"],
      min: [0, "Salary cannot be negative"],
    },
    
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Terminated"],
      default: "Active",
    },
    role: {
      type: String,
      enum: ["admin", "employee","manager"],
      default: "employee",
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    leaveBalance: {
      vacation: {
        type: Number,
        default: 20,
      },
      sick: {
        type: Number,
        default: 10,
      },
      personal: {
        type: Number,
        default: 5,
      },
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Generate employee ID before saving
employeeSchema.pre("save", async function (next) {
  if (!this.employeeId) {
    const count = await this.constructor.countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Compare password method
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
employeeSchema.methods.toJSON = function () {
  const employeeObject = this.toObject();
  delete employeeObject.password;
  return employeeObject;
};

module.exports = mongoose.model("Employee", employeeSchema);
