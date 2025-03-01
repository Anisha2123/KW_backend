

const express = require('express');
const fs = require('fs');
const path =require('path');
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const User = require("../models/User"); // Import User model
// import axios from 'axios';
const multer = require("multer");


const router = express.Router();

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
// const UPLOADS_DIR = path.join(__dirname, '../uploads'); 
// const UPLOADS_DIR = path.resolve('uploads');


// Function to get PDFs based on filters
const getFilteredPdfs = (branch, semester, category, subject) => {
    

    let basePath = path.join(UPLOADS_DIR, branch, `semester_${semester}`, category);

    if (subject) basePath = path.join(basePath, subject); // Add subject filter
      
    console.log(`Checking directory: ${basePath}`); // ✅ Debug log

    if (!fs.existsSync(basePath)) return [];

    const pdfFiles = fs.readdirSync(basePath)
    .filter(file => file.toLowerCase().endsWith('.pdf'));
        
        console.log(`✅ Found ${pdfFiles.length} PDFs in: ${basePath}`); // ✅ Debug log

        return pdfFiles.map(file => ({
            name: file,
            url: `/uploads/${branch}/semester_${semester}/${category}/${subject}/${file}`
        }));
        // return pdfFiles.map(file => ({
        //     name: file,
        //     url: `https://kiitwallah.live/api/resources/uploads/${branch}/semester_${semester}/${category}/${subject}/${file}`
        // }));
        
        
};

// API to fetch PDFs
router.get('/pdfs', (req, res) => {
    const { branch, semester, category, subject } = req.query;
  
    console.log(`📌 API Request - Branch: ${branch}, Semester: ${semester}, Category: ${category}, Subject: ${subject}`);

    if (!branch || !semester || !category || !subject) {
        return res.status(400).json({ error: "All filters are required (branch, semester, category, subject)" });
    }

    const pdfs = getFilteredPdfs(branch, semester, category, subject);
    console.log(`📄 Sending ${pdfs.length} PDFs to client`);
    res.json({ pdfs });
});


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      console.log("📩 Incoming File:", file);
      const { branch, semester, category, subject } = req.body;
  
  
      console.log("📩 Request Body:", req.body);
      console.log("📂 Uploaded File:", req.files);
     
       // ✅ Ensure all fields exist, otherwise return an error
       if (!branch || !semester || !category || !subject) {
        return cb(new Error("Missing required fields in request body"), null);
      }
  
      const uploadPath = path.join(__dirname, "../uploads", branch, `semester_${semester}`, category, subject);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });

  const upload = multer({ storage });

router.post("/upload", upload.single("pdf"), async (req, res) => {
  try {
    console.log("File received:", req.file); // Debugging log
    console.log("📂 Request Body:", req.body);
  console.log("📂 Uploaded File:", req.file);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
      if (!req.file || !req.body.branch || !req.body.semester || !req.body.category || !req.body.subject) {
    return res.status(400).json({ error: "Missing required fields" });
  }
    res.status(200).json({ message: "File uploaded successfully", file: req.file.filename });
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports=router;



