/**
 * Candidate Controller — Recruitment Management System
 * Handles candidate registration, duplicate check, and CV file upload to FTP
 */

import { db } from "../../config/db.js";
import { getErrorResponse } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import { uploadFile, removeLocalFile } from "../../helpers/ftp.js";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /recruitment/candidates
 * Register a new candidate (public endpoint)
 */
export const registerCandidate = async (req, res) => {
  try {
    const {
      position, id_num, name, gender, place, dob, age,
      address, telp1, telp2, phone, email, status, source,
      priority_1, priority_2, priority_3, others,
      edu_major1, edu_school1, edu_degree1, edu_jurusan1, edu_start1, edu_end1, edu_gpa1,
      edu_major2, edu_school2, edu_degree2, edu_jurusan2, edu_start2, edu_end2, edu_gpa2,
      exp_pt, exp_posisi, exp_start, exp_end
    } = req.body;

    // Validation
    if (!id_num) {
      return res.status(400).json({ type: 'error', message: 'Nomor KTP wajib diisi' });
    }
    if (!name) {
      return res.status(400).json({ type: 'error', message: 'Nama wajib diisi' });
    }
    if (!gender) {
      return res.status(400).json({ type: 'error', message: 'Jenis kelamin wajib dipilih' });
    }
    if (!email) {
      return res.status(400).json({ type: 'error', message: 'Email wajib diisi' });
    }

    // Check duplicate KTP
    const existing = await db("recrut_cv").where("id_num", id_num).first();
    if (existing) {
      return res.status(409).json({ type: 'error', message: 'Nomor KTP sudah terdaftar' });
    }

    // Generate cv_code
    const maxResult = await db("recrut_cv").max("cv_id as max_id").first();
    const nextId = (maxResult?.max_id || 0) + 1;
    const cv_code = "CV" + String(nextId).padStart(4, '0');

    // Format telephone
    const cv_telp = [telp1, telp2].filter(Boolean).join(' ');

    // Format date of birth
    const cv_bod = dob ? new Date(dob) : null;

    // Get uploaded CV filename
    const file_cv = req.file ? `${id_num}${path.extname(req.file.originalname)}` : '';

    // If file uploaded, rename to KTP-based filename and upload to FTP
    if (req.file) {
      const localDir = path.dirname(req.file.path);
      const newLocalPath = path.join(localDir, file_cv);
      
      try {
        // Rename file locally to KTP-based filename
        fs.renameSync(req.file.path, newLocalPath);
        
        // Upload to FTP
        const ftpDirectory = process.env.FTP_DIRECTORY || 'recruitment/uploadcv';
        await uploadFile(localDir, ftpDirectory, file_cv);
        
        // Remove local file after successful FTP upload
        await removeLocalFile(newLocalPath);
      } catch (uploadErr) {
        console.error('FTP upload failed:', uploadErr.message);
        // Clean up local file if it exists
        try {
          if (fs.existsSync(newLocalPath)) fs.unlinkSync(newLocalPath);
          else if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (cleanupErr) {
          console.error('Cleanup failed:', cleanupErr.message);
        }
        return res.status(500).json({ type: 'error', message: 'Gagal mengupload file CV. Silakan coba lagi.' });
      }
    }

    // Insert candidate record
    await db("recrut_cv").insert({
      cv_date: new Date(),
      cv_code: cv_code,
      cv_position: position || 'Management Trainee',
      id_num: id_num,
      cv_name: name,
      cv_gender: gender,
      cv_place: place || '',
      cv_bod: cv_bod,
      cv_age: parseInt(age) || 0,
      cv_address: address || '',
      cv_telp: cv_telp,
      cv_phone: phone || '',
      cv_email: email,
      cv_status: status || 'S',
      source: source || '',
      priority_1: priority_1 || '',
      priority_2: priority_2 || '',
      priority_3: priority_3 || '',
      others: others || '',
      edu_major1: edu_major1 || '',
      edu_school1: edu_school1 || '',
      edu_degree1: edu_degree1 || '',
      edu_jurusan1: edu_jurusan1 || '',
      edu_start1: edu_start1 || '',
      edu_end1: edu_end1 || '',
      edu_gpa1: edu_gpa1 || '',
      edu_major2: edu_major2 || '',
      edu_school2: edu_school2 || '',
      edu_degree2: edu_degree2 || '',
      edu_jurusan2: edu_jurusan2 || '',
      edu_start2: edu_start2 || '',
      edu_end2: edu_end2 || '',
      edu_gpa2: edu_gpa2 || '',
      exp_pt: exp_pt || '',
      exp_posisi: exp_posisi || '',
      exp_start: exp_start || '',
      exp_end: exp_end || '',
      file_cv: file_cv,
      foto: '',
      send: 0
    });

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil',
      data: { cv_code: cv_code }
    });

  } catch (error) {
    logger(error, 'POST /recruitment/candidates', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/candidates/check-ktp/:id_num
 * Check if KTP number already exists (public endpoint for frontend validation)
 */
export const checkKtp = async (req, res) => {
  try {
    const { id_num } = req.params;

    if (!id_num) {
      return res.status(400).json({ type: 'error', message: 'Nomor KTP wajib diisi' });
    }

    const existing = await db("recrut_cv").where("id_num", id_num).first();

    return res.status(200).json({
      success: true,
      data: { exists: !!existing }
    });

  } catch (error) {
    logger(error, 'GET /recruitment/candidates/check-ktp/:id_num', req.params);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/candidates
 * List candidates with filters (admin only)
 */
export const listCandidates = async (req, res) => {
  try {
    const { ktp, gender, age, apply_start, apply_end, priority_1, priority_2, priority_3 } = req.query;

    let query = db("recrut_cv")
      .select("*")
      .orderBy("cv_id", "desc");

    if (ktp) query = query.where("id_num", ktp);
    if (gender) query = query.where("cv_gender", gender);
    if (age) query = query.where("cv_age", age);
    if (apply_start) query = query.where("cv_date", ">=", apply_start);
    if (apply_end) query = query.where("cv_date", "<=", apply_end);
    if (priority_1) query = query.where("priority_1", priority_1);
    if (priority_2) query = query.where("priority_2", priority_2);
    if (priority_3) query = query.where("priority_3", priority_3);

    const data = await query;

    return res.status(200).json({
      success: true,
      data: data,
      total: data.length
    });

  } catch (error) {
    logger(error, 'GET /recruitment/candidates', req.query);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/candidates/:code
 * Get single candidate by cv_code (admin only)
 */
export const getCandidate = async (req, res) => {
  try {
    const { code } = req.params;

    const data = await db("recrut_cv").where("cv_code", code).first();

    if (!data) {
      return res.status(404).json({ type: 'error', message: 'Data kandidat tidak ditemukan' });
    }

    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    logger(error, 'GET /recruitment/candidates/:code', req.params);
    return res.status(500).json(getErrorResponse(error));
  }
};
