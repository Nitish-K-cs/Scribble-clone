import { useState, useEffect, useRef } from 'react';

function App() {
  const [word, setWord] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = new WebSocket("ws://localhost:8080/ws/game");
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "JOIN",
        roomCode: "ABC123"
      }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(data);
    };

    return () => socket.close();
  }, []);

  const sendWord = () => {
    socketRef.current.send(JSON.stringify({
      type: "WORD",
      roomCode: "ABC123",
      word: word
    }));
  };

  return (
    <div>
      <input 
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Enter word"
      />
      <button onClick={sendWord}>Send</button>
    </div>
  );
}

export default App;