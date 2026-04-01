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
  setUserActive
} = require("./store");
const {
  listOpdrachtenForUser,
  getOpdrachtById,
  createOpdracht,
  updateOpdracht
} = require("./opdrachtenStore");
const { listBestandenForOpdracht, getBestandById, createBestand } = require("./bestandenStore");

const { createResetToken, getValidResetTokenByHash, markResetTokenUsed, updateUserPasswordHash } =
  require("./passwordResetStore");

function createApp() {
  const app = express();

  const PORT = process.env.PORT || 4000;
  const NODE_ENV = process.env.NODE_ENV || "development";
  const JWT_SECRET = process.env.JWT_SECRET || "dev-fallback-niet-gebruiken-in-productie";
  const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || "http://localhost:5173";
  const CORS_ORIGINS = CORS_ORIGIN_RAW.split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:5173";

  const CORS_PLACEHOLDER = "https://your-app-url.example";
  if (NODE_ENV === "production") {
    if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === "dev-fallback-niet-gebruiken-in-productie") {
      throw new Error(
        "JWT_SECRET is niet ingesteld of te kort. Stel een sterk JWT_SECRET in (min. 32 tekens) voor productie."
      );
    }
    const hasProductionOrigin = CORS_ORIGINS.some((o) => o && o !== CORS_PLACEHOLDER);
    if (!hasProductionOrigin) {
      throw new Error(
        "CORS_ORIGIN moet in productie op je echte app-URL staan (bijv. https://app.la-solucion.nl of je Vercel-URL)."
      );
    }
  }

  app.use(
    cors({
      origin: (origin, cb) => {
        const o = origin ? origin.replace(/\/$/, "") : "";
        const allowed = !origin || CORS_ORIGINS.some((allowedOrigin) => o === allowedOrigin);
        cb(null, allowed);
      },
      credentials: false
    })
  );
  app.use(helmet());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false
    })
  );
  app.use(express.json());

  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "");
        const safeExt = ext.slice(0, 10);
        cb(null, `${uuidv4()}${safeExt}`);
      }
    }),
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
    } catch (_err) {
      return res.status(401).json({ error: "Niet geautoriseerd: ongeldige of verlopen token." });
    }
  }

  function canAccessOpdracht(user, opdracht) {
    if (user.rol === "EIGENAAR") return true;
    return Boolean(opdracht.behandelaarUserId && opdracht.behandelaarUserId === user.id);
  }

  function parseZodError(err) {
    if (err?.issues) {
      return err.issues.map((i) => i.message).join(" ");
    }
    return "Ongeldige invoer.";
  }

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, email, password, role } = req.body || {};

      if (!name || !email || !password) {
        return res.status(400).json({ error: "Naam, e-mailadres en wachtwoord zijn verplicht." });
      }

      const trimmedEmail = String(email).toLowerCase().trim();
      const existing = await getUserByEmail(trimmedEmail);

      if (existing) {
        return res.status(409).json({ error: "Er bestaat al een gebruiker met dit e-mailadres." });
      }

      const users = await getUsers();
      let assignedRole = "MEDEWERKER";
      if (users.length === 0) {
        assignedRole = "EIGENAAR";
      } else if (role === "EIGENAAR") {
        assignedRole = "MEDEWERKER";
      }

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

      const ownerEmail = process.env.OWNER_EMAIL;
      if (ownerEmail) {
        const subject = `Nieuwe registratie La-Solución portaal - ${newUser.name}`;
        const text = [
          "Er is een nieuwe registratie voor het La-Solución intern portaal.",
          "",
          `Naam: ${newUser.name}`,
          `E-mailadres: ${newUser.email}`,
          `Toegekende rol: ${assignedRole}`,
          "",
          "Controleer de gebruiker in het systeem en geef toestemming of trek toegang in volgens jullie interne procedure."
        ].join("\n");
        try {
          await sendMail({ to: ownerEmail, subject, text });
        } catch (mailErr) {
          console.error("Fout bij verzenden e-mail naar eigenaar na registratie:", mailErr);
        }
      } else {
        console.log("[REGISTRATIE] Geen OWNER_EMAIL gezet; e-mail naar eigenaar niet verzonden.");
      }

      return res.status(201).json({
        message:
          assignedRole === "EIGENAAR"
            ? "Eerste gebruiker geregistreerd als eigenaar."
            : "Gebruiker geregistreerd als medewerker."
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

  const forgotSchema = z.object({
    email: z.string().email()
  });
  const resetSchema = z.object({
    token: z.string().min(20),
    newPassword: z.string().min(10)
  });

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
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
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

  app.get("/api/auth/me", authRequired, async (req, res) => {
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
  });

  function requireOwner(req, res, next) {
    if (req.user?.rol !== "EIGENAAR") {
      return res.status(403).json({ error: "Alleen de eigenaar mag deze actie uitvoeren." });
    }
    return next();
  }

  const opdrachtSchema = z.object({
    id: z.string().uuid().optional(),
    klantNaam: z.string().min(1),
    omschrijving: z.string().min(1),
    datumAangemaakt: z.string().min(10),
    datumDeadline: z.string().optional().nullable(),
    status: z.enum(["NIEUW", "IN_BEHANDELING", "AFGEROND"]),
    prioriteit: z.number().int().min(1).max(3),
    behandelaarUserId: z.string().uuid().optional().nullable(),
    notities: z.string().optional().nullable(),
    categorie: z.string().optional().nullable()
  });

  app.get("/api/opdrachten", authRequired, async (req, res) => {
    try {
      if (!hasDb()) return res.status(501).json({ error: "Database niet geconfigureerd." });
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
      console.error("Fout bij PUT /api/opdrachten/:id", err);
      return res.status(500).json({ error: "Interne serverfout." });
    }
  });

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
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(bestand.origineleNaam)}"`);
      return res.sendFile(filePath);
    } catch (err) {
      console.error("Fout bij download:", err);
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
          return res.status(400).json({ error: "De eigenaar kan niet via deze route gedeactiveerd worden." });
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

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, env: NODE_ENV, db: hasDb() });
  });

  // In productie "serve" je frontend via een aparte host (Vercel).
  // Voor traditionele server-deploy (Node host) kun je nog steeds dist serveren via server/index.js.
  app.locals.__meta = { PORT, NODE_ENV, CORS_ORIGINS, APP_BASE_URL };
  return app;
}

