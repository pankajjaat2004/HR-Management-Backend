const express = require("express");
const mongoose = require("mongoose");
const excel = require("excel4node");
const Employee = require("../models/Employee");
const auth = require("../middleware/auth");
const { adminAuth } = require("../middleware/auth");

const router = express.Router();

// Mock data for fallback when database issues occur
const mockEmployees = [
  {
    _id: "emp001",
    name: "John Doe",
    email: "john@company.com",
    employeeId: "EMP002",
    department: "Engineering",
    position: "Software Developer",
    role: "employee",
    status: "Active",
    salary: 75000,
    phone: "555-0123",
    createdAt: new Date("2023-01-15"),
  },
  {
    _id: "emp002",
    name: "Jane Smith",
    email: "jane@company.com",
    employeeId: "EMP003",
    department: "Engineering",
    position: "UI/UX Designer",
    role: "employee",
    status: "Active",
    salary: 70000,
    phone: "555-0124",
    createdAt: new Date("2023-02-01"),
  },
  {
    _id: "admin001",
    name: "Admin User",
    email: "admin@company.com",
    employeeId: "EMP001",
    department: "Administration",
    position: "System Administrator",
    role: "admin",
    status: "Active",
    salary: 90000,
    phone: "555-0100",
    createdAt: new Date("2023-01-01"),
  },
];

// @route   GET /api/employees/departments/stats
// @desc    Get department statistics (Admin only)
// @access  Private (Admin)
router.get("/departments/stats", auth, adminAuth, async (req, res) => {
  try {
    let stats = [];

    // Check if database is connected and try to get real data
    if (mongoose.connection.readyState === 1) {
      try {
        stats = await Employee.aggregate([
          {
            $match: { status: "Active" },
          },
          {
            $group: {
              _id: "$department",
              count: { $sum: 1 },
              avgSalary: { $avg: "$salary" },
              totalSalary: { $sum: "$salary" },
            },
          },
          {
            $sort: { count: -1 },
          },
        ]);
      } catch (dbError) {
        // If database query fails, use mock data
        console.log("🔧 Database query failed, using mock department stats");
        stats = generateMockDepartmentStats();
      }
    } else {
      // Database not connected - use mock data
      console.log("🔧 Using mock department stats (DB not connected)");
      stats = generateMockDepartmentStats();
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Department stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching department statistics",
    });
  }
});

// Helper function to generate mock department stats
function generateMockDepartmentStats() {
  const departmentCounts = {};
  mockEmployees.forEach((emp) => {
    if (emp.status === "Active") {
      if (!departmentCounts[emp.department]) {
        departmentCounts[emp.department] = {
          count: 0,
          totalSalary: 0,
        };
      }
      departmentCounts[emp.department].count++;
      departmentCounts[emp.department].totalSalary += emp.salary;
    }
  });

  return Object.entries(departmentCounts)
    .map(([department, data]) => ({
      _id: department,
      count: data.count,
      avgSalary: Math.round(data.totalSalary / data.count),
      totalSalary: data.totalSalary,
    }))
    .sort((a, b) => b.count - a.count);
}

// @route   GET /api/employees/search
// @desc    Search employees (Admin only)
// @access  Private (Admin)
router.get("/search", auth, adminAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters long",
      });
    }

    const employees = await Employee.find({
      $and: [
        { status: "Active" },
        {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { employeeId: { $regex: q, $options: "i" } },
            { department: { $regex: q, $options: "i" } },
            { position: { $regex: q, $options: "i" } },
          ],
        },
      ],
    })
      .select("name email employeeId department position")
      .limit(10);

    res.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error("Search employees error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while searching employees",
    });
  }
});

// @route   GET /api/employees
// @desc    Get all employees (Admin only)
// @access  Private (Admin)
router.get("/", auth, adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, department, search } = req.query;
    let employees = [];
    let total = 0;

    // Check if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        let query = {};

        if (department && department !== "all") {
          query.department = department;
        }

        if (search) {
          query.$or = [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { employeeId: { $regex: search, $options: "i" } },
          ];
        }

        employees = await Employee.find(query)
          .select("-password")
          .limit(limit * 1)
          .skip((page - 1) * limit)
          .sort({ createdAt: -1 });

        total = await Employee.countDocuments(query);
      } catch (dbError) {
        // If database query fails, use mock data
        console.log("🔧 Database query failed, using mock employees data");
        ({ employees, total } = getMockEmployees(
          page,
          limit,
          department,
          search,
        ));
      }
    } else {
      // Database not connected - use mock data
      console.log("🔧 Using mock employees data (DB not connected)");
      ({ employees, total } = getMockEmployees(
        page,
        limit,
        department,
        search,
      ));
    }

    res.json({
      success: true,
      employees,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    console.error("Get employees error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching employees",
    });
  }
});

