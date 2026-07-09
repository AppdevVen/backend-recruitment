import dotenv from "dotenv";  
dotenv.config();  
import jwt from "jsonwebtoken";  
import { dbHris,db } from "../config/db.js";  

// Cache for throw_mstr data to avoid repeated DB queries
const throwCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getThrowConfig = async (method, path) => {
  const key = `${method}:${path}`;
  const cached = throwCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }
  
  const result = await db("throw_mstr")
    .where("throw_method", method)
    .where("throw_path", path)
    .select("throw_method")
    .first();
    console.log(result)
  const value = !!result;
  throwCache.set(key, { value, timestamp: Date.now() });
  return value;
};

  
export const cekToken = async (req, res, next) => {  
  try {  
    const isPublicRoute = await getThrowConfig(req.method, req.path);
    
    if (isPublicRoute) {  
      return next();  
    } else {  
      let token;  

      if (req.headers['accept'] === 'text/event-stream') {   
        token = req.query.token;
      } else {  
        token = req.headers.authorization.split(' ')[1];  
      }  
  
      if (token) {  
        const decoded = jwt.verify(token, process.env.TOKEN);  
        const response = await dbHris("ptl_hris")  
          .where("Emp_Id", decoded.user)  
          .where("user_active", "Active")  
          .first();
      
      if (response) {  
          return next();  
        } else {  
          return res.status(401).json({ message: "Token sudah tidak sesuai atau expired", decoded });  
        }  
      } else {  
        return res.status(401).json({ message: "Invalid Token" });  
      }  
    }  
  } catch (error) {  
    console.error("Error in cekToken middleware:", error); // Log the error  
    return res.status(402).json({ message: "Token sudah tidak sesuai atau expired" });  
  }  
};  
 