async function startServer() {
  const app = createApp();
  const { PORT, NODE_ENV, CORS_ORIGINS } = app.locals.__meta;

  try {
    await migrate();
  } catch (err) {
    // Lokaal willen we altijd kunnen draaien (ook als .env nog op production staat),
    // dus: als dit NIET op Vercel draait, schakel DB uit en gebruik fallback store.
    if (!process.env.VERCEL) {
      const { disableDb } = require("./db");
      disableDb();
      console.warn(
        "[DEV] Database migratie faalde; DB is uitgeschakeld en fallback store wordt gebruikt.",
        err?.message || err
      );
    } else {
      throw err;
    }
  }

  if (NODE_ENV === "production") {
    const distPath = path.join(__dirname, "..", "dist");
    if (!fs.existsSync(distPath)) {
      throw new Error("Map 'dist' ontbreekt. Voer eerst 'npm run build' uit (maakt de frontend-build aan).");
    }
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return new Promise((resolve) => {
    app.listen(PORT, () => {
      console.log(`La-Solución backend draait op http://localhost:${PORT}`);
      if (NODE_ENV === "production") {
        console.log(
          `Productie: frontend + API op PORT ${PORT}. Open de app via een van: ${CORS_ORIGINS.join(", ")}`
        );
      } else if (!hasDb()) {
        console.log("Let op: DATABASE_URL ontbreekt of DB is uitgeschakeld. Fallback store (server/data.json) is actief.");
      }
      resolve();
    });
  });
}

module.exports = { createApp, startServer };