// Helper function to get mock employees with filters
function getMockEmployees(page, limit, department, search) {
  let filteredEmployees = [...mockEmployees];

  // Apply department filter
  if (department && department !== "all") {
    filteredEmployees = filteredEmployees.filter(
      (emp) => emp.department.toLowerCase() === department.toLowerCase(),
    );
  }

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredEmployees = filteredEmployees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        emp.employeeId.toLowerCase().includes(searchLower),
    );
  }

  const total = filteredEmployees.length;

  // Apply pagination
  const startIndex = (page - 1) * limit;
  const employees = filteredEmployees.slice(
    startIndex,
    startIndex + parseInt(limit),
  );

  return { employees, total };
}

// @route   GET /api/employees/me
// @desc    Get current employee profile
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    console.log("🔍 /api/employees/me called");
    console.log("🔍 req.employee:", req.employee);

    // Validate req.employee structure
    if (!req.employee) {
      console.log("❌ req.employee is null/undefined");
      return res.status(401).json({
        success: false,
        message: "Authentication data missing",
      });
    }

    if (!req.employee.id) {
      console.log("❌ req.employee.id is missing");
      return res.status(401).json({
        success: false,
        message: "Employee ID missing from authentication token",
      });
    }

    let employee;

    // Check if database is connected and try to get real data
    if (mongoose.connection.readyState === 1) {
      try {
        console.log("🔍 Querying database for employee ID:", req.employee.id);
        employee = await Employee.findById(req.employee.id).select("-password");
        console.log(
          "🔍 Database query result:",
          employee ? "FOUND" : "NOT FOUND",
        );
      } catch (dbError) {
        console.log("🔧 Database query failed:", dbError.message);
        employee = null;
      }
    } else {
      console.log("🔧 Database not connected, using fallback");
    }

    // If no employee found in database or database not connected, use fallback
    if (!employee) {
      const mockEmployee = mockEmployees.find(
        (emp) =>
          emp.email === req.employee.email || emp._id === req.employee.id,
      );

      if (mockEmployee) {
        employee = mockEmployee;
      } else {
        // Return basic info from token if no mock data matches
        employee = {
          _id: req.employee.id,
          name: req.employee.name || "Employee",
          email: req.employee.email,
          employeeId: req.employee.employeeId || "EMP001",
          department: "Engineering",
          position: "Developer",
          role: req.employee.role || "employee",
          status: "Active",
          phone: "+1 (555) 123-4567",
          address: "123 Main St, City, State",
          manager: "Manager",
          startDate: new Date().toISOString(),
        };
      }
    }

    res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get my profile error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
});

// @route   GET /api/employees/export
// @desc    Export employees to Excel (Admin only)
// @access  Private (Admin)
router.get("/export", auth, adminAuth, async (req, res) => {
  try {
    let employees = [];

        // Check if database is connected and try to get real data
    if (mongoose.connection.readyState === 1) {
      try {
        employees = await Employee.find({
          status: { $ne: "Terminated" },
          role: { $ne: "admin" }
        })
          .select("-password")
          .sort({ createdAt: -1 });
      } catch (dbError) {
        console.log("🔧 Database query failed, using mock employees data for export");
        employees = mockEmployees.filter(emp => emp.status !== "Terminated" && emp.role !== "admin");
      }
    } else {
      console.log("🔧 Using mock employees data for export (DB not connected)");
      employees = mockEmployees.filter(emp => emp.status !== "Terminated" && emp.role !== "admin");
    }

    // Create a new workbook
    const workbook = new excel.Workbook();

    // Add worksheet
    const worksheet = workbook.addWorksheet('Employees');

    // Define styles
    const headerStyle = workbook.createStyle({
      font: {
        color: '#FFFFFF',
        size: 12,
        bold: true
      },
      fill: {
        type: 'pattern',
        patternType: 'solid',
        fgColor: '#3B82F6'
      },
      border: {
        left: { style: 'thin', color: '#000000' },
        right: { style: 'thin', color: '#000000' },
        top: { style: 'thin', color: '#000000' },
        bottom: { style: 'thin', color: '#000000' }
      }
    });

    const cellStyle = workbook.createStyle({
      border: {
        left: { style: 'thin', color: '#CCCCCC' },
        right: { style: 'thin', color: '#CCCCCC' },
        top: { style: 'thin', color: '#CCCCCC' },
        bottom: { style: 'thin', color: '#CCCCCC' }
      }
    });

    // Define headers
    const headers = [
      'Employee ID',
      'Name',
      'Email',
      'Department',
      'Position',
      'Salary',
      'Phone',
      'Status',
      'Role',
      'Start Date'
    ];

    // Write headers
    headers.forEach((header, index) => {
      worksheet.cell(1, index + 1)
        .string(header)
        .style(headerStyle);
    });

    // Auto-size columns
    worksheet.column(1).setWidth(15); // Employee ID
    worksheet.column(2).setWidth(25); // Name
    worksheet.column(3).setWidth(30); // Email
    worksheet.column(4).setWidth(20); // Department
    worksheet.column(5).setWidth(25); // Position
    worksheet.column(6).setWidth(15); // Salary
    worksheet.column(7).setWidth(18); // Phone
    worksheet.column(8).setWidth(12); // Status
    worksheet.column(9).setWidth(12); // Role
    worksheet.column(10).setWidth(15); // Start Date

    // Write employee data
    employees.forEach((employee, index) => {
      const row = index + 2; // Start from row 2 (after headers)

      worksheet.cell(row, 1).string(employee.employeeId || 'N/A').style(cellStyle);
      worksheet.cell(row, 2).string(employee.name || 'N/A').style(cellStyle);
      worksheet.cell(row, 3).string(employee.email || 'N/A').style(cellStyle);
      worksheet.cell(row, 4).string(employee.department || 'N/A').style(cellStyle);
      worksheet.cell(row, 5).string(employee.position || 'N/A').style(cellStyle);
      worksheet.cell(row, 6).number(employee.salary || 0).style(cellStyle);
      worksheet.cell(row, 7).string(employee.phone || 'N/A').style(cellStyle);
      worksheet.cell(row, 8).string(employee.status || 'Active').style(cellStyle);
      worksheet.cell(row, 9).string(employee.role || 'employee').style(cellStyle);

      const startDate = employee.createdAt || employee.startDate || new Date();
      worksheet.cell(row, 10).string(
        new Date(startDate).toLocaleDateString()
      ).style(cellStyle);
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `employees_${timestamp}.xlsx`;

        // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    // Write to buffer and then send to response
    workbook.writeToBuffer().then((buffer) => {
      res.send(buffer);
    });

  } catch (error) {
    console.error("Export employees error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while exporting employees",
    });
  }
});

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private
router.get("/:id", auth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id).select("-password");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if user can access this employee data
    if (req.employee.role !== "admin" && req.employee.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get employee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching employee",
    });
  }
});

