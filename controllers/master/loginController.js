//import { Menu } from "../model/menu.js";
//import { Users } from "../model/users.js";

import { dbHris, db } from "../../config/db.js";
import { decrypt, encrypt, getErrorResponse, mySimpleCrypt } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { createUserResponse, logAccess } from "../../helpers/master/login.js";

dotenv.config();


export const login = async (req, res) => {
  // #swagger.tags = ['User']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk validasi login'
  try {
    const { nik, pass, url } = req.body;
    
    const users = await db("users").select("user_id","user_nik","user_name","user_domain","user_site",db.raw("'' as user_role")).where('user_nik',nik).first();
    if (!users) return res.status(406).json({type:'error',message:`User ${nik} belum terdaftar pada aplikasi ini`});

    const hris = await dbHris("portal.dbo.ptl_hris as a").select("a.Emp_Id","a.user_pass","a.user_newid","a.grade","a.jabatan","a.map_dept_pk","a.map_div_pk","b.nama_div","b.nama_dept").leftJoin('vw_div_dept as b',function(){this.on('b.map_div_pk','=','a.map_div_pk').on('b.map_dept_pk','=','a.map_dept_pk')}).where('user_active','Active').where('Emp_Id',users.user_id).first();

    if (!hris) {
      await db("users").where('user_nik',nik).update({user_active:0});
      return res.status(406).json({type:'error',message:`User ${nik} sudah tidak aktif`});
    }

    const direktorat = await dbHris("portal.dbo.master_dept_dir").select("id_dir","nama_dir").where('id_div',hris.map_div_pk).first();

    if (process.env.ENVIRONMENT === 'PRODUCTION' && hris.user_pass !== await mySimpleCrypt(pass)) {
      return res.status(406).json({type:'error',message:`NIK/Password tidak sesuai`});
    }

    const [, unit, resPortal] = await Promise.all([
      db("users").where('user_nik',nik).update({user_nik:hris.user_newid,user_grade:hris.grade,user_jabatan:hris.jabatan,user_dept_id:hris.map_dept_pk,user_dept_name:hris.nama_dept,user_div_id:hris.map_div_pk,user_div_name:hris.nama_div,user_dir_id:direktorat?.id_dir,user_dir_name:direktorat?.nama_dir}),
      db("mst_domain").select("domain_shortname").where('domain_code',users.user_domain).first(),
      dbHris("ptl_policy").where("id",0).first()
    ]);

    const token = jwt.sign({user:users.user_id},process.env.TOKEN,{expiresIn:resPortal.idle_time});
    await logAccess(users,hris,url);
    res.status(200).json(await createUserResponse(users,unit,token,process.env.ENVIRONMENT === 'PRODUCTION' ? resPortal.idle_time : 3600000));
  } catch (error) {
    logger(error, 'POST /login', req.body);
    return res.status(406).json(getErrorResponse(error));
  } 
};

export const refresh_token = async (req, res) => {
  // #swagger.tags = ['User']
  /* #swagger.security = [{
                "bearerAuth": []
        }] */
  // #swagger.description = 'Fungsi untuk refresh token'
  try {
    const response = await db("users")
      .where("user_id", req.body.empid)
      .first();

    const resPortal = await dbHris("ptl_policy").where("id", 0).first();
    let token = jwt.sign({ user: response.user_id }, process.env.TOKEN, {
      expiresIn: resPortal.idle_time,
    });
    //pakai .toSQL().toNative() untuk mengecek query dalam format sql
    res.status(200).json({ token: token });
  } catch (error) {
    logger(error, 'POST /refresh_token', req.body);
    return res.status(406).json({
      type:'error',
      message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
  });
  }
};

export const logout = async (req, res) => {
   // #swagger.tags = ['User']
  /* #swagger.security = [{
                "bearerAuth": []
        }] */
  // #swagger.description = 'Fungsi untuk save log aktivitas saat logout'
  try {
    const { empid: encryptedEmpid, note, url } = req.body.params;
    const empid = await decrypt(encryptedEmpid);
    
    const users = await db("users")
      .select("user_id", "user_nik", "user_name", "user_domain", "user_site")
      .where('user_id', empid)
      .first();
    
    if (users) {
      await db("log_akses").insert({
        empid: users.user_id,
        nik: users.user_nik,
        status: "logout",
        keterangan: note,
        nama_url: url,
      });
    }
    
    return res.json("sukses");
  }catch (error) {
    logger(error, 'POST /logout', req.body);
    return res.status(406).json(getErrorResponse(error));
  }
}


export const login_portal = async (req, res) => {
  
  // #swagger.tags = ['User']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk validasi login via portal'
 try {
    let users = await db("users")
   .select("user_id","user_nik","user_name","user_domain","user_site","user_role")
   .where ('user_id',req.body.nik)
   .first();
   //return res.status(200).json(users);
    if (!users){
    return res.status(406).json({
      type:'error',
      message: `User belum terdaftar pada aplikasi ini`,
    });
   }
   
   let hris = await dbHris("portal.dbo.ptl_hris")
   .select("Emp_Id","user_pass",'user_newid','grade','jabatan')
   .where ('Emp_Id',users.user_id)
   .where('user_active','Active')
   .first();
   if (!hris){
    //update status user
    await db("users")
    .where ('user_id',req.body.nik)
    .update({
      'user_active':0
    });

    return res.status(406).json({
      type:'error',
      message: `User sudah tidak aktif`,
    });
   }else{
    await db("users")
    .where ('user_id',req.body.nik)
    .update({
      'user_active':1
    });
   }
   
   let jabatan = hris.jabatan;

   await db("users")
   .where ('user_id',req.body.nik)
   .update({
     'user_nik':hris.user_newid,
     'user_grade':hris.grade,
     'user_jabatan':jabatan
   });
  
   let unit = await db("domain")
   .select("domain_shortname")
   .where ('domain_code',users.user_domain)
   .first();

   const resPortal = await dbHris("ptl_policy").where("id", 0).first();
   let token = jwt.sign({ user: users.user_id }, process.env.TOKEN, {
     expiresIn: resPortal.idle_time,
   });
  
   await db("log_akses").insert({
    empid:users.user_id,
    nik: hris.user_newid,
    status: "login",
    keterangan: "user",
    nama_url:req.body.url,
  });
  res.status(200).json({
    message: "success",
    data: {
      nama: users.user_name,
      unit: unit.domain_shortname,
      empid: encrypt(users.user_id),
      domain: users.user_domain,
      nik:users.user_nik,
      site:users.user_site,
      token: token,
      role:encrypt(users.role),
      idle: resPortal.idle_time,
    },
  });
   
} catch (error) {
  return res.status(406).json({
    type:'error',
    message: process.env.DEBUG == 1 ?error.message: `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT` ,
});
} 
};
