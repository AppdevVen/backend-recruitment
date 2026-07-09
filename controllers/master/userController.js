import { dbHris, db } from "../../config/db.js";
import dayjs from "dayjs";
import * as dotenv from 'dotenv' ;
import { uploadFile,removeFile } from "../../helpers/ftp.js";
import { unlink } from 'node:fs';
import { decrypt, encrypt, getErrorResponse, objectToString } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
dotenv.config();

  export const listUser = async (req, res) => {
    try {
      if (req.query.rowsPerPage == null) {
        let responseQuery = db("users")
          .select('user_id','user_nik','user_name','user_domain','user_site','user_email','user_dept_id','user_dept_name','user_div_id','user_div_name','user_dir_id','user_dir_name','users.updated_at','users.updated_by')
          .where("user_active", 'Active');
        if (req.query.limit) {
          responseQuery.limit(req.query.limit);
        }
        if(req.query.dkv){
           const [divDkv, jabatanDkv] = await Promise.all([
              db('mst_code').where('code_field', 'design_div_id').where('code_status','Active').first(),
              db("mst_code").where("code_field", 'design_analyst_jabatan').where('code_status', 'Active').first()
            ]);
            if(!divDkv||!jabatanDkv){
              return res.status(406).json({
                type:'error',
                message: `Data divisi dan jabatan Corp Marketing belum di setting di gencode`,
              });
            }
          responseQuery.where('user_jabatan',jabatanDkv.code_value);
          responseQuery.where('user_div_id',divDkv.code_value);
        }
        const response=await responseQuery.orderBy("user_nik");
        res.status(200).json(response);
      } else {
        const sorting = req.query.descending === "true" ? "desc" : "asc";
        const columnSort =
          req.query.sortBy === "desc"
            ? "user_nik asc"
            : `${req.query.sortBy} ${sorting}`;

        const page = Math.floor(req.query.page);
        const response = await db.select('*')
          .from(function () {
            this.table("users")
            .select('user_id','user_nik','user_name','user_domain','user_site','user_email',
              'domain_shortname','user_dept_id','user_dept_name','user_div_id','user_div_name','user_dir_id','user_dir_name','site_desc','users.updated_at','user_jabatan',
              db.raw('COALESCE((select user_name from users a where a.user_id = users.updated_by), users.updated_by) as modifier'))
            .innerJoin('mst_domain', function() {
              this.on('user_domain', '=', 'domain_code');
            })
            .innerJoin('mst_site', function() {
              this.on('user_domain', '=', 'site_domain');
              this.on('user_site', '=', 'site_code');
            })
            .where("user_active", 'Active')
            .whereNull("users.deleted_at")
            .where((query) => {
              if (req.query.filter != null) {
                query.orWhere("user_nik", "like", `%${req.query.filter}%`);
                query.orWhere("user_name", "like", `%${req.query.filter}%`);
                query.orWhere("user_email", "like", `%${req.query.filter}%`);
                query.orWhere("user_jabatan", "like", `%${req.query.filter}%`);
                query.orWhere("user_grade", "like", `%${req.query.filter}%`);
                query.orWhere("user_domain", "like", `%${req.query.filter}%`);
                query.orWhere("user_site", "like", `%${req.query.filter}%`);
                query.orWhere("site_desc", "like", `%${req.query.filter}%`);
                query.orWhere("domain_shortname", "like", `%${req.query.filter}%`);
              }
            })
            .as('a');
          })
          .orderByRaw(columnSort)
          .paginate({
            perPage: Math.floor(req.query.rowsPerPage),
            currentPage: page,
            isLengthAware: true,
          });

          for (const data of response.data) {
            data.user_id=await encrypt(data.user_id);
          }

        res.status(200).json(response);
      }
    } catch (error) {
      logger(error, 'GET /listUser', req.query);
      return res.status(406).json(getErrorResponse(error));
    }
  };

  export const listAksesDomain = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi menampilkan list domain yang bisa diakses user'
    
    try {
      const empid = await decrypt(req.query.empid)
      const response = await db("user_domain")
        .select("usd_domain as value",db.raw("usd_domain + ' - ' + domain_shortname as [desc]"))
        .innerJoin('mst_domain', function() {
          this.on('usd_domain', '=', 'domain_code');
        })
        .where("usd_empid", empid)
        .whereNull('user_domain.deleted_at')
        .orderByRaw("usd_domain,domain_shortname");
      res.status(200).json(response);
    } catch (error) {
      logger(error, 'GET /listAksesDomain', req.query);
      return res.status(406).json({
          type:'error',
          message: process.env.DEBUG == 1 ?error.message: `Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT` ,
      });
    }
   
  }

  export const listUserMenuByRole = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi menampilkan list akses menu user saat ini'
    try {
      const empid = await decrypt(req.query.empid);
      const grants = await db('user_grant_role').select('grant_urole_id').where('grant_user_id',empid).whereNull('deleted_at');
      if(grants.length === 0) return res.status(200).json([]);
      
      const roleIds = grants.map(g => g.grant_urole_id);

      const parent = await db("menu as a")
        .distinct("a.parent", "icon", "id", "link", "name", "order_menu")
        .join(
          db("vw_user_access")
            .distinct("parent")
            .whereIn("access_role", roleIds)
            .whereNull('deleted_at')
            .as("b"),
          function () {
            this.on("a.id", "=", "b.parent");
          }
        )
        .whereNull('a.deleted_at')
        .orderBy("order_menu", "asc");

      for (const data of parent) {
        data.children = await db("vw_user_access")
          .distinct(
            "menu.parent",
            "icon",
            "id",
            "link",
            "name",
            "order_menu",
            db.raw("0 as prior")
          )
          .innerJoin("menu", "access_menuid", "id")
          .leftJoin("collection_det", "coldet_menu", "menu.id")
          .whereNull("coldet_menu")
          .whereNull("collection_det.deleted_at")
          .whereNull("menu.deleted_at")
          .where("menu.parent", data.id)
          .whereIn("access_role", roleIds)
          .whereNull('vw_user_access.deleted_at')
          .unionAll(function () {
            this.distinct(
              db.raw(`a.col_parent as parent,a.col_icon as icon,
        a.colid as id,a.col_link as link,
        a.col_name as name, a.col_order as order_menu,1 as prior`)
            )
              .from("collection_menu as a")
              .innerJoin("collection_det as b", "b.coldet_colid", "a.colid")
              .innerJoin("user_access as c", "c.access_menuid", "b.coldet_menu")
              .where("col_parent", data.id)
              .whereNull("a.deleted_at")
              .whereIn("c.access_role", roleIds);
          })
          .as("a")
          .orderBy("prior", "asc")
          .orderBy("order_menu", "asc");
      }
      res.status(200).json({data: parent});
    } catch (error) {
      console.log(error);
      logger(error, 'GET /listUserMenuByRole', req.query);
      return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
    }
  };

  export const listUserSite = async (req, res) => {
    // #swagger.tags = ['PSAK General']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi menampilkan list site untuk selection'
    try {
      const domain = req.query.domain;
      const empid = await decrypt(req.query.empid);
      const response = await db("user_site")
        .select("usite_site as value",db.raw("site_code + ' - '+ site_desc as description"),"usite_default as default")
        .innerJoin('mst_site', function() {
            this.on('usite_domain', '=', 'site_domain');
            this.on('usite_site', '=', 'site_code');
          })
        .where("usite_domain", domain)
        .where("usite_userid",empid)
        .orderBy("usite_default","desc")
        .orderBy("usite_site","asc");
      res.status(200).json(response);
    } catch (error) {
      logger(error, 'GET /listUserSite', req.query);
      return res.status(406).json({
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
  
  }

  export const listDomain = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi menampilkan list domain untuk selection'
    try {
      const response = await db("mst_domain").select("domain_code as value",db.raw("domain_code + ' - '+ domain_shortname as description")).where("domain_status","active").whereNull('deleted_at').orderBy("domain_code");
      if(req.query.param == null) return res.status(200).json(response);
      
      const userDomains = new Set((await db("user_domain").select("usd_domain").where("usd_empid",await decrypt(req.query.empid)).whereNull('deleted_at')).map(d => d.usd_domain));
      res.status(200).json(response.map(el => ({name:el.value,label:el.description,selected:userDomains.has(el.value)})));
    } catch (error) {
      return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
    }
  }

  export const saveUser = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Update user pada aplikasi'
    const trx = await db.transaction();
    try { 
      const {empid,nik,creator,email,domain,grade,jabatan,nama,site,dept_id,dept,div_id,div,dir_id,dir}=req.body
      if (!empid) {
        await trx.rollback();
        return res.status(406).json({type:'error',message:`User ${nik} gagal disimpan`});
      }
      
      const empid_decrypt = await decrypt(empid)
      const creator_decrypt = await decrypt(creator)
      const now = dayjs().format("YYYY-MM-DD HH:mm:ss")
      let action=null,dataString=null;
      if (await trx("users").where("user_id", empid_decrypt).first()) {
        await trx("users").where("user_id", empid_decrypt).update({user_nik:nik,user_email:email,user_domain:domain,user_site:site,user_dept_id:dept_id,user_dept_name:dept,user_div_id:div_id,user_div_name:div,user_dir_id:dir_id,user_dir_name:dir,user_grade:grade,user_active:'Active',user_jabatan:jabatan,user_name:nama,updated_at:now,deleted_at:null,deleted_by:null});
        dataString=objectToString({user_nik:nik,user_email:email,user_domain:domain,user_site:site,user_dept_id:dept_id,user_dept_name:dept,user_div_id:div_id,user_div_name:div,user_dir_id:dir_id,user_dir_name:dir,user_grade:grade,user_active:'Active',user_jabatan:jabatan,user_name:nama,updated_at:now,deleted_at:null,deleted_by:null});
        action = 'update';
      } else {
        await trx("users").insert({user_id:empid_decrypt,user_nik:nik,user_email:email,user_domain:domain,user_site:site,user_dept_id:dept_id,user_dept_name:dept,user_div_id:div_id,user_div_name:div,user_dir_id:dir_id,user_dir_name:dir,user_grade:grade,user_active:'Active',user_jabatan:jabatan,user_name:nama,created_by:creator_decrypt,created_at:now,updated_by:creator_decrypt,updated_at:now});
        dataString=objectToString({user_id:empid_decrypt,user_nik:nik,user_email:email,user_domain:domain,user_site:site,user_dept_id:dept_id,user_dept_name:dept,user_div_id:div_id,user_div_name:div,user_dir_id:dir_id,user_dir_name:dir,user_grade:grade,user_active:'Active',user_jabatan:jabatan,user_name:nama,created_by:creator_decrypt,created_at:now,updated_by:creator_decrypt,updated_at:now});
        action = 'insert';
      }

      if (await trx("user_domain").where({usd_empid:empid_decrypt,usd_domain:domain}).first()) {
        await trx('user_domain').where({usd_empid:empid_decrypt,usd_domain:domain}).update({updated_by:creator_decrypt,updated_at:now,deleted_by:null,deleted_at:null});
      } else {
        await trx('user_domain').insert({usd_empid:empid_decrypt,usd_domain:domain,created_by:creator_decrypt,created_at:now,updated_by:creator_decrypt,updated_at:now});
      }

      await trx("user_site").where("usite_userid", empid_decrypt).update({usite_default:0,updated_by:creator_decrypt,updated_at:now});

      if (await trx('user_site').where({usite_userid:empid_decrypt,usite_site:site,usite_domain:domain}).first()) {
        await trx('user_site').where({usite_userid:empid_decrypt,usite_site:site,usite_domain:domain}).update({usite_default:1,updated_by:creator_decrypt,updated_at:now,deleted_at:null,deleted_by:null});
      } else {
        await trx('user_site').insert({usite_userid:empid_decrypt,usite_site:site,usite_domain:domain,usite_default:1,created_by:creator_decrypt,created_at:now,updated_by:creator_decrypt,updated_at:now});
      }
      await trx.commit();
      return res.json("sukses");
    } catch (error) {
      await trx.rollback();
      return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
    }
  };

  export const deleteUser = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi untuk menghapus user'
    try {
      const now = dayjs().format("YYYY-MM-DD HH:mm:ss")
      await db("users").where('user_id',await decrypt(req.body.empid)).update({user_active:0,updated_at:now,updated_by:await decrypt(req.body.creator),deleted_at:now,deleted_by:await decrypt(req.body.creator)});
      return res.json("success");
    } catch (error) {
      return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
    }
  };

  export const saveAksesDomain = async (req, res) => {
     // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi untuk menyimpan menu akses domain'
    try {
        const empid = await decrypt(req.body.empid);
        const creator = await decrypt(req.body.creator);
        const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

        await db("user_domain").where("usd_empid",empid).where("usd_domain",'<>',req.body.origin).update({deleted_at:now,deleted_by:creator});
        
        if (req.body.domain.length > 0){
          await Promise.all(req.body.domain.map(async (item) => {
            if (await db('user_domain').where({usd_domain:item,usd_empid:empid}).first()) {
              return db('user_domain').where({usd_domain:item,usd_empid:empid}).update({updated_at:now,updated_by:creator,deleted_at:null,deleted_by:null});
            } else {
              return db('user_domain').insert({usd_domain:item,usd_empid:empid,created_by:creator,created_at:now,updated_at:now,updated_by:creator});
            }
          }));
        }
        return res.json("sukses");
    } catch (error) {
      return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
    }
  };

  export const getHrisByNIK = async (req, res) => {
    // #swagger.tags = ['User']
    /* #swagger.security = [{
            "bearerAuth": []
          }] */
    // #swagger.description = 'Fungsi mendapatkan data user pada hris'
    try {
      const { nik,empid:encryptedEmpid } = req.query;
      const id = encryptedEmpid ? await decrypt(encryptedEmpid) : null;
      
      let hrisQuery = dbHris("portal.dbo.ptl_hris")
        .select("Emp_Id","user_email","user_newid","grade","user_name","map_div_pk","map_dept_pk")
        .where('user_active','Active');
      
      if (nik) {
        hrisQuery = hrisQuery.where('user_newid', nik);
      } else {
        hrisQuery = hrisQuery.where('Emp_Id', id);
      }
      
      const hris = await hrisQuery.first();

      if (!hris){
        return res.status(406).json({
          type:'error',
          message: `User ${nik || id} sudah tidak ditemukan/tidak aktif`,
        });
      }else{
        
        let users = await db("users")
        .select("user_id","user_nik","user_name","user_domain","user_site")
        .where ('user_id',hris.Emp_Id)
        .whereNull('deleted_at')
        .first();
        //return res.status(200).json(users);
         if (users&&nik){
         return res.status(406).json({
           type:'error',
           message: `User ${nik || id} sudah ada pada aplikasi ini`,
         });
        }else{
          let [jobHris, direktorat] = await Promise.all([
               dbHris("portal.dbo.ptl_hris as a")
              .select("a.Emp_Id","a.jabatan","a.map_dept_pk","a.map_div_pk","b.nama_div","b.nama_dept")
              .leftJoin('vw_div_dept as b', function() {
                  this.on('b.map_div_pk', '=', 'a.map_div_pk')
                  .on('b.map_dept_pk', '=', 'a.map_dept_pk')
              })
              .where ('Emp_Id',hris.Emp_Id)
              .first(),
              dbHris("portal.dbo.master_dept_dir")
              .select("id_dir","nama_dir","nama_div")
              .where ('id_div',hris.map_div_pk)
              .first(),
              ]);
          
          if (parseInt(hris.grade)>6){
            const direktoratID = await dbHris("mapping_div_chief").where('map_cic_pk',hris.Emp_Id)
            .orWhere('map_dic_pk',hris.Emp_Id)
            .first();
            direktorat = await dbHris("master_dir")
            .where ('direktorat_pk', direktoratID.map_dir_pk)
            .first();
          }

          let empid = await encrypt(hris.Emp_Id)
          res.status(200).json({
            'type':'success',
            'empid':empid,
            'name':hris.user_name,
            'email':hris.user_email,
            'dept_id':hris.map_dept_pk,
            'dept_name':jobHris?jobHris.nama_dept:null,
            'div_id':hris.map_div_pk,
            'div_name':parseInt(hris.grade)>6?null:direktorat.nama_div,
            'dir_id':parseInt(hris.grade)>6?direktorat.direktorat_pk:direktorat.id_dir,
            'dir_name':parseInt(hris.grade)>6?direktorat.direktorat_name:direktorat.nama_dir,
            'grade':hris.grade,
            'nik':hris.user_newid,
            'jabatan':jobHris?jobHris.jabatan:''
          });  
        }
      }
    } catch (error) {
      return res.status(406).json(/* { message: error.message } */
        {
          type:'error',
          message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
      });
    }
  };