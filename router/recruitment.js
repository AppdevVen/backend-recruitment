/**
 * Recruitment Routes
 * Routes for the recruitment management system
 */

import express from "express";
import {
  login,
  logout,
  getProfile,
  refreshToken,
  getMenu,
} from "../controllers/recruitment/authController.js";

import {
  listPriorities,
  getPriority,
  createPriority,
  updatePriority,
  deletePriority,
} from "../controllers/recruitment/priorityController.js";

import {
  getPeriod,
  updatePeriod,
  checkPeriodStatus,
} from "../controllers/recruitment/periodeController.js";

import {
  registerCandidate,
  checkKtp,
  listCandidates,
  getCandidate,
} from "../controllers/recruitment/candidateController.js";

import {
  sendPendingNotifications,
  sendSingleNotification,
  getPendingCount,
} from "../controllers/recruitment/notificationController.js";

import multer from "multer";

// File upload config for CV
const cvStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "file");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, uniqueSuffix + "." + ext);
  },
});
const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF, DOC, DOCX yang diizinkan'));
    }
  }
});

const router = express.Router();

// === Auth Routes ===
// Public routes (no token required)
router.post("/login", login);

// Protected routes
router.post("/logout", logout);
router.get("/me", getProfile);
router.post("/refresh-token", refreshToken);
router.get("/menu", getMenu);

// === Priority Routes ===
router.get("/priorities", listPriorities);
router.get("/priorities/:id", getPriority);
router.post("/priorities", createPriority);
router.put("/priorities/:id", updatePriority);
router.delete("/priorities/:id", deletePriority);

// === Period Routes ===
router.get("/periods", getPeriod);
router.put("/periods", updatePeriod);
// router.get("/periods/status", checkPeriodStatus);

// === Candidate Routes ===
router.post("/candidates", uploadCV.single("file_cv"), registerCandidate);
router.get("/candidates/check-ktp/:id_num", checkKtp);
router.get("/candidates", listCandidates);
router.get("/candidates/:code", getCandidate);

// === Notifications Routes ===
router.post("/notifications/send", sendPendingNotifications);
router.post("/notifications/send-single", sendSingleNotification);
router.get("/notifications/pending", getPendingCount);

export default router;
