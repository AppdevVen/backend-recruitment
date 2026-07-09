/**
 * Periode Controller — Recruitment Management System
 * CRUD operations for mstr_periode (periode pendaftaran recruitment)
 */

import { db } from "../../config/db.js";
import { getErrorResponse } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * GET /recruitment/periods
 * Get current active period (periode_id = 1)
 */
export const getPeriod = async (req, res) => {
  try {
    const data = await db("mstr_periode")
      .select(
        "periode_id",
        "periode_date_start",
        "periode_date_end",
        "periode_time_end",
        "periode_status",
        "modify_date",
        "modify_by"
      )
      .where("periode_id", 1)
      .first();

    if (!data) {
      return res.status(404).json({
        type: 'error',
        message: 'Data periode tidak ditemukan'
      });
    }

    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    logger(error, 'GET /recruitment/periods', {});
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * PUT /recruitment/periods
 * Update period settings (start date, end date, end time, status)
 */
export const updatePeriod = async (req, res) => {
  try {
    const { periode_date_start, periode_date_end, periode_time_end, periode_status } = req.body;

    if (!periode_date_start) {
      return res.status(400).json({ type: 'error', message: 'Periode mulai wajib diisi' });
    }
    if (!periode_date_end) {
      return res.status(400).json({ type: 'error', message: 'Periode akhir wajib diisi' });
    }
    if (!periode_time_end) {
      return res.status(400).json({ type: 'error', message: 'Jam akhir wajib diisi' });
    }
    if (!periode_status) {
      return res.status(400).json({ type: 'error', message: 'Status wajib dipilih' });
    }

    // Validate date range
    if (new Date(periode_date_end) < new Date(periode_date_start)) {
      return res.status(400).json({ type: 'error', message: 'Periode akhir tidak boleh sebelum periode mulai' });
    }

    await db("mstr_periode")
      .where("periode_id", 1)
      .update({
        periode_date_start: periode_date_start,
        periode_date_end: periode_date_end,
        periode_time_end: periode_time_end,
        periode_status: periode_status,
        modify_date: new Date(),
        modify_by: 'corporate'
      });

    return res.status(200).json({
      success: true,
      message: 'Periode berhasil diperbarui'
    });

  } catch (error) {
    logger(error, 'PUT /recruitment/periods', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/periods/status
 * Check if registration is currently open (public endpoint)
 */
export const checkPeriodStatus = async (req, res) => {
  try {
    const data = await db("mstr_periode")
      .select("periode_date_start", "periode_date_end", "periode_time_end", "periode_status")
      .where("periode_id", 1)
      .first();

    if (!data) {
      return res.status(200).json({ success: true, data: { is_open: false } });
    }

    const now = new Date();
    const start = new Date(data.periode_date_start);
    const endDateStr = new Date(data.periode_date_end); // Convert to ISO string for consistent comparison
    endDateStr.setUTCHours(23,59,59,999);
    const end = endDateStr.toISOString(); // Set to end of the day in UTC 

    const isOpen = now >= data.periode_date_start && now <= data.periode_date_end && data.periode_status === 'Active';

    return res.status(200).json({
      success: true,
      data: {
        is_open: isOpen,
        start: data.periode_date_start,
        end: data.periode_date_end,
        time_end: data.periode_time_end,
        status: data.periode_status
      }
    });

  } catch (error) {
    logger(error, 'GET /recruitment/periods/status', {});
    return res.status(500).json(getErrorResponse(error));
  }
};
