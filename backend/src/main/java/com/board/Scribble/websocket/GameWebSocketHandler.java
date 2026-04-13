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

                sessionUsernameMap.put(session, username);

                roomSessions
                        .computeIfAbsent(roomCode, k -> new ArrayList<>())
                        .add(session);

                roomPlayers
                        .computeIfAbsent(roomCode, k -> new ArrayList<>())
                        .add(username);

                System.out.println(username + " joined room: " + roomCode);

                broadcastPlayers(roomCode);
            }

            // ✅ SET WORD
            else if (type.equals("SET_WORD")) {

                String word = node.get("word").asText();

                roomService.setWord(roomCode, word);

                System.out.println("Word set: " + word);

                broadcastWord(roomCode, word);
            }

        } catch (Exception e) {
            e.printStackTrace();
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