import { db} from "../../config/db.js";
import { checkRoleDependencies, convertAccessPermissions, createLogEntry, 
  encryptAccessPermissions, encryptMenuIds, encryptRoleIds, 
  hasAnyPermission, processLocationData, processSiteItem } from "../../helpers/master/domain.js";
import { decrypt,encrypt, getErrorResponse, getWSA, insertInChunks, objectToString } from "../../helpers/utils.js";
import { logger } from "../../helpers/logger.js";
import dayjs from "dayjs";
import * as dotenv from 'dotenv' ;
dotenv.config();


  export const listDomainMaster = async (req, res) => {
    // #swagger.tags = ['Domain']
    /* #swagger.security = [{
                "bearerAuth": []
        }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data domain'
    try {
      const { rowsPerPage, descending, sortBy, page, filter } = req.query;

      const baseQuery = db("mst_domain").whereNull('deleted_at');
      if (!rowsPerPage) {
        const response = await baseQuery
        .select('domain_code', 'domain_shortname', 'domain_longname', 'domain_entity')
        .orderBy("domain_code");
        return res.status(200).json(response);
      }

      const sorting = descending === 'true' ? 'desc' : 'asc';
      const columnSort = sortBy === 'desc' ? 'domain_code asc' : `${sortBy} ${sorting}`;
      const currentPage = Math.floor(page);
      const perPage = Math.floor(rowsPerPage);

      let query = baseQuery
      .select(
        "mst_domain.domain_code", "mst_domain.domain_shortname", "mst_domain.domain_longname", "mst_domain.domain_entity",
        "mst_domain.domain_status", "mst_domain.updated_at",
        db.raw('(select user_name from users where user_id = mst_domain.updated_by) as modifier')
      )
      .where("mst_domain.domain_status", 'active');
      
      // Apply filter if provided
      if (filter) {
        query = query.where((subQuery) => {
          subQuery
            .orWhere('domain_code', 'like', `%${filter}%`)
            .orWhere('domain_shortname', 'like', `%${filter}%`)
            .orWhere('domain_longname', 'like', `%${filter}%`)
            .orWhere('domain_entity', 'like', `%${filter}%`);
        });
      }
      
      const response = await query
        .orderByRaw(columnSort)
        .paginate({
          perPage,
          currentPage,
          isLengthAware: true,
        });
      
      res.status(200).json(response);
     
    } catch (error) {
      logger(error, 'GET /listDomainMaster', req.query);
      return res.status(406).json(getErrorResponse(error))
    }
  };

  export const saveDomain = async (req, res) => {
    // #swagger.tags = ['Domain']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    // #swagger.description = 'Fungsi untuk simpan data domain'
    const trx = await db.transaction();
    try {
      const { fldcode, fldinitial, fldname, fldentity, creator: encryptedCreator } = req.body;
      const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const creator = await decrypt(encryptedCreator);

      const existingDomain = await trx("mst_domain")
      .where("domain_code", fldcode)
      .first();

      const domainData = {
        domain_shortname: fldinitial,
        domain_longname: fldname,
        domain_entity: fldentity,
        domain_status: 'active',
        updated_by: creator,
        updated_at: now,
      };
      let action=null,dataString=null;

      if (existingDomain) {
        await trx("mst_domain")
        .update({...domainData,deleted_by: null,deleted_at: null,})
        .where("domain_code", fldcode);
        dataString=objectToString({...domainData,deleted_by: null,deleted_at: null});
        action = 'update';
      }else{
        await trx("mst_domain").insert({domain_code: fldcode,...domainData,created_by: creator,created_at: now,});
        dataString=objectToString({domain_code: fldcode,...domainData,created_by: creator,created_at: now,});
        action = 'insert';
      }
      await trx.commit();
      return res.json("sukses");
    } catch (error) {
      await trx.rollback();
      logger(error, 'POST /saveDomain', req.body);
      return res.status(406).json(getErrorResponse(error))
    }
  };

  export const deleteDomain = async (req, res) => {
    // #swagger.tags = ['Domain']
   /* #swagger.security = [{
           "bearerAuth": []
   }] */
   // #swagger.description = 'Fungsi untuk hapus data domain'
   try {
    const { code, creator: encryptedCreator } = req.body;
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const creator = await decrypt(encryptedCreator);
    
    await db("mst_domain").where("domain_code", code).update({
      domain_status: 'inactive',
      updated_by: creator,
      updated_at: now,
      deleted_by: creator,
      deleted_at: now,
    });
    return res.json("success");
   } catch (error) {
     logger(error, 'DELETE /deleteDomain', req.body);
     return res.status(406).json(getErrorResponse(error))
   }
 };

 export const listSiteMaster = async (req, res) => {
    // #swagger.tags = ['Domain']
    /* #swagger.security = [{
            "bearerAuth": []
    }] */
    // #swagger.description = 'Fungsi untuk menampilkan list data site'
    try {
      const { rowsPerPage, descending, sortBy, page, filter, domain } = req.query;
    
      // Base query builder
      const baseQuery = db("mst_site")
        .where("site_domain", domain)
        .whereNull('deleted_at');
      
      // Simple list without pagination
      if (!rowsPerPage) {
        const response = await baseQuery.orderBy("site_code");
        return res.status(200).json(response);
      }
      
      // Paginated list with optimizations
      const sorting = descending === 'true' ? 'desc' : 'asc';
      const columnSort = sortBy === 'desc' ? 'site_code asc' : `${sortBy} ${sorting}`;
      const currentPage = Math.floor(page);
      const perPage = Math.floor(rowsPerPage);
      
      let query = baseQuery;
      
      // Apply filter if provided
      if (filter) {
        query = query.where((subQuery) => {
          subQuery
            .orWhere('site_code', 'like', `%${filter}%`)
            .orWhere('site_desc', 'like', `%${filter}%`);
        });
      }

      const response = await query
        .orderByRaw(columnSort)
        .paginate({
          perPage,
          currentPage,
          isLengthAware: true,
        });
      res.json(response);
    } catch (error) {
      logger(error, 'GET /listSiteMaster', req.query);
      return res.status(406).json(getErrorResponse(error))
    }
  };

  export const syncSite = async (req, res) => {
    // #swagger.tags = ['Domain']
   /* #swagger.security = [{
           "bearerAuth": []
   }] */
   // #swagger.description = 'Fungsi untuk sync data site dari QAD'
  const { domain, creator: encryptedCreator } = req.body;
  const today = dayjs().format("YYYY-MM-DD HH:mm:ss");
  const creator = encryptedCreator ? await decrypt(encryptedCreator) : null;
   try {
    const domainInfo = await db("mst_domain")
      .where("domain_code", domain)
      .first();
     const args = { parDomain: domainInfo.domain_code,
                    parEntity: domainInfo.domain_entity,
                    parDBLogical:'qaddb'
                   };
       let callWsa;
       callWsa = await getWSA(process.env.WSA, "getDBCsite", args);
       if (!callWsa.tt_site){
        throw {
          message: `Data tidak ada`,
        };
      }
       let siteData = callWsa.tt_site.tt_siteRow;
       await db('mst_site')
        .where('site_domain',domain)
        .update({
          deleted_by:'system',
          deleted_at:today,
        })
       if(siteData){
          const existingSites = await db('mst_site')
          .where('site_domain', domain)
          .select('site_code');
          const existingSiteCodes = new Set(existingSites.map(s => s.site_code));  
          const updatePromises = [];
          const insertData = [];
          siteData.forEach(item => {
            const siteInfo = processSiteItem(item, domain, creator, today);
            
            if (existingSiteCodes.has(item.kd_site)) {
              // Update existing
              updatePromises.push(
                db('mst_site')
                  .where('site_domain', domain)
                  .where('site_code', item.kd_site)
                  .update(siteInfo)
              );
            } else {
              // Insert new
              insertData.push({
                ...siteInfo,
                site_code: item.kd_site,
                created_by: creator || 'system',
                created_at: today,
              });
            }
          });
          
          // Execute batch operations
          await Promise.all([
            ...updatePromises,
            ...(insertData.length > 0 ? [db('mst_site').insert(insertData)] : [])
          ]);
        }

         await db('log_sync').insert(createLogEntry(domain,'SITE','QAD','site_mstr'
          ,creator,'sukses',today));
        return res.json("sukses"); 
   } catch (error) {
    await db('log_sync').insert(createLogEntry(domain,'SITE','QAD','site_mstr'
          ,creator,'error',today))
    return res.status(406).json(getErrorResponse(error))
   }
 };

 export const saveSite = async (req, res) => {
    // #swagger.tags = ['Domain']
   /* #swagger.security = [{
           "bearerAuth": []
         }] */
   // #swagger.description = 'Fungsi untuk menyimpan menu akses site per domain per user'
   const trx = await db.transaction();
   try {
      const { domain, site, empid: encryptedEmpid, creator: encryptedCreator } = req.body;
      const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
      const empid = await decrypt(encryptedEmpid);
      const creator = await decrypt(encryptedCreator);
         
       // Mark existing non-default sites as deleted
      await trx("user_site")
        .where("usite_domain", domain)
        .where("usite_userid", empid)
        .where('usite_default', '<>', 1)
        .update({
          deleted_at: now,
          deleted_by: creator
      });
      
      if (site && site.length > 0) {
         // Get existing sites for batch processing
        const existingSites = await trx('user_site')
            .where('usite_domain', domain)
            .where("usite_userid", empid)
            .whereIn('usite_site', site)
            .select('usite_site');

        const existingSiteCodes = new Set(existingSites.map(s => s.usite_site));
        const updatePromises = [];
        const insertData = [];
        site.forEach(siteCode => {
          const siteData = {
            usite_default: 0,
            updated_at: now,
            updated_by: creator,
            deleted_at: null,
            deleted_by: null,
          };
          
          if (existingSiteCodes.has(siteCode)) {
            // Update existing
            updatePromises.push(
              trx('user_site')
                .where('usite_domain', domain)
                .where("usite_userid", empid)
                .where('usite_site', siteCode)
                .update(siteData)
            );
          } else {
            // Insert new
            insertData.push({
              usite_domain: domain,
              usite_userid: empid,
              usite_site: siteCode,
              ...siteData,
              created_by: creator,
              created_at: now,
            });
          }
        });

        await Promise.all([
          ...updatePromises,
          ...(insertData.length > 0 ? [trx('user_site').insert(insertData)] : [])
        ]); 
      }
      await trx.commit();
      return res.json("sukses");
   } catch (error) {
    await trx.rollback();
    return res.status(406).json(getErrorResponse(error))
   }
 };
 
 export const listMasterRole = async (req, res) => {
  // #swagger.tags = ['Domain']
  // #swagger.description = 'Menampilkan Data Role'
  try {
    const { page, code, needle, descending, sortBy, filter, rowsPerPage } = req.query;
    // Base query builder
    const baseQuery = db("user_role").whereNull('deleted_at');
    if (!page) {
      const decryptedCode = code ? await decrypt(code) : null;
      
      let query = baseQuery.select('urole_id', 'urole_desc');
      
      if (decryptedCode) {
        query = query.where('urole_id', decryptedCode);
      }
      
      if (needle) {
        query = query.where('urole_desc', 'like', `%${needle}%`);
      }
      
      const response = await query.orderBy("urole_desc").limit(10);
      await encryptRoleIds(response);
      
      return res.status(200).json(response);
    }

    // Paginated list with optimizations
    const sorting = descending === 'true' ? 'desc' : 'asc';
    const columnSort = sortBy === 'asc' ? 'urole_desc asc' : `${sortBy} ${sorting}`;
    const currentPage = Math.floor(page);
    const perPage = Math.floor(rowsPerPage);
    
    let query = baseQuery.select(
      "urole_id", "urole_desc", "urole_longdesc", "updated_at",
      db.raw('(select user_name from users a where a.user_id = user_role.updated_by) as modifier')
    );
    
    // Apply filter if provided
    if (filter) {
      query = query.where((subQuery) => {
        subQuery
          .orWhere('urole_desc', 'like', `%${filter}%`)
          .orWhere('urole_longdesc', 'like', `%${filter}%`);
      });
    }
    
    const response = await query
      .orderByRaw(columnSort)
      .paginate({
        perPage,
        currentPage,
        isLengthAware: true,
      });
    
    await encryptRoleIds(response.data);
    res.status(200).json(response);
  } catch (error) {
    return res.status(406).json(getErrorResponse(error))
  }
}

