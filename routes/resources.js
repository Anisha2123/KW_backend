

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

// Api to uplaod pdf on server
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("📩 Incoming File:", file);

    // Parse body after multer.fields() ensures it is available
    const { branch, semester, category, subject } = req.body;
    console.log("📩 Request Body:", req.body);

    if (!branch || !semester || !category || !subject) {
      return cb(new Error("Missing required fields in request body"), null);
    }

    const uploadPath = path.join(__dirname, "../uploads", branch, `semester_${semester}`, category, subject);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    console.log("📂 Provided pdfName:", req.body.pdfName);
    let pdfName = req.body.pdfName?.trim() || Date.now().toString();

    if (!pdfName.endsWith(".pdf")) {
      pdfName += ".pdf";
    }

    console.log("✅ Saving file as:", pdfName);
    cb(null, pdfName);
  }
});
  const upload = multer({ storage });

  router.post("/upload", upload.fields([{ name: "pdf", maxCount: 1 }]), async (req, res) => {
    try {
      console.log("📂 Request Body:", req.body);
      console.log("📂 Uploaded File:", req.files);
  
      if (!req.files || !req.files.pdf) {
        return res.status(400).json({ error: "No file uploaded" });
      }
  
      const { branch, semester, category, subject, pdfName } = req.body;
      if (!branch || !semester || !category || !subject || !pdfName) {
        return res.status(400).json({ error: "Missing required fields" });
      }
  
      res.status(200).json({ message: "File uploaded successfully", file: req.files.pdf[0].filename });
    } catch (error) {
      console.error("❌ Upload Error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
  router.delete("/delete", async (req, res) => {
    try {
    const { pdfName, branch, semester, category, subject } = req.query;

    if (!pdfName || !branch || !semester || !category || !subject) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Construct the file path dynamically
    const filePath = path.join(__dirname, `../uploads/${branch}/semester_${semester}/${category}/${subject}`, pdfName);

    console.log("🔍 Attempting to delete:", filePath); // Debugging log

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.status(200).json({ message: "PDF deleted successfully" });
    } else {
      return res.status(404).json({ error: "File not found" });
    }
  } catch (error) {
    console.error("❌ Delete Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
  });
  
  router.put("/rename", async (req, res) => {
    try {
        const { oldName, newName, branch, semester, category, subject } = req.body;
 
        if (!oldName || !newName || !branch || !semester || !category || !subject) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        // ✅ Fix: Use `path.join` correctly
        const oldPath = path.join(__dirname, `../uploads/${branch}/semester_${semester}/${category}/${subject}`, oldName);
        const newPath = path.join(__dirname, `../uploads/${branch}/semester_${semester}/${category}/${subject}`, newName);

        console.log("🔄 Renaming:", oldPath, "➡", newPath);

        if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
            return res.status(200).json({ message: "PDF renamed successfully" });
        } else {
            return res.status(404).json({ error: "File not found", attemptedPath: oldPath });
        }
    } catch (error) {
        console.error("❌ Rename Error:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

  
  
  
  
module.exports=router;



