import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import router from "./router/index.js";
import swaggerUi from "swagger-ui-express";
import * as dotenv from 'dotenv'; 
dotenv.config()
import { cekToken } from "./middleware/verifyToken.js";
import sqlSanitizeMiddleware from "./middleware/sanitizeRequest.js"; 
import { executeCron } from "./middleware/scheduler.js";
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT;
const fe = process.env.FE_PORT;

/* app.use((req, res, next) => {
  const referringDomain = req.get('Referer');
  // Check if the referring domain is a specific domain
  if (referringDomain && referringDomain.includes('dbc.co.id')) {
    res.setHeader('Referer-Policy', 'strict-origin');
  } else {
    res.setHeader('Referer-Policy', 'same-origin');
  }
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,POST,HEAD, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Auth-Token');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  next();
}); */

app.disable("x-powered-by");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'file')));

app.use(
  cors({
    origin:[
      `http://localhost:${port}`,
      `http://localhost:${fe}`,
      `https://portalfa.galihrakagustiawan.site`,
      `${process.env.FRONTEND}`,
      `${process.env.FRONTEND}api`,
      `${process.env.API}`,
      `${process.env.API}appdev`,
      `${process.env.API}appdev/app-nesting`,
    ],
    //methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    //credentials: true,
  })
);

executeCron();

//app.options('*', cors());
import swaggerDocument from "./swagger-output.json" assert { type: "json" };
import { checkPeriodStatus } from "./controllers/recruitment/periodeController.js";
import { getPriority } from "./controllers/recruitment/priorityController.js";
import { registerCandidate } from "./controllers/recruitment/candidateController.js";
import multer from "multer";
const cvStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "file");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = file.originalname.split(".").pop();
    cb(null, uniqueSuffix + "." + ext);
  },
});
const uploadCV = multer({
  storage: cvStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Hanya file PDF, DOC, DOCX yang diizinkan'));
    }
  }
});

app.use(sqlSanitizeMiddleware);
app.use("/doc", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/recruitment/periods/status", checkPeriodStatus);
app.post("/recruitment/candidates", uploadCV.single("file_cv"), registerCandidate);
app.get("/recruitment/priorities/:id", getPriority);
// app.use(cekToken);
app.use("/", router);

app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});