export const saveRole = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  // #swagger.description = 'Fungsi untuk simpan data role'
  const trx = await db.transaction();
  try {
    const { name, longname, id: encryptedId, creator: encryptedCreator } = req.body;
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const id = encryptedId ? await decrypt(encryptedId) : '0';
    const creator = await decrypt(encryptedCreator);
    
    const roleData = {
      urole_desc: name,
      urole_longdesc: longname,
      updated_by: creator,
      updated_at: now,
    };
    // Check if role name already exists
    const existingRole = await trx("user_role")
      .where("urole_desc", name)
      .where('urole_id', '<>', id)
      .first();
    
    if (existingRole) {
      if (existingRole.deleted_at === null) {
        await trx.rollback();
        return res.status(406).json({
          type: 'error',
          message: `Nama role sudah ada, silahkan Coba Lagi`,
        });
      }

      // Restore deleted role
      await trx("user_role")
        .where("urole_desc", name)
        .update({
          ...roleData,
          deleted_by: null,
          deleted_at: null,
        });
    } else if (id === '0') {
      // Insert new role
      await trx("user_role").insert({
        ...roleData,
        created_by: creator,
        created_at: now,
      });
    } else {
      // Update existing role
      await trx("user_role")
        .where("urole_id", id)
        .update(roleData);
    }
    await trx.commit();
    return res.json("sukses");
  } catch (error) {
    await trx.rollback();
    logger(error, 'POST /saveRole', req.body);
    return res.status(406).json(getErrorResponse(error))
  }
};

