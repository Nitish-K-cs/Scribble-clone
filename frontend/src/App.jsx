import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

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


// 🚪 Create room

  const createRoom = async () => {
    if (!username) return alert("Enter username");

    const res = await fetch("http://localhost:8080/api/rooms/create", {
      method: "POST",
    });

    const data = await res.json();

    console.log("Created Room:", data.roomCode); // debug

    setRoomCode(data.roomCode);

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    
    socketRef.current.send(
      JSON.stringify({
        type: "JOIN",
        roomCode: data.roomCode,
        username,
      })
    );

    setJoined(true);
  };

    
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

      if (data.type === "ERROR") {
        alert(data.message);
        setJoined(false);
      }

      if (data.type === "PLAYERS") {
        setPlayers(data.players);
      }

     if (data.type === "WORD") {
        setCurrentWord(data.word);

        // if not ???? → you're drawer
        if (data.word !== "????") {
          setIsDrawer(true);
        } else {
          setIsDrawer(false);
        }
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

      if (data.type === "CHAT") {
        setChat((prev) => [...prev, `${data.username}: ${data.message}`]);
      }

      if (data.type === "CORRECT_GUESS") {
        setChat((prev) => [...prev, `🎉 ${data.username} guessed correctly!`]);
      }

      if (data.type === "SCORES") {
        console.log("Scores received:", data.scores); // debug
        setScores(data.scores);
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
      if (!isDrawer) return;

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

    const draw = (e) => {
      if (!isDrawing.current || !isDrawer) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const ctx = canvasRef.current.getContext("2d");

      ctx.lineTo(x, y);
      ctx.stroke();

      socketRef.current.send(
        JSON.stringify({
          type: "DRAW",
          roomCode,
          x,
          y,
        })
      );
   };



  const stopDrawing = () => {
  isDrawing.current = false;

  socketRef.current.send(
    JSON.stringify({
      type: "DRAW_END",
      roomCode,
    })
  );

  const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath(); // important
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

  const sendGuess = () => {
  if (!guess.trim()) return;

  socketRef.current.send(
    JSON.stringify({
        type: "CHAT",
        roomCode,
        message: guess,
      })
    );

    setGuess("");
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

        <div className="buttons">
          <button onClick={createRoom} disabled={!connected}>
            🎮 Create Room
          </button>
        </div>

        <hr />

        <input
          placeholder="Enter Room Code"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
        />

        <button onClick={joinRoom} disabled={!connected}>
          Join Room
        </button>
      </div>
    ) : (
      <div className="game">
        {/* LEFT PANEL */}
        <div className="left">
          <h2>Players</h2>
          <ul>
            {players.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>

          <h2>Scoreboard</h2>
          <ul>
            {Object.entries(scores)
              .sort((a, b) => b[1] - a[1]) // 🔥 optional sorting
              .map(([player, score]) => (
                <li key={player}>
                  {player}: {score}
                </li>
              ))}
          </ul>
        </div>
        {/* CENTER PANEL */}
        <div className="center">

          {/* ✅ ROOM CODE DISPLAY */}
          <div className="room-info">
            <h3>🎯 Room Code: {roomCode}</h3>
            <button
              onClick={() => navigator.clipboard.writeText(roomCode)}
            >
              Copy
            </button>
          </div>

          <h2>Current Word</h2>
          <div className="word-box">{currentWord || "Waiting..."}</div>

          <button
            onClick={() => {
              socketRef.current.send(
                JSON.stringify({
                  type: "BECOME_DRAWER",
                  roomCode,
                })
              );
            }}
          >
            ✏️ Can Draw
          </button>

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

            <div className="chat-box">
                <div className="messages">
                  {chat.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>

                <div className="chat-input">
                  <input
                    placeholder="Type your guess..."
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                  />
                  <button onClick={sendGuess}>Send</button>
                </div>
              </div>
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