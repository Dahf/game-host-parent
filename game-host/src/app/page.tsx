"use client";

import { useState, useEffect } from "react";
import io from "socket.io-client";
import Cookies from "js-cookie";

const socket = io("http://87.106.33.94:4000");

export default function GameHost() {
  const [players, setPlayers] = useState([]);
  const [buzzerDisabled, setBuzzerDisabled] = useState(false);
  const [buzzedPlayer, setBuzzedPlayer] = useState(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);
  const [userType, setUserType] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [screenshot, setScreenshot] = useState(null);
  const buzzerSound = new Audio("/buzzer.mp3");
  useEffect(() => {
    const savedUserType = Cookies.get("userType");
    const savedName = Cookies.get("name");
    if (savedUserType === "admin") {
      setUserType("admin");
      setIsAdmin(true);
      setAdminLoggedIn(true);
    } else if (savedUserType === "player" && savedName) {
      setUserType("player");
      setName(savedName);
      setJoined(true);
    }
  }, []);

  useEffect(() => {
    fetch("http://87.106.33.94:4000/players")
      .then((res) => res.json())
      .then((data) => setPlayers(data.players))
      .catch((err) =>
        console.error("Fehler beim Abrufen der Spielerliste:", err)
      );

    socket.on("updatePlayers", (players) => setPlayers(players));
    socket.on("buzzed", ({ name }) => {
      setBuzzedPlayer(name);
      setBuzzerDisabled(true);
      buzzerSound.play();
    });
    socket.on("buzzReset", () => {
      setBuzzedPlayer(null);
      setBuzzerDisabled(false);
    });
    socket.on("gameStarted", () => {
      setBuzzedPlayer(null);
      setBuzzerDisabled(false);
      setGameStarted(true);
    });
    socket.on("gameStopped", () => {
      setGameStarted(false);
      setBuzzerDisabled(true);
    });
    socket.on("newScreenshot", (imageUrl) => {
      console.log(imageUrl);
      setScreenshot(imageUrl);
    });
  }, []);

  const loginAsAdmin = () => {
    fetch("http://87.106.33.94:4000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAdminLoggedIn(true);
          setUserType("admin");
          setIsAdmin(true);
          Cookies.set("userType", "admin", {
            expires: 1,
            secure: true,
            sameSite: "Strict",
          });
        }
      })
      .catch((err) => console.error("Admin Login Fehler:", err));
  };

  const joinGame = () => {
    if (name) {
      fetch("http://87.106.33.94:4000/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setJoined(true);
            setUserType("player");
            Cookies.set("userType", "player", {
              expires: 1,
              secure: true,
              sameSite: "Strict",
            });
            Cookies.set("name", name, {
              expires: 1,
              secure: true,
              sameSite: "Strict",
            });
          }
        })
        .catch((err) => console.error("Spieler Beitritt Fehler:", err));
    }
  };
  const startGame = () => {
    socket.emit("startGame");
  };

  const stopGame = () => {
    socket.emit("stopGame");
  };
  const handleScreenshotUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("screenshot", file);

    fetch("http://87.106.33.94:4000/upload", {
      method: "POST",
      body: formData,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setScreenshot(data.imageUrl);
        }
      })
      .catch((err) =>
        console.error("Fehler beim Hochladen des Screenshots:", err)
      );
  };

  const logout = () => {
    if (userType === "player") {
      socket.emit("removePlayer", name);
    }
    Cookies.remove("userType");
    Cookies.remove("name");
    setUserType(null);
    setAdminLoggedIn(false);
    setIsAdmin(false);
    setJoined(false);
    setName("");
  };

  const buzz = () => {
    if (!buzzerDisabled && gameStarted) {
      socket.emit("buzz", name);
    }
  };

  const resetBuzz = () => {
    setBuzzedPlayer(null);
    setBuzzerDisabled(false);
    socket.emit("resetBuzz");
  };
  const updatePoints = (playerName, delta) => {
    fetch("http://87.106.33.94:4000/updatePoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, points: delta }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPlayers(data.players);
        }
      });
  };
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-10">
      <h1 className="text-3xl font-bold mb-6">Game Host</h1>
      {userType ? (
        <button
          onClick={logout}
          className="mb-4 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
        >
          Logout
        </button>
      ) : null}
      {!userType ? (
        <div className="flex flex-col gap-4">
          <button
            onClick={() => {
              setUserType("admin");
              setIsAdmin(true);
            }}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Als Admin anmelden
          </button>
          <button
            onClick={() => {
              setUserType("player");
              setIsAdmin(false);
            }}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Als Spieler beitreten
          </button>
        </div>
      ) : isAdmin && !adminLoggedIn ? (
        <div className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="Admin Passwort"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            className="p-2 text-black rounded-md"
          />
          <button
            onClick={loginAsAdmin}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            Anmelden
          </button>
        </div>
      ) : isAdmin ? (
        <div className="w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Admin Panel</h2>
          <button
            onClick={startGame}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            Spiel starten
          </button>
          <button
            onClick={stopGame}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-4"
          >
            Spiel stoppen
          </button>
          <input
            type="file"
            onChange={handleScreenshotUpload}
            className="mb-4"
          />
          <h2 className="text-xl font-semibold mb-4">Spielerliste:</h2>
          <ul className="mb-4">
            {players.map((player, index) => (
              <li key={index} className="border-b border-gray-700 py-2">
                {player.name} - {player.points} Punkte
                <div>
                  <button
                    onClick={() => updatePoints(player.name, 1)}
                    className="ml-2 bg-green-500 px-2 py-1 rounded"
                  >
                    +1
                  </button>
                  <button
                    onClick={() => updatePoints(player.name, -1)}
                    className="ml-2 bg-red-500 px-2 py-1 rounded"
                  >
                    -1
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {buzzedPlayer && (
            <h3 className="text-lg mt-4">{buzzedPlayer} hat gebuzzert!</h3>
          )}
          <button
            onClick={resetBuzz}
            className="bg-yellow-500 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded"
          >
            Buzz zurücksetzen
          </button>
        </div>
      ) : !joined ? (
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Dein Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-2 text-black rounded-md"
          />
          <button
            onClick={joinGame}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Beitreten
          </button>
        </div>
      ) : (
        <div className="w-full max-w-7xl">
          <h2 className="text-xl font-semibold mb-4">Spielerliste:</h2>
          <ul className="mb-4">
            {players.map((player, index) => (
              <li key={index} class Name="border-b border-gray-700 py-2">
                {player.name} - {player.points} Punkte
              </li>
            ))}
          </ul>
          {screenshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={screenshot}
              alt="Screenshot"
              className="w-full max-w-7xl h-auto rounded-md shadow-lg"
            />
          ) : null}
          <button
            onClick={buzz}
            disabled={buzzerDisabled}
            className={`py-2 px-4 rounded font-bold transition ${
              buzzerDisabled ? "bg-gray-500" : "bg-red-500 hover:bg-red-700"
            }`}
          >
            Buzz!
          </button>
          {buzzedPlayer && (
            <h3 className="text-lg mt-4">{buzzedPlayer} hat gebuzzert!</h3>
          )}
        </div>
      )}
    </div>
  );
}
