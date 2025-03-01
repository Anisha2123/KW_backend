// const express = require('express');
// const cors = require('cors');
// const https = require('https');
// const mongoose = require('mongoose');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// require('dotenv').config();
// const env = require('./environments/environments');

// const app = express();
// const PORT = 5000;

// // Middleware
// app.use(cors());
// app.use(express.json());

// // Serve static files (PDFs)
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// // API Routes
// app.use('/api/resources', resourceRoutes);
// // app.use("/api/auth", authRoutes);
// // Root Endpoint



// // Start Server
// app.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });
const express = require('express');
const cors = require('cors');
const https = require('https');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const env = require('./environments/environments');

const User = require('./models/User');
const Admin = require('./models/Admin');
const Alumni = require('./models/Alumni');
const resourceRoutes = require('./routes/resources');
const app = express();


// Enable CORS for your frontend domain
// app.use(cors({
//   origin: '*',
//   credentials: false,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// Enable CORS for all origins (Change '*' to your frontend URL in production)
app.use(cors({
  origin: '*',  // Allow all domains (Change this in production)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests for CORS
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // But not for file uploads

// // Set up storage for uploaded files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // Directory to save uploaded files
//   },
//   filename: (req, file, cb) => {
//     cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to the filename
//   }
// });

// // Initialize multer
// const upload = multer({ storage: storage });

// // File Upload Route
// app.post("/b2/uploads/:branch/:semester/:category/:subject", upload.single("file"), (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: "No file uploaded!" });
//   }
//   res.json({ message: "File uploaded successfully!", filename: req.file.filename });
// });

// Test API endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'success',
    message: 'API is working!',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 


// Ensure "uploads" directory exists
const fs = require('fs');
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Connect to MongoDB
mongoose.connect(env.mongoUri)
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

  // Serve static files (PDFs)
// app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
// app.use('/api/resources/uploads', express.static(path.join(process.cwd(), 'uploads')));

// will work well on hosted site as we have front and backend at diff places 
app.use('/api/resources/uploads', express.static(path.join(__dirname, 'uploads')));

  // Routes
app.use('/api/resources', resourceRoutes);

// working on localhost
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Blacklist for storing invalidated tokens
const tokenBlacklist = new Set(); 

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ message: 'Token has been invalidated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Email verification endpoint
app.post(`${env.apiPaths.base}/auth/verify-email`, (req, res) => {
  const { user_json_url } = req.body;

  if (!user_json_url) {
    return res.status(400).json({ error: "Missing user_json_url" });
  }

  https.get(user_json_url, (response) => {
    let data = "";

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      try {
        const jsonData = JSON.parse(data);
        const user_email_id = jsonData.user_email_id;

        console.log("✅ Verified Email:", user_email_id);
        res.json({ email: user_email_id });
      } catch (error) {
        console.error("❌ JSON Parse Error:", error);
        res.status(500).json({ error: "Invalid response from email verification service" });
      }
    });
  }).on("error", (err) => {
    console.error("❌ HTTP Request Error:", err.message);
    res.status(500).json({ error: "Failed to fetch email" });
  });
});

// Log incoming requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path}`);
  next();
});

// Signup endpoint
app.post(`${env.apiPaths.base}/auth/signup`, async (req, res) => {
  try {
    const { name, email, password, rollNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { rollNumber }] 
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email ? 
          'Email already registered' : 
          'Roll number already registered' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      rollNumber,
      password: hashedPassword,
      isVerified: true // Since email is already verified
    });

    await user.save();

    res.status(201).json({ 
      message: 'Account created successfully',
      user: {
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login endpoint
app.post(`${env.apiPaths.base}/auth/login`, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        email: user.email,
        name: user.name,
        rollNumber: user.rollNumber
      },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNumber: user.rollNumber
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Example of a protected route
app.get(`${env.apiPaths.base}/user/profile`, verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout endpoint
app.post(`${env.apiPaths.base}/auth/logout`, verifyToken, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    tokenBlacklist.add(token);
  }
  res.json({ message: 'Logged out successfully' });
});

// Admin routes
app.post(`${env.apiPaths.base}/auth/admin/signup`, async (req, res) => {
  try {
    console.log('📝 Admin signup attempt:', req.body.email);
    const { email, password } = req.body;
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new admin
    const admin = new Admin({
      email,
      password: hashedPassword,
      createdAt: new Date()
    });

    await admin.save();
    res.status(201).json({ message: 'Admin created successfully' });
  } catch (error) {
    console.error('Admin signup error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Login
app.post(`${env.apiPaths.base}/auth/admin/login`, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin._id,
        email: admin.email,
        role: 'admin'
      },
      env.jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: admin._id,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify Admin Token with proper authentication
app.get(`${env.apiPaths.base}/auth/admin/verify`, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, env.jwtSecret);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }

    res.json({ 
      message: 'Admin verified',
      admin: {
        id: admin._id,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(401).json({ message: 'Invalid token' });
  }
});

// Alumni routes
app.get(`${env.apiPaths.base}/admin/alumni`, verifyAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const [alumni, total] = await Promise.all([
      Alumni.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Alumni.countDocuments()
    ]);

    res.json({
      alumni,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching alumni:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post(`${env.apiPaths.base}/admin/alumni`, verifyAdmin, async (req, res) => {
  try {
    const alumni = new Alumni(req.body);
    await alumni.save();
    res.status(201).json(alumni);
  } catch (error) {
    console.error('Error creating alumni:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Public Alumni routes
app.get(`${env.apiPaths.base}/alumni`, async (req, res) => {
  try {
    const alumni = await Alumni.find({ isActive: true }).sort({ rating: -1 });
    res.json(alumni);
  } catch (error) {
    console.error('Error fetching alumni:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update alumni
app.put(`${env.apiPaths.base}/admin/alumni/:id`, verifyAdmin, async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    if (!alumni) {
      return res.status(404).json({ message: 'Alumni not found' });
    }
    res.json(alumni);
  } catch (error) {
    console.error('Error updating alumni:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete alumni
app.delete(`${env.apiPaths.base}/admin/alumni/:id`, verifyAdmin, async (req, res) => {
  try {
    const alumni = await Alumni.findByIdAndDelete(req.params.id);
    if (!alumni) {
      return res.status(404).json({ message: 'Alumni not found' });
    }
    res.json({ message: 'Alumni deleted successfully' });
  } catch (error) {
    console.error('Error deleting alumni:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// // Upload PDF endpoint
// app.post(`${env.apiPaths.base}/upload/pdf`, upload.single('pdf'), (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ message: 'No file uploaded' });
//   }

//   // You can also save the file information to the database here if needed
//   const pdfData = {
//     filename: req.file.filename,
//     path: req.file.path,
//     originalName: req.file.originalname,
//     branch: req.body.branch, // Assuming branch is sent in the request body
//     category: req.body.category // Assuming category is sent in the request body
//   };

  // Here you can save pdfData to your database if needed
  // For example: await PDFModel.create(pdfData);

//   res.status(200).json({
//     message: 'PDF uploaded successfully',
//     data: pdfData
//   });
// });

const PORT = env.port;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
// app.listen(PORT, '0.0.0.0', () => {
//    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
//   });

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ message: 'Internal server error' });
}); 