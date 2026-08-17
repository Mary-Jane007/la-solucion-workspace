const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { migrate } = require("./db");
const { z } = require("zod");
const {
  hasDb,
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  setUserActive,
  updateUserRole,
  getOwnerEmailFromEnv,
  resolveRegistrationRole,
  ensureOwnerAccount
} = require("./store");
const {
  listOpdrachtenForUser,
  listPrullenbakForUser,
  getOpdrachtById,
  getOpdrachtInPrullenbakById,
  createOpdracht,
  updateOpdracht,
  softDeleteOpdracht,
  restoreOpdracht,
  getExpiredOpdrachtIds,
  permanentDeleteOpdrachten,
  TRASH_RETENTION_DAYS
} = require("./opdrachtenStore");
const {
  listBestandenForOpdracht,
  listBestandenForOpdrachtIds,
  getBestandById,
  createBestand,
  deleteBestandenForOpdrachtIds
} = require("./bestandenStore");
const {
  listFinancielePosten,
  createFinancielePost,
  updateFinancielePost,
  deleteFinancielePost
} = require("./financieStore");
const {
  listInzendingen,
  countNieuweInzendingen,
  createInzending,
  updateInzendingStatus,
  getInzendingById,
  getInzendingBijlageById
} = require("./financieInzendingStore");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-niet-gebruiken-in-productie";
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || "https://your-app-url.example";
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
const NODE_ENV = process.env.NODE_ENV || "development";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://your-app-url.example";

const CORS_PLACEHOLDER = "https://your-app-url.example";
if (NODE_ENV === "production") {
  if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === "dev-fallback-niet-gebruiken-in-productie") {
    throw new Error("JWT_SECRET is niet ingesteld of te kort. Stel een sterk JWT_SECRET in (min. 32 tekens) voor productie.");
  }
  const hasProductionOrigin = CORS_ORIGINS.some((o) => o && o !== CORS_PLACEHOLDER);
  if (!hasProductionOrigin) {
    throw new Error("CORS_ORIGIN moet in productie op je echte app-URL staan (bijv. https://app.la-solucion.nl of je Vercel-URL).");
  }
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === "") {
    throw new Error("DATABASE_URL is verplicht in productie. Maak een PostgreSQL-database aan (Neon/Supabase/Railway) en zet de connection string.");
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const o = origin.replace(/\/$/, "");
      if (CORS_ORIGINS.some((allowedOrigin) => o === allowedOrigin)) return cb(null, true);
      if (NODE_ENV !== "production") {
        try {
          const host = new URL(o).hostname;
          if (host === "localhost" || host === "127.0.0.1") return cb(null, true);
        } catch {
          /* ignore */
        }
      }
      if (process.env.VERCEL) {
        try {
          const host = new URL(o).hostname;
          if (host === "vercel.app" || host.endsWith(".vercel.app")) return cb(null, true);
        } catch {
          /* ignore */
        }
      }
      return cb(null, false);
    },
    credentials: false
  })
);
app.use(helmet());
if (NODE_ENV === "production") {
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
}

