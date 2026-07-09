/**
 * Auth Controller — Recruitment Management System
 * Handles login, logout, and session management for admin panel
 */

import { db } from "../../config/db.js";
import { getErrorResponse } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

/**
 * POST /recruitment/login
 * Authenticate admin user with username + password (MD5 → bcrypt migration ready)
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        type: 'error',
        message: 'Username dan password wajib diisi'
      });
    }

    // Hash password with MD5 (legacy compatibility)
    const md5Pass = crypto.createHash('md5').update(password).digest('hex');

    // Find user in admin_cv table
    const user = await db("admin_cv")
      .select("adm_id", "adm_name", "adm_user", "adm_level")
      .where("adm_user", username)
      .where("adm_pass", md5Pass)
      .first();

    if (!user) {
      return res.status(401).json({
        type: 'error',
        message: 'Username atau password salah'
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.adm_id,
      user: user.adm_user,
      level: user.adm_level
    };

    const expiresIn = process.env.TOKEN_EXPIRATION || '24h';
    const token = jwt.sign(tokenPayload, process.env.TOKEN || process.env.JWT_SECRET, { expiresIn });

    // Log access
    await db("log_akses").insert({
      nik: user.adm_user,
      empid: user.adm_user,
      tanggal: new Date(),
      status: 'Login',
      keterangan: 'User',
      ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '',
      nama_url: req.headers?.host || ''
    });

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: user.adm_id,
        username: user.adm_user,
        name: user.adm_name || user.adm_user,
        level: user.adm_level || 'User',
        token: token
      }
    });

  } catch (error) {
    logger(error, 'POST /recruitment/login', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * POST /recruitment/logout
 * Log logout activity and invalidate session
 */
export const logout = async (req, res) => {
  try {
    const { username, type } = req.body;

    const keterangan = type === 'system' ? 'System' : 'User';

    if (username) {
      await db("log_akses").insert({
        nik: username,
        empid: username,
        tanggal: new Date(),
        status: 'Logout',
        keterangan: keterangan,
        ip: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '',
        nama_url: req.headers?.host || ''
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logout berhasil'
    });

  } catch (error) {
    logger(error, 'POST /recruitment/logout', req.body);
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/me
 * Get current user profile from JWT token
 */
export const getProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ type: 'error', message: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.TOKEN || process.env.JWT_SECRET);

    const user = await db("admin_cv")
      .select("adm_id", "adm_name", "adm_user", "adm_level")
      .where("adm_id", decoded.id)
      .first();

    if (!user) {
      return res.status(404).json({ type: 'error', message: 'User tidak ditemukan' });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: user.adm_id,
        username: user.adm_user,
        name: user.adm_name,
        level: user.adm_level
      }
    });

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ type: 'error', message: 'Token sudah expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ type: 'error', message: 'Token tidak valid' });
    }
    logger(error, 'GET /recruitment/me', {});
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * POST /recruitment/refresh-token
 * Refresh JWT token
 */
export const refreshToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ type: 'error', message: 'Token tidak ditemukan' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.TOKEN || process.env.JWT_SECRET, { ignoreExpiration: true });

    // Verify user still exists and active
    const user = await db("admin_cv")
      .select("adm_id", "adm_user", "adm_level")
      .where("adm_id", decoded.id)
      .first();

    if (!user) {
      return res.status(401).json({ type: 'error', message: 'User tidak ditemukan' });
    }

    // Generate new token
    const newToken = jwt.sign(
      { id: user.adm_id, user: user.adm_user, level: user.adm_level },
      process.env.TOKEN || process.env.JWT_SECRET,
      { expiresIn: process.env.TOKEN_EXPIRATION || '24h' }
    );

    return res.status(200).json({
      success: true,
      data: { token: newToken }
    });

  } catch (error) {
    logger(error, 'POST /recruitment/refresh-token', {});
    return res.status(500).json(getErrorResponse(error));
  }
};

/**
 * GET /recruitment/menu
 * Get menu items from the menu table (db = recruitment database)
 * Returns parent menus with their children, ordered by order_menu
 */
export const getMenu = async (req, res) => {
  try {
    // Get all parent menus (parent = 0 or null)
    const parents = await db("menu")
      .select("id", "name", "icon", "link", "parent", "order_menu")
      .where(function () {
        this.where("parent", 0).orWhereNull("parent");
      })
      .whereNull("deleted_at")
      .orderBy("order_menu", "asc");

    // For each parent, get its children
    const menuData = [];
    for (const parent of parents) {
      const children = await db("menu")
        .select("id", "name", "icon", "link", "parent", "order_menu")
        .where("parent", parent.id)
        .whereNull("deleted_at")
        .orderBy("order_menu", "asc");

      menuData.push({
        ...parent,
        children: children || []
      });
    }

    return res.status(200).json({
      success: true,
      data: menuData
    });

  } catch (error) {
    logger(error, 'GET /recruitment/menu', {});
    return res.status(500).json(getErrorResponse(error));
  }
};
