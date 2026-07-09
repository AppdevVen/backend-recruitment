import express from "express";
import multer from "multer";
import master from "./master.js"
import logRouter from './logs.js';
import recruitmentRouter from './recruitment.js';
//end class definition

//route definition
const router = express.Router();

const maxSizeImage = 1 * 1024 * 1024 ;
const maxSizeDocument = 2 * 1024 * 1024 ;
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "file");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    if (file) {
      let ext = file.originalname.split(".");
      cb(null, uniqueSuffix + "." + ext[ext.length - 1]);
    } else {
      let ext = file.originalname.split(".");
      cb(null, null);
    }
  },
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "fimage") { // if uploading fimage
    if (
      file.mimetype === 'image/png' ||
      file.mimetype === 'image/jpg' ||
      file.mimetype === 'image/jpeg'
    ) { // check file type to be png, jpeg, or jpg
        cb(null, true);
    }
  } else { // else uploading fdokumen
      cb(null, true);
  }
}

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit 
});

//router.post("/login",function (req, res) {
  //return req;
 // res.json({  message: req.body });
  //res.json({ req/* message: req.nik */ });
//});
router.use('/',master)
router.use('/logs',logRouter)
router.use('/recruitment',recruitmentRouter)

export default router;

//end route defition
