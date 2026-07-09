import { db } from "../../config/db.js";
import { encrypt } from "../utils.js";

export const createUserResponse = async (users, unit, token, idle, no_tiket = null, flag = null, tiket = null) => ({
  message: "success",
  data: {
    nama: users.user_name,
    unit: unit?.domain_shortname || null,
    empid: await encrypt(`${users.user_id}`),
    domain: users.user_domain,
    nik: users.user_nik,
    site: users.user_site,
    role: await encrypt(`${users.user_role}`),
    super: await encrypt(`${users.user_admin}`),
    token,
    idle,
    ...(no_tiket && { no_tiket }),
    ...(flag && { flag }),
    ...(tiket && { tiket }),
  },
});

// Helper function to log access
export const logAccess = async (users, hris, url) => {
  await db("log_akses").insert({
    empid: users.user_id,
    nik: hris.user_newid,
    status: "login",
    keterangan: "user",
    nama_url: url,
  });
};