// Vercel (@vercel/node): lazy req.body — express.json() mag de stream niet opnieuw lezen.
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    const ct = String(req.headers["content-type"] || "").toLowerCase();
    if (!ct.includes("application/json")) return next();
    const bodyDesc = Object.getOwnPropertyDescriptor(req, "body");
    const lazyBody =
      bodyDesc &&
      typeof bodyDesc.get === "function" &&
      typeof bodyDesc.set === "function" &&
      bodyDesc.configurable === true;
    if (lazyBody) {
      try {
        void req.body;
      } catch {
        return res.status(400).json({ error: "Ongeldige JSON." });
      }
      return next();
    }
    return express.json()(req, res, next);
  });
} else {
  app.use(express.json());
}

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext.slice(0, 10);
    cb(null, `${uuidv4()}${safeExt}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword"
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    return cb(new Error("Bestandstype niet toegestaan."));
  }
});

const INZENDING_IMG_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif"
]);
const INZENDING_IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"]);

const uploadInzendingImg = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 5
  },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || "").toLowerCase();
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (INZENDING_IMG_TYPES.has(mime) || mime.startsWith("image/") || INZENDING_IMG_EXTS.has(ext)) {
      return cb(null, true);
    }
    return cb(new Error("Alleen afbeeldingen zijn toegestaan (JPG, PNG, WEBP)."));
  }
});

function parseInzendingUpload(req, res, next) {
  const ct = String(req.headers["content-type"] || "").toLowerCase();
  if (!ct.includes("multipart/form-data")) return next();
  uploadInzendingImg.array("bestanden", 5)(req, res, (err) => {
    if (err) {
      const teGroot = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({
        error: teGroot
          ? "Afbeelding is te groot (max. 8 MB per foto)."
          : err.message || "Upload mislukt."
      });
    }
    next();
  });
}

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      rol: user.role
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Niet geautoriseerd: ontbrekende token." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      rol: payload.rol
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Niet geautoriseerd: ongeldige of verlopen token." });
  }
}

function canAccessOpdracht(user, opdracht) {
  if (user.rol === "EIGENAAR") return true;
  return Boolean(
    opdracht.behandelaarUserId &&
      String(opdracht.behandelaarUserId) === String(user.id)
  );
}

function parseZodError(err) {
  if (err?.issues) {
    return err.issues.map((i) => i.message).join(" ");
  }
  return "Ongeldige invoer.";
}

app.get("/api/auth/registration-info", async (req, res) => {
  try {
    const users = await getUsers();
    const email = String(req.query.email || "")
      .toLowerCase()
      .trim();
    const assignedRole = email ? resolveRegistrationRole(users, email) : null;
    return res.json({
      userCount: users.length,
      hasOwner: users.some((u) => u.role === "EIGENAAR"),
      willBeOwner: assignedRole === "EIGENAAR",
      assignedRole
    });
  } catch (err) {
    console.error("Fout bij registration-info:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Naam, e-mailadres en wachtwoord zijn verplicht." });
    }

    const trimmedEmail = String(email).toLowerCase().trim();
    const existing = await getUserByEmail(trimmedEmail);

    if (existing) {
      const ownerEmail = getOwnerEmailFromEnv();
      if (ownerEmail && trimmedEmail === ownerEmail && existing.role !== "EIGENAAR") {
        await updateUserRole(existing.id, "EIGENAAR");
        return res.status(200).json({
          role: "EIGENAAR",
          message:
            "Dit e-mailadres is al bekend en is nu ingesteld als eigenaar. Log in met je wachtwoord."
        });
      }
      return res.status(409).json({ error: "Er bestaat al een gebruiker met dit e-mailadres." });
    }

    const users = await getUsers();
    const assignedRole = resolveRegistrationRole(users, trimmedEmail);

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      email: trimmedEmail,
      passwordHash,
      role: assignedRole,
      active: true
    };

    await createUser(newUser);

    const ownerEmail = getOwnerEmailFromEnv();
    if (ownerEmail && assignedRole === "MEDEWERKER" && ownerEmail !== trimmedEmail) {
      const subject = `Nieuwe registratie La-Solución portaal - ${newUser.name}`;
      const text = [
        "Er is een nieuwe medewerker geregistreerd voor het La-Solución intern portaal.",
        "",
        `Naam: ${newUser.name}`,
        `E-mailadres: ${newUser.email}`,
        `Rol: ${assignedRole}`
      ].join("\n");
      try {
        await sendMail({ to: ownerEmail, subject, text });
      } catch (mailErr) {
        console.error("Fout bij verzenden e-mail naar eigenaar na registratie:", mailErr);
      }
    }

    return res.status(201).json({
      role: assignedRole,
      message:
        assignedRole === "EIGENAAR"
          ? "Account geregistreerd als eigenaar. Je gegevens worden opgeslagen; je kunt nu inloggen."
          : "Account geregistreerd als medewerker. Je kunt inloggen zodra de eigenaar je account activeert."
    });
  } catch (err) {
    console.error("Fout bij registreren:", err);
    return res.status(500).json({ error: "Interne serverfout bij registreren." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "E-mailadres en wachtwoord zijn verplicht." });
    }

    const trimmedEmail = String(email).toLowerCase().trim();
    const user = await getUserByEmail(trimmedEmail);

    if (!user) {
      return res.status(401).json({ error: "Onjuiste inloggegevens." });
    }

    if (user.active === false) {
      return res
        .status(403)
        .json({ error: "Dit account is gedeactiveerd. Neem contact op met de eigenaar." });
    }

    const passwordHash = user.passwordHash || user.password_hash;
    if (!passwordHash) {
      console.error("Gebruiker heeft geen wachtwoordhash:", user.id);
      return res.status(500).json({ error: "Interne serverfout bij inloggen." });
    }

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, passwordHash);
    } catch (bcryptErr) {
      console.error("Bcrypt-fout bij inloggen:", bcryptErr);
      return res.status(500).json({ error: "Interne serverfout bij inloggen." });
    }
    if (!isMatch) {
      return res.status(401).json({ error: "Onjuiste inloggegevens." });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        naam: user.name,
        email: user.email,
        rol: user.role
      }
    });
  } catch (err) {
    console.error("Fout bij inloggen:", err.message || err);
    console.error(err.stack);
    return res.status(500).json({ error: "Interne serverfout bij inloggen." });
  }
});

// Wachtwoord reset (e-mail token)
const forgotSchema = z.object({
  email: z.string().email()
});
const resetSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(10)
});

const {
  createResetToken,
  getValidResetTokenByHash,
  markResetTokenUsed,
  updateUserPasswordHash
} = require("./passwordResetStore");

async function sendMail({ to, subject, text }) {
  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    console.log("[MAIL DEV] To:", to);
    console.log("[MAIL DEV] Subject:", subject);
    console.log("[MAIL DEV] Text:", text);
    return;
  }
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined
  });
  await transporter.sendMail({
    from: process.env.MAIL_FROM || "noreply@example.com",
    to,
    subject,
    text
  });
}

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    if (!hasDb()) {
      return res.status(501).json({ error: "Database niet geconfigureerd." });
    }
    const parsed = forgotSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parseZodError(parsed.error) });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = await getUserByEmail(email);

    // Voorkom user-enumeration: altijd 200 teruggeven.
    if (!user || user.active === false) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
    await createResetToken({ id: uuidv4(), userId: user.id, tokenHash, expiresAt });

    const resetUrl = `${APP_BASE_URL}/?resetToken=${token}`;
    await sendMail({
      to: user.email,
      subject: "Wachtwoord herstellen - La-Solución portaal",
      text: `Je hebt een verzoek gedaan om je wachtwoord te herstellen.\n\nOpen deze link om je wachtwoord opnieuw in te stellen (30 minuten geldig):\n${resetUrl}\n\nAls jij dit niet was, kun je deze e-mail negeren.`
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("Fout bij forgot-password:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    if (!hasDb()) {
      return res.status(501).json({ error: "Database niet geconfigureerd." });
    }
    const parsed = resetSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parseZodError(parsed.error) });
    }

    const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
    const tokenRow = await getValidResetTokenByHash(tokenHash);
    if (!tokenRow) {
      return res.status(400).json({ error: "Deze herstel-link is ongeldig of verlopen." });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await updateUserPasswordHash(tokenRow.userId, passwordHash);
    await markResetTokenUsed(tokenRow.id);

    return res.json({ ok: true });
  } catch (err) {
    console.error("Fout bij reset-password:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/api/auth/me", authRequired, (req, res) => {
  (async () => {
    try {
      const user = await getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }
      return res.json({
        id: user.id,
        naam: user.name,
        email: user.email,
        rol: user.role
      });
    } catch (err) {
      console.error("Fout bij /api/auth/me:", err);
      return res.status(500).json({ error: "Interne serverfout." });
    }
  })();
});

function requireOwner(req, res, next) {
  if (req.user?.rol !== "EIGENAAR") {
    return res.status(403).json({ error: "Alleen de eigenaar mag deze actie uitvoeren." });
  }
  return next();
}

async function purgeExpiredTrash() {
  const ids = await getExpiredOpdrachtIds();
  if (!ids.length) return;

  const bestanden = await listBestandenForOpdrachtIds(ids);
  for (const bestand of bestanden) {
    const filePath = path.join(uploadDir, bestand.opslagNaam);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (unlinkErr) {
      console.warn("Kon verlopen prullenbak-bestand niet verwijderen:", filePath, unlinkErr);
    }
  }

  await deleteBestandenForOpdrachtIds(ids);
  await permanentDeleteOpdrachten(ids);
}

// Opdrachten API
const opdrachtSchema = z.object({
  id: z.string().uuid().optional(),
  klantNaam: z.string().min(1),
  omschrijving: z.string().min(1),
  datumAangemaakt: z.string().min(10),
  datumDeadline: z.string().optional().nullable(),
  status: z.enum(["NIEUW", "AFWACHTING", "IN_BEHANDELING", "AFGEROND"]),
  prioriteit: z.number().int().min(1).max(3),
  behandelaarUserId: z.string().uuid().optional().nullable(),
  notities: z.string().optional().nullable(),
  categorie: z.string().optional().nullable()
});

app.get("/api/opdrachten", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    await purgeExpiredTrash();
    const rows = await listOpdrachtenForUser(req.user);
    const withFiles = await Promise.all(
      rows.map(async (o) => {
        const bestanden = await listBestandenForOpdracht(o.id);
        return { ...o, bestanden };
      })
    );
    return res.json({ opdrachten: withFiles });
  } catch (err) {
    console.error("Fout bij GET /api/opdrachten:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/api/opdrachten/prullenbak", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    await purgeExpiredTrash();
    const rows = await listPrullenbakForUser(req.user);
    const withFiles = await Promise.all(
      rows.map(async (o) => {
        const bestanden = await listBestandenForOpdracht(o.id);
        return { ...o, bestanden };
      })
    );
    return res.json({ opdrachten: withFiles, bewaarDagen: TRASH_RETENTION_DAYS });
  } catch (err) {
    console.error("Fout bij GET /api/opdrachten/prullenbak:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.post("/api/opdrachten", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const parsed = opdrachtSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parseZodError(parsed.error) });

    const id = uuidv4();
    let behandelaarUserId = parsed.data.behandelaarUserId || null;

    if (req.user.rol !== "EIGENAAR") {
      behandelaarUserId = req.user.id;
    }

    await createOpdracht({
      ...parsed.data,
      id,
      behandelaarUserId
    });

    const created = await getOpdrachtById(id);
    const bestanden = await listBestandenForOpdracht(id);
    return res.status(201).json({ opdracht: { ...created, bestanden } });
  } catch (err) {
    console.error("Fout bij POST /api/opdrachten:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.put("/api/opdrachten/:id", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const opdrachtId = req.params.id;
    const bestaande = await getOpdrachtById(opdrachtId);
    if (!bestaande) return res.status(404).json({ error: "Opdracht niet gevonden." });
    if (!canAccessOpdracht(req.user, bestaande)) {
      return res.status(403).json({ error: "Geen toegang tot deze opdracht." });
    }

    const parsed = opdrachtSchema.safeParse({ ...(req.body || {}), id: opdrachtId });
    if (!parsed.success) return res.status(400).json({ error: parseZodError(parsed.error) });

    let behandelaarUserId = parsed.data.behandelaarUserId || null;
    if (req.user.rol !== "EIGENAAR") {
      behandelaarUserId = req.user.id;
    }

    await updateOpdracht({
      ...parsed.data,
      id: opdrachtId,
      behandelaarUserId
    });

    const updated = await getOpdrachtById(opdrachtId);
    const bestanden = await listBestandenForOpdracht(opdrachtId);
    return res.json({ opdracht: { ...updated, bestanden } });
  } catch (err) {
    console.error("Fout bij PUT /api/opdrachten/:id:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.delete("/api/opdrachten/:id", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const opdrachtId = req.params.id;
    const bestaande = await getOpdrachtById(opdrachtId);
    if (!bestaande) return res.status(404).json({ error: "Opdracht niet gevonden." });

    await softDeleteOpdracht(opdrachtId);
    return res.status(204).send();
  } catch (err) {
    console.error("Fout bij DELETE /api/opdrachten/:id:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.post("/api/opdrachten/:id/herstel", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const opdrachtId = req.params.id;
    const inPrullenbak = await getOpdrachtInPrullenbakById(opdrachtId);
    if (!inPrullenbak) {
      return res.status(404).json({ error: "Opdracht niet gevonden in de prullenbak." });
    }

    await restoreOpdracht(opdrachtId);
    const hersteld = await getOpdrachtById(opdrachtId);
    const bestanden = await listBestandenForOpdracht(opdrachtId);
    return res.json({ opdracht: { ...hersteld, bestanden } });
  } catch (err) {
    console.error("Fout bij POST /api/opdrachten/:id/herstel:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

// Bestanden API
app.post(
  "/api/opdrachten/:id/bestanden",
  authRequired,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
      const opdrachtId = req.params.id;
      const bestaande = await getOpdrachtById(opdrachtId);
      if (!bestaande) return res.status(404).json({ error: "Opdracht niet gevonden." });
      if (!canAccessOpdracht(req.user, bestaande)) {
        return res.status(403).json({ error: "Geen toegang tot deze opdracht." });
      }
      if (!req.file) return res.status(400).json({ error: "Geen bestand ontvangen." });

      const bestandId = uuidv4();
      await createBestand({
        id: bestandId,
        opdrachtId,
        origineleNaam: req.file.originalname,
        opslagNaam: req.file.filename,
        mimeType: req.file.mimetype,
        grootte: req.file.size,
        uploadedByUserId: req.user.id
      });

      return res.status(201).json({ ok: true, bestandId });
    } catch (err) {
      console.error("Fout bij upload bestand:", err);
      return res.status(500).json({ error: "Interne serverfout." });
    }
  }
);

app.get("/api/bestanden/:id/download", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const bestand = await getBestandById(req.params.id);
    if (!bestand) return res.status(404).json({ error: "Bestand niet gevonden." });

    const opdracht = await getOpdrachtById(bestand.opdrachtId);
    if (!opdracht) return res.status(404).json({ error: "Opdracht niet gevonden." });
    if (!canAccessOpdracht(req.user, opdracht)) {
      return res.status(403).json({ error: "Geen toegang tot dit bestand." });
    }

    const filePath = path.join(uploadDir, bestand.opslagNaam);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Bestand ontbreekt." });

    res.setHeader("Content-Type", bestand.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(bestand.origineleNaam)}"`
    );
    return res.sendFile(filePath);
  } catch (err) {
    console.error("Fout bij download:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/api/admin/financieel", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const posten = await listFinancielePosten();
    return res.json({ posten });
  } catch (err) {
    console.error("Fout bij GET /api/admin/financieel:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

const financieelSchema = z.object({
  datum: z.string().min(10),
  type: z.enum(["INKOMST", "UITGAVE", "KASGELD", "OVERDRACHT"]),
  omschrijving: z.string().min(1),
  bedrag: z.number().finite().nonnegative(),
  valuta: z.enum(["EUR", "USD", "SRD", "XCG"]),
  categorie: z.string().optional().nullable(),
  referentie: z.string().optional().nullable(),
  klantNaam: z.string().optional().nullable(),
  opdrachtId: z.string().optional().nullable(),
  afgehandeldDoorUserId: z.string().optional().nullable(),
  afgehandeldDoorNaam: z.string().optional().nullable(),
  betalingswijze: z.enum(["OPGEHAALD", "OVERGEMAAKT", "GESTORT"]).optional().nullable(),
  bank: z.string().optional().nullable(),
  geldBijUserId: z.string().optional().nullable(),
  geldBijNaam: z.string().optional().nullable(),
  geldVanUserId: z.string().optional().nullable(),
  geldVanNaam: z.string().optional().nullable(),
  wisselkoers: z.number().finite().nonnegative().optional().nullable(),
  status: z.enum(["OPEN", "BETAALD"]),
  notities: z.string().optional().nullable(),
  gebruikingen: z
    .array(
      z.object({
        id: z.string().optional(),
        datum: z.string().min(8),
        soort: z.enum(["AF", "ERBIJ"]),
        bedrag: z.number().finite().positive(),
        waaraan: z.string().optional().nullable(),
        bank: z.string().optional().nullable(),
        medewerker: z.string().optional().nullable(),
        toelichting: z.string().optional().nullable()
      })
    )
    .optional()
    .nullable()
}).superRefine((data, ctx) => {
  const t = Date.parse(data.datum);
  if (Number.isNaN(t)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["datum"],
      message: "Ongeldige datum/tijd."
    });
  }
});

app.post("/api/admin/financieel", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const body = { ...(req.body || {}) };
    if (!body.valuta) body.valuta = "EUR";
    if (body.wisselkoers === "" || body.wisselkoers === undefined) body.wisselkoers = null;
    const parsed = financieelSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parseZodError(parsed.error) });
    const post = await createFinancielePost(parsed.data);
    return res.status(201).json({ post });
  } catch (err) {
    console.error("Fout bij POST /api/admin/financieel:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.put("/api/admin/financieel/:id", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const body = { ...(req.body || {}) };
    if (!body.valuta) body.valuta = "EUR";
    if (body.wisselkoers === "" || body.wisselkoers === undefined) body.wisselkoers = null;
    const parsed = financieelSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parseZodError(parsed.error) });
    const post = await updateFinancielePost(req.params.id, parsed.data);
    if (!post) return res.status(404).json({ error: "Post niet gevonden." });
    return res.json({ post });
  } catch (err) {
    console.error("Fout bij PUT /api/admin/financieel/:id:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.delete("/api/admin/financieel/:id", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const ok = await deleteFinancielePost(req.params.id);
    if (!ok) return res.status(404).json({ error: "Post niet gevonden." });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Fout bij DELETE /api/admin/financieel/:id:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

const inzendingSchema = z.object({
  datum: z.string().min(10),
  type: z.enum(["INKOMST", "UITGAVE", "KASGELD", "OVERDRACHT"]),
  omschrijving: z.string().min(1),
  bedrag: z.number().finite().nonnegative(),
  valuta: z.enum(["EUR", "USD", "SRD", "XCG"]).optional(),
  wisselkoers: z.number().finite().nonnegative().optional().nullable(),
  categorie: z.string().optional().nullable(),
  referentie: z.string().optional().nullable(),
  klantNaam: z.string().optional().nullable(),
  betalingswijze: z.enum(["OPGEHAALD", "OVERGEMAAKT", "GESTORT"]).optional().nullable(),
  bank: z.string().optional().nullable(),
  geldBijNaam: z.string().optional().nullable(),
  geldVanNaam: z.string().optional().nullable(),
  waaraan: z.string().optional().nullable(),
  notities: z.string().optional().nullable()
}).superRefine((data, ctx) => {
  if (Number.isNaN(Date.parse(data.datum))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["datum"],
      message: "Ongeldige datum/tijd."
    });
  }
});

