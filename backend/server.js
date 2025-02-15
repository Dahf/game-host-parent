import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // 🚀 Statische Route für Bilder

const gameMasterPassword = "securepassword";
let gameMasterLoggedIn = false;
let players = [];
let buzzerActive = false;
let buzzedPlayer = null;
let gameStarted = false;
app.get("/players", (req, res) => {
  res.json({ players });
});

// Game Master Login
app.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === gameMasterPassword) {
    gameMasterLoggedIn = true;
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false, message: "Wrong password" });
});

// Spieler beitreten
app.post("/join", (req, res) => {
  const { name } = req.body;
  if (players.find((player) => player.name === name)) {
    return res
      .status(400)
      .json({ success: false, message: "Name already taken" });
  }
  players.push({ name, points: 0 });
  io.emit("updatePlayers", players);
  return res.json({ success: true, players });
});
let currentScreenshot = null;

// Multer Konfiguration für Dateiuploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });
// Endpoint zum Hochladen von Screenshots
app.post("/upload", upload.single("screenshot"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "Kein Bild hochgeladen" });
  }

  currentScreenshot = `http://localhost:4000/uploads/${req.file.filename}`;
  io.emit("newScreenshot", currentScreenshot); // An alle Clients senden
  res.json({ success: true, imageUrl: currentScreenshot });
});
// Spiel starten
app.post("/start", (req, res) => {
  if (!gameMasterLoggedIn) {
    return res.status(403).json({ success: false, message: "Unauthorized" });
  }
  buzzerActive = true;
  buzzedPlayer = null;
  io.emit("gameStarted");
  return res.json({ success: true });
});
app.post("/updatePoints", (req, res) => {
  const { name, points } = req.body;

  // Finde den Spieler und aktualisiere seine Punkte
  const player = players.find((p) => p.name === name);
  if (player) {
    player.points += points;
    io.emit("updatePlayers", players); // Aktualisierte Spielerliste an alle senden
    res.json({ success: true, players });
  } else {
    res.status(404).json({ success: false, message: "Spieler nicht gefunden" });
  }
});

// Buzzer-Logik
io.on("connection", (socket) => {
  socket.emit(gameStarted ? "gameStarted" : "gameStopped");
  socket.emit("updatePlayers", players);
  if (currentScreenshot) {
    socket.emit("newScreenshot", currentScreenshot);
  }
  socket.on("buzz", (name) => {
    if (buzzerActive && !buzzedPlayer) {
      buzzedPlayer = name;
      buzzerActive = false;
      console.log("buzz");
      io.emit("buzzed", { name });
    }
  });
  socket.on("startGame", () => {
    gameStarted = true;
    buzzedPlayer = null;
    buzzerActive = true;
    io.emit("gameStarted");
    console.log("Spiel gestartet");
  });

  // Admin stoppt das Spiel
  socket.on("stopGame", () => {
    gameStarted = false;
    buzzedPlayer = null;
    buzzerActive = false;
    io.emit("buzzReset");
    io.emit("gameStopped");
    console.log("Spiel gestoppt");
  });
  socket.on("resetBuzz", () => {
    buzzerActive = true;
    buzzedPlayer = null;
    io.emit("buzzReset");
    console.log("Buzz zurückgesetzt");
  });

  socket.on("removePlayer", (name) => {
    players = players.filter((player) => player.name !== name);
    io.emit("updatePlayers", players);
  });
  socket.on("addPoints", ({ name, points }) => {
    const player = players.find((p) => p.name === name);
    if (player) {
      player.points += points;
      io.emit("updatePlayers", players);
    }
  });
});

server.listen(4000, () => console.log("Server running on port 4000"));
