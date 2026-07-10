/**
 * Notification Controller — Recruitment Management System
 * Handles batch email notifications to candidates (replaces sendnotifrecruitment.php)
 */

import { db } from "../../config/db.js";
import { getErrorResponse } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Create email transporter
 */
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
};

/**
 * Generate email HTML template
 */
const generateEmailTemplate = (candidateName) => {
  return `
    <div style="font-family:arial;width:100%;max-width:600px;margin:0 auto;">
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%;font-size:1em;padding:10px;border:2px solid #e5e7eb;border-radius:8px;">
        <tr>
          <td style="padding:16px;">
            <h3 style="margin:0;color:#1f2937;">Recruitment DBC</h3>
          </td>
          <td style="padding:16px;text-align:right;">
            <span style="font-size:24px;">🏢</span>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:3px solid #1a56db;padding-top:20px;padding-left:16px;padding-right:16px;">
            <p>Halo, <strong>${candidateName}</strong>!</p>
            <p>Terima kasih telah mendaftar di <b>recruitment.dbc.co.id</b>.</p>
            <p>Super tim kami akan menindaklanjuti data Anda dalam 2 x 24 Jam.</p>
            <p><strong>See you on top!</strong> 😊</p>
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:16px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;margin-top:20px;">
            DBC Group
          </td>
        </tr>
      </table>
    </div>
  `;
};

/**
 * POST /recruitment/notifications/send
 * Send pending email notifications to candidates with send=0
 */
export const sendPendingNotifications = async (req, res) => {
  try {
    // Get all candidates that haven't been notified
    const pendingCandidates = await db("recrut_cv")
      .select("cv_id", "cv_name", "cv_email")
      .where("send", 0)
      .whereNotNull("cv_email")

    if (pendingCandidates.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Tidak ada notifikasi yang perlu dikirim',
        data: { sent: 0, failed: 0 }
      });
    }

    const transporter = getTransporter();
    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const candidate of pendingCandidates) {
      try {
        await transporter.sendMail({
          from: `"DBC Recruitment" <${process.env.SMTP_USER || 'auto@djabesmen.co.id'}>`,
          to: candidate.cv_email,
          subject: 'RECRUITMENT @ DBC — Konfirmasi Pendaftaran',
          html: generateEmailTemplate(candidate.cv_name),
        });

        // Update send flag
        await db("recrut_cv")
          .where("cv_id", candidate.cv_id)
          .update({ send: 1 });

        sent++;
      } catch (emailErr) {
        failed++;
        errors.push({ cv_id: candidate.cv_id, email: candidate.cv_email, error: emailErr.message });
        console.error(`Failed to send email to ${candidate.cv_email}:`, emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Notifikasi selesai: ${sent} berhasil, ${failed} gagal`,
      data: { sent, failed, total: pendingCandidates.length, errors: errors.length > 0 ? errors : undefined }
    });

  } catch (error) {
    logger(error, 'POST /recruitment/notifications/send', {});
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * POST /recruitment/notifications/send-single
 * Send email notification to a single candidate by cv_id
 */
export const sendSingleNotification = async (req, res) => {
  try {
    const { cv_id } = req.body;

    if (!cv_id) {
      return res.status(400).json({ type: 'error', message: 'cv_id wajib diisi' });
    }

    const candidate = await db("recrut_cv")
      .select("cv_id", "cv_name", "cv_email", "send")
      .where("cv_id", cv_id)
      .first();

    if (!candidate) {
      return res.status(404).json({ type: 'error', message: 'Kandidat tidak ditemukan' });
    }

    if (!candidate.cv_email) {
      return res.status(400).json({ type: 'error', message: 'Kandidat tidak memiliki email' });
    }

    if (candidate.send === 1) {
      return res.status(400).json({ type: 'error', message: 'Email sudah pernah dikirim ke kandidat ini' });
    }

    const transporter = getTransporter();

    console.log('masuk mau kirim email')
    await transporter.sendMail({
      from: `"DBC Recruitment" <${process.env.SMTP_USER || 'auto@djabesmen.co.id'}>`,
      to: candidate.cv_email,
      subject: 'RECRUITMENT @ DBC — Konfirmasi Pendaftaran',
      html: generateEmailTemplate(candidate.cv_name),
    });

    await db("recrut_cv")
      .where("cv_id", cv_id)
      .update({ send: 1 });

    return res.status(200).json({
      success: true,
      message: `Email berhasil dikirim ke ${candidate.cv_email}`
    });

  } catch (error) {
    logger(error, 'POST /recruitment/notifications/send-single', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/notifications/pending
 * Get count of pending notifications
 */
export const getPendingCount = async (req, res) => {
  try {
    const result = await db("recrut_cv")
      .where("send", 0)
      .whereNotNull("cv_email")
      .where("cv_email", "!=", "")
      .count("cv_id as count")
      .first();

    return res.status(200).json({
      success: true,
      data: { pending: result?.count || 0 }
    });

  } catch (error) {
    logger(error, 'GET /recruitment/notifications/pending', {});
    return res.status(500).json(getErrorResponse(error));
  }
};