export const deleteRole = async (req, res) => {
  // #swagger.tags = ['Domain']
 /* #swagger.security = [{
         "bearerAuth": []
 }] */
 // #swagger.description = 'Fungsi untuk hapus data role'
 try {
  const { id: encryptedId, creator: encryptedCreator } = req.body;
  const id = encryptedId ? await decrypt(encryptedId) : 0;
  const creator = await decrypt(encryptedCreator);

  const dependencyCheck = await checkRoleDependencies(id);
    
  if (!dependencyCheck.canDelete) {
    return res.status(406).json({
      type: 'error',
      message: dependencyCheck.message,
    });
  }
  
  // Delete the role
  await db("user_role")
    .where("urole_id", id)
    .update({
      deleted_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      deleted_by: creator,
    });

   return res.json("success");
 } catch (error) {
   return res.status(406).json(getErrorResponse(error))
 }
};

export const listRoleAkses = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan role akses'
  try {
    const { rowsPerPage, descending, sortBy, page, filter, parent } = req.query;
    // Simple list without pagination (currently empty - implement if needed)
    if (!rowsPerPage) {
      return res.status(200).json([]);
    }
    // Paginated list with optimizations
    const sorting = descending === 'true' ? 'desc' : 'asc';
    const columnSort = sortBy === 'asc' ? 'menu asc' : `${sortBy} ${sorting}`;
    const currentPage = Math.floor(page);
    const perPage = Math.floor(rowsPerPage);
    const decryptedParent = await decrypt(parent);
    console.log(decryptedParent)
    let query = db("vw_user_role")
      .select("menu", "name",'icon','icon_parent', "access_view", "access_add", "access_edit", "access_delete", "link",'parent_name')
      .where('urole_id', decryptedParent);
    
    // Apply filter if provided
    if (filter) {
      query = query.where((subQuery) => {
        subQuery.orWhere('name', 'like', `%${filter}%`)
        .orWhere('parent_name', 'like', `%${filter}%`)
        .orWhere('link', 'like', `%${filter}%`);
      });
    }
    
    const response = await query
      .orderByRaw(columnSort)
      .paginate({
        perPage,
        currentPage,
        isLengthAware: true,
      });

    await encryptMenuIds(response.data);
    
    res.status(200).json(response);
   
  } catch (error) {
    console.log(error);
    return res.status(406).json(/* { message: error.message } */
      {
        type:'error',
        message: process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`,
    });
  }
};

export const saveRoleAkses = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  // #swagger.description = 'Fungsi untuk simpan data submenu'
  let trx;
  try {
    const { menu: encryptedMenu, role: encryptedRole, creator: encryptedCreator, view, add, edit, delete: deleteAccess } = req.body;
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const [menu, role, creator] = await Promise.all([
      decrypt(encryptedMenu),
      decrypt(encryptedRole),
      decrypt(encryptedCreator)
    ]);

    trx = await db.transaction();
    console.log(menu,role,creator)
    // Get menu info and existing access in parallel
    const [menuInfo, existingAccess] = await Promise.all([
      trx('menu').where('id', menu).first(),
      trx("user_access").where("access_menuid", menu).where('access_role', role).first()
    ]);

    const permissions = convertAccessPermissions({ view, add, edit, delete: deleteAccess });
    
    const accessData = {
      access_menuid: menu,
      access_role: role,
      access_menu: menuInfo.link,
      ...permissions,
      updated_at: now,
      updated_by: creator,
    };
    if (!existingAccess) {
      // Insert new access
      await trx("user_access").insert({
        ...accessData,
        created_by: creator,
        created_at: now,
      });
    } else {
      // Update existing access
      await trx("user_access")
        .where("access_menuid", menu)
        .where('access_role', role)
        .update({
          ...accessData,
          deleted_at: null,
          deleted_by: null,
        });
    }

    // Check if access should be soft deleted (no permissions enabled)
    if (!hasAnyPermission(permissions)) {
      await trx("user_access")
        .where("access_menuid", menu)
        .where('access_role', role)
        .update({
          deleted_at: now,
          deleted_by: creator,
        });
    }
    await trx.commit();
    return res.json("sukses");
  } catch (error) {
    if (trx) await trx.rollback();
    console.log(error, 'got error saveRoleAkses');
    return res.status(406).json(getErrorResponse(error));
  }
};

export const listUserRoleAkses = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
              "bearerAuth": []
      }] */
  // #swagger.description = 'Fungsi untuk menampilkan user role akses'
  try {
    const { rowsPerPage, descending, sortBy, page, filter, empid } = req.query;
    if (!rowsPerPage) return res.status(200).json([]);
    
    const sorting = descending === 'true' ? 'desc' : 'asc';
    const columnSort = sortBy === 'asc' ? 'urole_desc asc' : `${sortBy} ${sorting}`;
    const currentPage = Math.floor(page);
    const perPage = Math.floor(rowsPerPage);
    const decryptedEmpid = await decrypt(empid);
    
    let query = db("user_role")
      .select("urole_id", "urole_desc", 
        db.raw(`(SELECT grant_user_id FROM user_grant_role WHERE grant_user_id = ? AND grant_urole_id = user_role.urole_id and deleted_at is null) as grant_user_id`, [decryptedEmpid]))
      .whereNull('deleted_at');
    
    if (filter) {
      query = query.where('urole_desc', 'like', `%${filter}%`);
    }
    
    const response = await query
      .orderByRaw(columnSort)
      .paginate({perPage,currentPage,isLengthAware: true});

    await encryptRoleIds(response.data);
    res.status(200).json(response);
  } catch (error) {
    return res.status(406).json({type:'error',message:process.env.DEBUG == 1 ?error.message:`Aplikasi sedang mengalami gangguan, silahkan hubungi tim IT`});
  }
};

export const getRoleAksesByPage = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  // #swagger.description = 'Fungsi untuk simpan data submenu'
  try {
  const { role: encryptedRole, page } = req.query;
  const role = await decrypt(encryptedRole);
  const grants = await db('user_grant_role').select('grant_urole_id').where('grant_user_id',role).whereNull('deleted_at');
  
  if(grants.length === 0) {
    return res.status(404).json({
      type: 'error',
      message: 'Access data not found'
    });
  };

  const roleIds = grants.map(g => g.grant_urole_id);

  const response = await db('user_access')
    .whereIn("access_role", roleIds)
    .where('access_menu', page)
    .first();

  if (!response) {
    return res.status(404).json({
      type: 'error',
      message: 'Access data not found hoi'
    });
  }
  const data = await encryptAccessPermissions(response);
  res.status(200).json(data);
  } catch (error) {
    console.log(error);
   return res.status(406).json(getErrorResponse(error));
  }
};

export const saveUserRoleAkses = async (req, res) => {
  // #swagger.tags = ['Domain']
  /* #swagger.security = [{
          "bearerAuth": []
  }] */
  // #swagger.description = 'Fungsi untuk simpan data grant user role'
  const trx = await db.transaction();
  try {
    const { role: encryptedRole, creator: encryptedCreator, empid:encryptedEmpid, granted } = req.body;
    const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const [role, creator, empid] = await Promise.all([decrypt(encryptedRole), decrypt(encryptedCreator), decrypt(encryptedEmpid)]);

    const existingGrant = await trx("user_grant_role").where({grant_user_id:empid,grant_urole_id:role}).first();
    let action=null,dataString=null;
    if (granted) {
      if (existingGrant) {
        await trx("user_grant_role").where({grant_user_id:empid,grant_urole_id:role}).update({updated_at:now,updated_by:creator,deleted_at:null,deleted_by:null});
        dataString=objectToString({grant_user_id:empid,grant_urole_id:role})
        action = 'update';
      } else {
        await trx("user_grant_role").insert({grant_user_id:empid,grant_urole_id:role,created_by:creator,created_at:now,updated_by:creator,updated_at:now});
        dataString=objectToString({grant_user_id:empid,grant_urole_id:role,created_by:creator,created_at:now,updated_by:creator,updated_at:now});
        action = 'insert';
      }
    } else {
      if (existingGrant) {
        await trx("user_grant_role").where({grant_user_id:empid,grant_urole_id:role}).update({deleted_at:now,deleted_by:creator});
        dataString=objectToString({deleted_at:now,deleted_by:creator});
        action = 'update';
      }
    }
    await trx.commit();
    return res.json("sukses");
  } catch (error) {
    await trx.rollback();
    return res.status(406).json(getErrorResponse(error));
  }
};
