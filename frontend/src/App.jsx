import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("ABC123");
  const [players, setPlayers] = useState([]);
  const [word, setWord] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [joined, setJoined] = useState(false);

  // 🔌 WebSocket setup
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws/game");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected ✅");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "PLAYERS") {
        setPlayers(data.players);
      }

      if (data.type === "WORD") {
        setCurrentWord(data.word);
      }

      if (data.type === "DRAW_START") {
        const ctx = canvasRef.current.getContext("2d");

        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      }

      if (data.type === "DRAW") {
        const ctx = canvasRef.current.getContext("2d");

        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }

      if (data.type === "DRAW_END") {
         const ctx = canvasRef.current.getContext("2d");
         ctx.beginPath(); // break the line
      }

      if (data.type === "CLEAR") {
        clearCanvas();
      }
    };

    return () => socket.close();
  }, []);

  // 🎨 Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "white";
  }, []);

  // 🧠 Drawing logic
const startDrawing = (e) => {
  isDrawing.current = true;

  const rect = canvasRef.current.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  socketRef.current.send(
    JSON.stringify({
      type: "DRAW_START",
      roomCode,
      x,
      y,
    })
  );
};

  const stopDrawing = () => {
    isDrawing.current = false;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
  };

  const draw = (e) => {
    if (!isDrawing.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvasRef.current.getContext("2d");

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);

    // 🔥 send to backend
    socketRef.current.send(
      JSON.stringify({
        type: "DRAW",
        roomCode,
        x,
        y,
      })
    );
  };

  const drawFromServer = (x, y) => {
    const ctx = canvasRef.current.getContext("2d");

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // 🚀 Join room
  const joinRoom = () => {
    if (!username) return alert("Enter username");

    socketRef.current.send(
      JSON.stringify({
        type: "JOIN",
        roomCode,
        username,
      })
    );

    setJoined(true);
  };

  // ✏ Send word
  const sendWord = () => {
    if (!word.trim()) return;

    socketRef.current.send(
      JSON.stringify({
        type: "SET_WORD",
        roomCode,
        word,
      })
    );

    setWord("");
  };

  // 🧹 Clear board
  const clearBoard = () => {
    socketRef.current.send(
      JSON.stringify({
        type: "CLEAR",
        roomCode,
      })
    );
  };

  return (
    <div className="container">
      <h1 className="title">🎨 Scribble Clone</h1>

      {!joined ? (
        <div className="card">
          <input
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            placeholder="Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />

          <button onClick={joinRoom} disabled={!connected}>
            Join Room
          </button>
        </div>
      ) : (
        <div className="game">
          <div className="left">
            <h2>Players</h2>
            <ul>
              {players.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>

          <div className="center">
            <h2>Current Word</h2>
            <div className="word-box">{currentWord || "Waiting..."}</div>

            {/* 🎨 CANVAS */}
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="canvas"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
            />

            <div className="input-area">
              <input
                placeholder="Type word..."
                value={word}
                onChange={(e) => setWord(e.target.value)}
              />
              <button onClick={sendWord}>Send</button>
              <button onClick={clearBoard}>Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;