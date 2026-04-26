import { useEffect, useRef, useState } from "react";
import "./App.css";

const COLORS = [
  "#1a1a1a", "#e03030", "#4dabf7", "#3dba6f",
  "#f59f00", "#ae3ec9", "#f76707", "#2f9e44",
  "#ffffff", "#868e96",
];

const SIZES = [
  { label: "sm", size: 3, cls: "size-sm" },
  { label: "md", size: 6, cls: "size-md" },
  { label: "lg", size: 14, cls: "size-lg" },
];

const avatarColors = [
  "av-0","av-1","av-2","av-3","av-4","av-5","av-6","av-7"
];

function getInitials(name) {
  return name ? name[0].toUpperCase() : "?";
}

export default function App() {
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const chatEndRef = useRef(null);

  const [scores, setScores] = useState({});
  const [chat, setChat] = useState([]);
  const [guess, setGuess] = useState("");
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [players, setPlayers] = useState([]);
  const [word, setWord] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [joined, setJoined] = useState(false);
  const [isDrawer, setIsDrawer] = useState(false);

  // Toolbar state
  const [activeColor, setActiveColor] = useState("#1a1a1a");
  const [activeSize, setActiveSize] = useState(1); // index into SIZES
  const [isEraser, setIsEraser] = useState(false);

  // Refs so WebSocket closure always reads latest values
  const activeColorRef = useRef("#1a1a1a");
  const activeSizeRef = useRef(1);
  const isEraserRef = useRef(false);

  const setColor = (c) => { setActiveColor(c); activeColorRef.current = c; setIsEraser(false); isEraserRef.current = false; };
  const setSize = (i) => { setActiveSize(i); activeSizeRef.current = i; };
  const toggleEraser = () => { const v = !isEraserRef.current; setIsEraser(v); isEraserRef.current = v; };

  // ── Canvas context helpers ──
  const getCtx = () => canvasRef.current?.getContext("2d");

  // Apply local tool settings to ctx
  const applyTool = (ctx) => {
    if (isEraserRef.current) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = SIZES[activeSizeRef.current].size * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = activeColorRef.current;
      ctx.lineWidth = SIZES[activeSizeRef.current].size;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  // Apply settings received from server (for other players)
  const applyRemoteTool = (ctx, color, lineWidth, eraser) => {
    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = lineWidth;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  };

  // ── WebSocket ──
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws/game");
    socketRef.current = socket;

    socket.onopen = () => setConnected(true);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "ERROR") {
        alert(data.message);
        setJoined(false);
      }
      if (data.type === "PLAYERS") setPlayers(data.players);
      if (data.type === "WORD") {
        setCurrentWord(data.word);
        setIsDrawer(data.word !== "????");
      }
      if (data.type === "DRAW_START") {
        const ctx = getCtx();
        if (!ctx) return;
        applyRemoteTool(ctx, data.color, data.lineWidth, data.eraser);
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      }
      if (data.type === "DRAW") {
        const ctx = getCtx();
        if (!ctx) return;
        ctx.lineTo(data.x, data.y);
        ctx.stroke();
      }
      if (data.type === "DRAW_END") {
        const ctx = getCtx();
        if (ctx) ctx.beginPath();
      }
      if (data.type === "CLEAR") clearCanvas();
      if (data.type === "CHAT") {
        setChat((prev) => [...prev, { text: `${data.username}: ${data.message}`, type: "regular" }]);
      }
      if (data.type === "CORRECT_GUESS") {
        setChat((prev) => [...prev, { text: `🎉 ${data.username} guessed it!`, type: "correct" }]);
      }
      if (data.type === "SCORES") setScores(data.scores);
    };

    return () => socket.close();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ── Canvas init ──
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
  }, []);

  // ── Drawing ──
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e) => {
    if (!isDrawer) return;
    isDrawing.current = true;
    const { x, y } = getPos(e);
    const ctx = getCtx();
    applyTool(ctx);
    ctx.beginPath();
    ctx.moveTo(x, y);
    const eraser = isEraserRef.current;
    const lineWidth = eraser
      ? SIZES[activeSizeRef.current].size * 3
      : SIZES[activeSizeRef.current].size;
    socketRef.current.send(JSON.stringify({
      type: "DRAW_START", roomCode, x, y,
      color: activeColorRef.current,
      lineWidth,
      eraser,
    }));
  };

  const draw = (e) => {
    if (!isDrawing.current || !isDrawer) return;
    const { x, y } = getPos(e);
    const ctx = getCtx();
    ctx.lineTo(x, y);
    ctx.stroke();
    socketRef.current.send(JSON.stringify({ type: "DRAW", roomCode, x, y }));
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const ctx = getCtx();
    if (ctx) ctx.beginPath();
    socketRef.current.send(JSON.stringify({ type: "DRAW_END", roomCode }));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ── Room actions ──
  const createRoom = async () => {
    if (!username) return alert("Enter username");
    const res = await fetch("http://localhost:8080/api/rooms/create", { method: "POST" });
    const data = await res.json();
    setRoomCode(data.roomCode);
    if (socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ type: "JOIN", roomCode: data.roomCode, username }));
    setJoined(true);
  };

  const joinRoom = () => {
    if (!username) return alert("Enter username");
    socketRef.current.send(JSON.stringify({ type: "JOIN", roomCode, username }));
    setJoined(true);
  };

  const sendWord = () => {
    if (!word.trim()) return;
    socketRef.current.send(JSON.stringify({ type: "SET_WORD", roomCode, word }));
    setWord("");
  };

  const clearBoard = () => {
    socketRef.current.send(JSON.stringify({ type: "CLEAR", roomCode }));
  };

  const sendGuess = () => {
    if (!guess.trim()) return;
    socketRef.current.send(JSON.stringify({ type: "CHAT", roomCode, message: guess }));
    setGuess("");
  };

  const becomeDrawer = () => {
    socketRef.current.send(JSON.stringify({ type: "BECOME_DRAWER", roomCode }));
  };

  // ── LOBBY ──
  if (!joined) {
    return (
      <div className="lobby-wrapper">
        <div className="logo">
          <span style={{ fontSize: "2.8rem" }}>🎨</span>
          <h1>Scribble</h1>
        </div>

        <div className="lobby-card">
          <input
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button className="btn btn-primary" onClick={createRoom} disabled={!connected}>
            🎮 Create Room
          </button>

          <div className="divider">or join</div>

          <input
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          <button className="btn btn-secondary" onClick={joinRoom} disabled={!connected}>
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // ── GAME ──
  const sortedPlayers = [...players];
  const allPlayers = sortedPlayers.length > 0 ? sortedPlayers : Object.keys(scores);

  return (
    <div className="game-wrapper">
      {/* ── LEFT: Players + Scores ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="panel">
          <div className="game-logo">🎨 Scribble</div>
        </div>

        <div className="panel">
          <div className="panel-title">Players</div>
          <ul className="player-list">
            {allPlayers.map((p, i) => (
              <li className="player-item" key={i}>
                <div className={`player-avatar ${avatarColors[i % avatarColors.length]}`}>
                  {getInitials(p)}
                </div>
                <span className="player-name">{p}</span>
                <span className="player-score">{scores[p] ?? 0}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── CENTER: Canvas ── */}
      <div className="center-panel">
        {/* Top bar */}
        <div className="top-bar">
          <div className="room-code-badge">
            🎯 Room: <span>{roomCode}</span>
          </div>

          <div className="word-display">
            <div className="word-label">Current Word</div>
            <div className="word-value">{currentWord || "Waiting..."}</div>
          </div>

          <button
            className="btn btn-secondary copy-btn"
            onClick={() => navigator.clipboard.writeText(roomCode)}
          >
            📋 Copy
          </button>
        </div>

        {/* Canvas board */}
        <div className="canvas-board">
          <canvas
            ref={canvasRef}
            width={700}
            height={430}
            className="canvas"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />

          {/* Toolbar */}
          <div className="toolbar">
            {/* Colors */}
            <div className="toolbar-section">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={`color-btn ${activeColor === c && !isEraser ? "active" : ""}`}
                  style={{ background: c, border: c === "#ffffff" ? "2px solid #ccc" : undefined }}
                  onClick={() => { setColor(c); }}
                  title={c}
                />
              ))}
            </div>

            <div className="toolbar-sep" />

            {/* Sizes */}
            <div className="toolbar-section">
              {SIZES.map((s, i) => (
                <div
                  key={s.label}
                  className={`size-btn ${s.cls} ${activeSize === i ? "active" : ""}`}
                  style={{ background: isEraser ? "#ccc" : activeColor === "#ffffff" ? "#aaa" : activeColor }}
                  onClick={() => setSize(i)}
                  title={`${s.label} brush`}
                />
              ))}
            </div>

            <div className="toolbar-sep" />

            {/* Tools */}
            <div className="toolbar-section" style={{ gap: "6px" }}>
              <button
                className={`tool-btn ${isEraser ? "eraser-active" : ""}`}
                onClick={() => toggleEraser()}
              >
                {isEraser ? "✏️ Pen" : "🧹 Eraser"}
              </button>
              <button className="tool-btn" onClick={clearBoard}>🗑️ Clear</button>
            </div>

            <div className="toolbar-sep" />

            {/* Word setter (drawer only) */}
            {isDrawer && (
              <div className="word-setter">
                <input
                  placeholder="Type word to set..."
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendWord()}
                />
                <button className="btn btn-primary" style={{ padding: "8px 14px", fontSize: "0.85rem" }} onClick={sendWord}>
                  Set
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Become drawer */}
        <button className="drawer-btn" onClick={becomeDrawer}>
          ✏️ Become Drawer
        </button>
      </div>

      {/* ── RIGHT: Chat / Guesses ── */}
      <div className="chat-panel">
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-title">💬 Guesses</div>
          <div className="chat-messages">
            {chat.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.type}`}>
                {msg.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="chat-input-row">
            <input
              placeholder="Type your guess..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendGuess()}
            />
            <button className="btn btn-primary" style={{ padding: "10px 16px" }} onClick={sendGuess}>
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}