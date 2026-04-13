import { useEffect, useRef, useState } from "react";
import "./App.css";

function App() {
  const socketRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("ABC123");
  const [players, setPlayers] = useState([]);
  const [word, setWord] = useState("");
  const [currentWord, setCurrentWord] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws/game");
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected ✅");
      setConnected(true);
    };

    socket.onmessage = (event) => {
      console.log("RAW MESSAGE:", event.data); // 🔥 add this

      const data = JSON.parse(event.data);

      console.log("PARSED:", data); // 🔥 add this

      if (data.type === "PLAYERS") {
        setPlayers(data.players);
      }

      if (data.type === "WORD") {
        console.log("SETTING WORD:", data.word); // 🔥
        setCurrentWord(data.word);
      }
    };

    return () => socket.close();
  }, []);

  const joinRoom = () => {
    if (!username) return alert("Enter username");

    socketRef.current.send(
      JSON.stringify({
        type: "JOIN",
        roomCode: roomCode,
        username: username,
      })
    );

    setJoined(true);
  };

  const sendWord = () => {
    socketRef.current.send(
      JSON.stringify({
        type: "SET_WORD",
        roomCode: roomCode,
        word: word,
      })
    );
    setWord("");
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

            <div className="input-area">
              <input
                placeholder="Type word..."
                value={word}
                onChange={(e) => setWord(e.target.value)}
              />
              <button onClick={sendWord}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;