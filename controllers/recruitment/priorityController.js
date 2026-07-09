/**
 * Priority Controller — Recruitment Management System
 * CRUD operations for mstr_prioritas (master departemen/prioritas)
 */

import { db } from "../../config/db.js";
import { getErrorResponse } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * GET /recruitment/priorities
 * List all priorities (optionally filter by active status)
 */
export const listPriorities = async (req, res) => {
  try {
    const { active } = req.query;

    let query = db("mstr_prioritas").select(
      "id_prioritas",
      "alias_prioritas",
      "desc_prioritas",
      "is_active",
      "created_by",
      "modify_date",
      "modify_by"
    ).orderBy("id_prioritas", "asc");

    if (active !== undefined) {
      query = query.where("is_active", active);
    }

    const data = await query;

    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    logger(error, 'GET /recruitment/priorities', req.query);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/priorities/:id
 * Get single priority by ID
 */
export const getPriority = async (req, res) => {
  try {
    const { id } = req.params;

    const data = await db("mstr_prioritas")
      .select("id_prioritas", "alias_prioritas", "desc_prioritas", "is_active", "created_by", "modify_date", "modify_by")
      .where("id_prioritas", id)
      .first();

    if (!data) {
      return res.status(404).json({
        type: 'error',
        message: 'Data prioritas tidak ditemukan'
      });
    }

    return res.status(200).json({
      success: true,
      data: data
    });

  } catch (error) {
    logger(error, 'GET /recruitment/priorities/:id', req.params);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * POST /recruitment/priorities
 * Create new priority
 */
export const createPriority = async (req, res) => {
  try {
    const { alias_prioritas, is_active } = req.body;

    if (!alias_prioritas) {
      return res.status(400).json({
        type: 'error',
        message: 'Nama prioritas wajib diisi'
      });
    }

    await db("mstr_prioritas").insert({
      alias_prioritas: alias_prioritas,
      desc_prioritas: alias_prioritas,
      is_active: is_active !== undefined ? is_active : 1,
      created_by: 'corporate'
    });

    return res.status(201).json({
      success: true,
      message: 'Prioritas berhasil ditambahkan'
    });

  } catch (error) {
    logger(error, 'POST /recruitment/priorities', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * PUT /recruitment/priorities/:id
 * Update existing priority
 */
export const updatePriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { alias_prioritas, is_active } = req.body;
    if (!alias_prioritas) {
      return res.status(400).json({
        type: 'error',
        message: 'Nama prioritas wajib diisi'
      });
    }

    const existing = await db("mstr_prioritas").where("id_prioritas", id).first();
    if (!existing) {
      return res.status(404).json({
        type: 'error',
        message: 'Data prioritas tidak ditemukan'
      });
    }

    await db("mstr_prioritas")
      .where("id_prioritas", id)
      .update({
        alias_prioritas: alias_prioritas,
        desc_prioritas: alias_prioritas,
        is_active: is_active !== undefined ? is_active : existing.is_active,
        modify_date: new Date(),
        modify_by: 'corporate'
      });

    return res.status(200).json({
      success: true,
      message: 'Prioritas berhasil diperbarui'
    });

  } catch (error) {
    logger(error, 'PUT /recruitment/priorities/:id', { ...req.params, ...req.body });
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * DELETE /recruitment/priorities/:id
 * Delete priority
 */
export const deletePriority = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await db("mstr_prioritas").where("id_prioritas", id).first();
    if (!existing) {
      return res.status(404).json({
        type: 'error',
        message: 'Data prioritas tidak ditemukan'
      });
    }

    await db("mstr_prioritas").where("id_prioritas", id).del();

    return res.status(200).json({
      success: true,
      message: 'Prioritas berhasil dihapus'
    });

  } catch (error) {
    logger(error, 'DELETE /recruitment/priorities/:id', req.params);
    return res.status(500).json(getErrorResponse(error));
  }
};