// @route   POST /api/employees
// @desc    Create new employee (Admin only)
// @access  Private (Admin)
router.post("/", auth, adminAuth, async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      position,
      salary,
      manager,
      phone,
      address,
      emergencyContact,
      role = "employee",
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !department || !position || !salary) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      });
    }

    // Check if email already exists
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
      manager,
      phone,
      address,
      emergencyContact,
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
    console.error("Create employee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating employee",
    });
  }
});

// @route   PUT /api/employees/:id
// @desc    Update employee (Admin only)
// @access  Private (Admin)
router.put("/:id", auth, adminAuth, async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      position,
      salary,
      manager,
      phone,
      address,
      emergencyContact,
      status,
      role,
    } = req.body;

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Check if email is being changed and if it already exists
    if (email && email !== employee.email) {
      const existingEmployee = await Employee.findOne({ email });
      if (existingEmployee) {
        return res.status(400).json({
          success: false,
          message: "Employee with this email already exists",
        });
      }
      employee.email = email;
    }

    // Update fields
    if (name) employee.name = name;
    if (department) employee.department = department;
    if (position) employee.position = position;
    if (salary) employee.salary = salary;
    if (manager) employee.manager = manager;
    if (phone) employee.phone = phone;
    if (address) employee.address = address;
    if (emergencyContact) employee.emergencyContact = emergencyContact;
    if (status) employee.status = status;
    if (role) employee.role = role;

    await employee.save();

    res.json({
      success: true,
      message: "Employee updated successfully",
      employee,
    });
  } catch (error) {
    console.error("Update employee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating employee",
    });
  }
});

// @route   DELETE /api/employees/:id
// @desc    Delete employee (Admin only)
// @access  Private (Admin)
router.delete("/:id", auth, adminAuth, async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // Instead of hard delete, update status to 'Terminated'
    employee.status = "Terminated";
    await employee.save();

    res.json({
      success: true,
      message: "Employee deleted successfully",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting employee",
    });
  }
});

// @route   PUT /api/employees/:id/salary
// @desc    Update employee salary (Admin only)
// @access  Private (Admin)
router.put("/:id/salary", auth, adminAuth, async (req, res) => {
  try {
    const { salary, effectiveDate = new Date() } = req.body;

    if (!salary || salary <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid salary amount",
      });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const oldSalary = employee.salary;
    employee.salary = salary;
    await employee.save();

    res.json({
      success: true,
      message: "Salary updated successfully",
      changes: {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        oldSalary,
        newSalary: salary,
        effectiveDate,
        updatedBy: req.employee.id,
      },
    });
  } catch (error) {
    console.error("Update salary error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while updating salary",
    });
  }
});

// @route   GET /api/employees/auth-test
// @desc    Test authentication
// @access  Private
router.get("/auth-test", auth, (req, res) => {
  try {
    console.log("🧪 Auth test route called");
    console.log("🧪 req.employee:", req.employee);

    res.json({
      success: true,
      message: "Authentication working",
      employee: req.employee,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("🧪 Auth test error:", error);
    res.status(500).json({
      success: false,
      message: "Auth test failed",
      error: error.message,
    });
  }
});

module.exports = router;