app.get("/api/financieel-inzendingen", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const isOwner = req.user?.rol === "EIGENAAR";
    const inzendingen = await listInzendingen({
      alleenUserId: isOwner ? null : req.user.id
    });
    const ongelezen = isOwner ? await countNieuweInzendingen() : 0;
    return res.json({ inzendingen, ongelezen });
  } catch (err) {
    console.error("Fout bij GET /api/financieel-inzendingen:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.post("/api/financieel-inzendingen", authRequired, parseInzendingUpload, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const body = { ...(req.body || {}) };
    if (!body.valuta) body.valuta = "EUR";
    if (body.wisselkoers === "" || body.wisselkoers === undefined) body.wisselkoers = null;
    if (body.betalingswijze === "") body.betalingswijze = null;
    if (typeof body.bedrag === "string") {
      body.bedrag = Number(String(body.bedrag).replace(",", "."));
    }
    if (typeof body.wisselkoers === "string" && body.wisselkoers.trim()) {
      body.wisselkoers = Number(String(body.wisselkoers).replace(",", "."));
    }
    const parsed = inzendingSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parseZodError(parsed.error) });
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: "Gebruiker niet gevonden." });
    const files = Array.isArray(req.files) ? req.files : [];
    const inzending = await createInzending(
      {
        ...parsed.data,
        vanUserId: user.id,
        vanNaam: user.name
      },
      files
    );
    return res.status(201).json({ inzending });
  } catch (err) {
    console.error("Fout bij POST /api/financieel-inzendingen:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/api/financieel-inzendingen/bestanden/:id/download", authRequired, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const bijlage = await getInzendingBijlageById(req.params.id);
    if (!bijlage) return res.status(404).json({ error: "Afbeelding niet gevonden." });
    const inzending = await getInzendingById(bijlage.inzendingId);
    if (!inzending) return res.status(404).json({ error: "Inzending niet gevonden." });
    const isOwner = req.user?.rol === "EIGENAAR";
    const isSender = String(inzending.vanUserId) === String(req.user.id);
    if (!isOwner && !isSender) {
      return res.status(403).json({ error: "Geen toegang tot deze afbeelding." });
    }
    const filePath = path.join(uploadDir, bijlage.opslagNaam);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Bestand ontbreekt." });
    res.setHeader("Content-Type", bijlage.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(bijlage.origineleNaam)}"`
    );
    return res.sendFile(filePath);
  } catch (err) {
    console.error("Fout bij download inzending-afbeelding:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.patch("/api/financieel-inzendingen/:id", authRequired, requireOwner, async (req, res) => {
  try {
    if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
    const status = String(req.body?.status || "").toUpperCase();
    if (!["NIEUW", "GEZIEN", "VERWERKT"].includes(status)) {
      return res.status(400).json({ error: "Ongeldige status." });
    }
    const inzending = await updateInzendingStatus(req.params.id, status);
    if (!inzending) return res.status(404).json({ error: "Inzending niet gevonden." });
    return res.json({ inzending });
  } catch (err) {
    console.error("Fout bij PATCH /api/financieel-inzendingen:", err);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/api/admin/users", authRequired, requireOwner, (req, res) => {
  (async () => {
    try {
      const users = await getUsers();
      const safeUsers = users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active !== false
      }));
      return res.json({ users: safeUsers });
    } catch (err) {
      console.error("Fout bij /api/admin/users:", err);
      return res.status(500).json({ error: "Interne serverfout." });
    }
  })();
});

