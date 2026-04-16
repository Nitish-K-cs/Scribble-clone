package com.board.Scribble.websocket;

import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.board.Scribble.Service.RoomService;

// ✅ Correct import
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final List<String> words = Arrays.asList("dog", "cat", "boat");
    private final Map<String, String> roomDrawer = new HashMap<>();
    private final Map<String, List<WebSocketSession>> roomSessions = new HashMap<>();
    private final Map<WebSocketSession, String> sessionUsernameMap = new HashMap<>();
    private final Map<String, List<String>> roomPlayers = new HashMap<>();

    @Autowired
    private RoomService roomService;

    private final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        System.out.println("Client connected: " + session.getId());
    }

    

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            JsonNode node = mapper.readTree(message.getPayload());

            String type = node.get("type").asText();
            String roomCode = node.get("roomCode").asText();

            // ✅ JOIN
            if (type.equals("JOIN")) {

                String username = node.get("username").asText();
                
                if (roomService.getRoom(roomCode) == null) {
                    session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"message\":\"Room not found\"}"));
                    return;
                }

                sessionUsernameMap.put(session, username);

                roomSessions.computeIfAbsent(roomCode, k -> new ArrayList<>());
                roomPlayers.computeIfAbsent(roomCode, k -> new ArrayList<>());

                List<WebSocketSession> sessions = roomSessions.get(roomCode);
                List<String> players = roomPlayers.get(roomCode);

                if (!sessions.contains(session)) {
                    sessions.add(session);
                }

                if (!players.contains(username)) {
                    players.add(username);
                }

                if (!roomDrawer.containsKey(roomCode)) {
                    roomDrawer.put(roomCode, username); // first player = host = drawer
                }

                System.out.println(username + " joined room: " + roomCode);
                broadcastPlayers(roomCode);
                
                if (players.size() == 1) {
                     sendWordToDrawer(roomCode);
                }           
            }

            // ✅ SET WORD
            else if (type.equals("SET_WORD")) {

                String word = node.get("word").asText();

                roomService.setWord(roomCode, word);

                System.out.println("Word set: " + word);

                broadcastWord(roomCode, word);
            }
            else if (type.equals("DRAW") || type.equals("DRAW_START") || type.equals("DRAW_END")) {

                List<WebSocketSession> sessions = roomSessions.get(roomCode);

                if (sessions != null) {
                    for (WebSocketSession s : sessions) {
                        if (s.isOpen()) {
                            s.sendMessage(new TextMessage(message.getPayload()));
                        }
                    }
                }
            }

            else if (type.equals("CLEAR")) {
                List<WebSocketSession> sessions = roomSessions.get(roomCode);

                if (sessions != null) {
                    for (WebSocketSession s : sessions) {
                        if (s.isOpen()) {
                            // 🔥 forward the same clear message
                            s.sendMessage(new TextMessage(message.getPayload()));
                        }
                    }
                }
            }
            else if (type.equals("BECOME_DRAWER")) {
                String username = sessionUsernameMap.get(session);
                roomDrawer.put(roomCode, username);
                System.out.println(username + " is now drawing");
                sendWordToDrawer(roomCode);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    private void sendWordToDrawer(String roomCode) throws Exception 
    {
        String word = words.get(new Random().nextInt(words.size()));

        roomService.setWord(roomCode, word);

        List<WebSocketSession> sessions = roomSessions.get(roomCode);

        for (WebSocketSession s : sessions) {

            String user = sessionUsernameMap.get(s);

            Map<String, Object> response = new HashMap<>();

            if (user.equals(roomDrawer.get(roomCode))) {
                // ✅ Drawer sees actual word
                response.put("type", "WORD");
                response.put("word", word);
            } else {
                // ❌ Others see blank / hint
                response.put("type", "WORD");
                response.put("word", "????");
            }

            s.sendMessage(new TextMessage(mapper.writeValueAsString(response)));
        }
    }

    // ✅ Broadcast player list
    private void broadcastPlayers(String roomCode) throws Exception {

        List<WebSocketSession> sessions = roomSessions.get(roomCode);
        List<String> players = roomPlayers.get(roomCode);

        if (sessions == null || players == null) return;

        Map<String, Object> response = new HashMap<>();
        response.put("type", "PLAYERS");
        response.put("players", players);

        String json = mapper.writeValueAsString(response);

        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(json));
            }
        }
    }

    // ✅ Broadcast word
    private void broadcastWord(String roomCode, String word) throws Exception {

        List<WebSocketSession> sessions = roomSessions.get(roomCode);
        if (sessions == null) return;

        Map<String, Object> response = new HashMap<>();
        response.put("type", "WORD");
        response.put("word", word);

        String json = mapper.writeValueAsString(response);

        for (WebSocketSession s : sessions) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(json));
            }
        }
    }

    // ✅ Handle disconnect
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {

        String username = sessionUsernameMap.get(session);
        sessionUsernameMap.remove(session);

        for (String roomCode : roomSessions.keySet()) {

            List<WebSocketSession> sessions = roomSessions.get(roomCode);
            List<String> players = roomPlayers.get(roomCode);

            if (sessions != null) {
                sessions.remove(session);
            }

            if (players != null && username != null) {
                players.remove(username);
            }

            try {
                broadcastPlayers(roomCode);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        System.out.println("Disconnected: " + username);
    }
}