app.post("/api/admin/users/:id/toggle-active", authRequired, requireOwner, (req, res) => {
  (async () => {
    try {
      const { id } = req.params;
      const user = await getUserById(id);
      if (!user) {
        return res.status(404).json({ error: "Gebruiker niet gevonden." });
      }
      if (user.role === "EIGENAAR") {
        return res
          .status(400)
          .json({ error: "De eigenaar kan niet via deze route gedeactiveerd worden." });
      }
      const nextActive = user.active === false ? true : false;
      await setUserActive(user.id, nextActive);
      return res.json({
        id: user.id,
        active: nextActive
      });
    } catch (err) {
      console.error("Fout bij toggle-active:", err);
      return res.status(500).json({ error: "Interne serverfout." });
    }
  })();
});

app.get("/api/health", async (_req, res) => {
  try {
    if (hasDb()) {
      await getUsers();
    }
    res.json({ ok: true, env: NODE_ENV, db: hasDb() });
  } catch (err) {
    console.error("Health check DB-fout:", err);
    res.status(503).json({ ok: false, error: "Database niet bereikbaar." });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: `Onbekend API-eindpunt: ${req.method} ${req.path}` });
});

app.use((err, req, res, next) => {
  if (
    err instanceof SyntaxError ||
    err.type === "entity.parse.failed" ||
    (err.status === 400 && err.type === "entity.parse.failed")
  ) {
    return res.status(400).json({ error: "Ongeldige JSON." });
  }
  console.error("Onafgehandelde serverfout:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Interne serverfout." });
  }
});

async function startServer() {
  await migrate();
  await ensureOwnerAccount();

  if (NODE_ENV === "production") {
    const distPath = path.join(__dirname, "..", "dist");
    if (!fs.existsSync(distPath)) {
      throw new Error(
        "Map 'dist' ontbreekt. Voer eerst 'npm run build' uit (maakt de frontend-build aan)."
      );
    }
    app.use(
      express.static(distPath, {
        index: false,
        etag: true,
        setHeaders(res, filePath) {
          const name = path.basename(filePath);
          if (
            name === "index.html" ||
            name === "version.json" ||
            name === "manifest.webmanifest"
          ) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            return;
          }
          if (/\.[a-f0-9]{8,}\./i.test(name)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
            return;
          }
          res.setHeader("Cache-Control", "no-cache");
        }
      })
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, () => {
      console.log(`La-Solución backend draait op http://localhost:${PORT}`);
      if (NODE_ENV === "production") {
        console.log(
          `Productie: frontend + API op PORT ${PORT}. Open de app via een van: ${CORS_ORIGINS.join(", ")}`
        );
      } else if (!hasDb()) {
        console.log("Let op: DATABASE_URL ontbreekt.");
      }
      resolve(server);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Poort ${PORT} is al in gebruik. Stop het andere proces of open http://localhost:${PORT}/api/health`
        );
      } else {
        console.error("Serverfout:", err);
      }
      reject(err);
    });
  });
}

module.exports = { app, startServer };

