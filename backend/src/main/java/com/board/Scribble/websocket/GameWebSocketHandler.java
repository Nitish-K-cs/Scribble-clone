package com.board.Scribble.websocket;

import java.util.*;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.board.Scribble.Service.RoomService;
import com.board.Scribble.Service.UserService;

// ✅ Correct import
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import com.board.Scribble.config.JwtUtil;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final List<String> words = Arrays.asList("dog", "cat", "boat");
    private final Map<String, String> roomDrawer = new HashMap<>();
    private final Map<String, List<WebSocketSession>> roomSessions = new HashMap<>();
    private final Map<WebSocketSession, String> sessionUsernameMap = new HashMap<>();
    private final Map<WebSocketSession, Boolean> sessionIsRegisteredMap = new HashMap<>();
    private final Map<String, List<String>> roomPlayers = new HashMap<>();
    private final Map<String, List<String>> roomPlayersOrder = new HashMap<>();
    private final Map<String, Integer> roomTurnIndex = new HashMap<>();
    private final Map<String, Map<String, Integer>> roomScores = new HashMap<>();

    @Autowired
    private RoomService roomService;

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

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
                String token = node.has("token") ? node.get("token").asText() : null;
                
                // Check if user is registered (has valid token)
                boolean isRegistered = false;
                if (token != null && !token.isEmpty()) {
                    try {
                        if (jwtUtil.validateToken(token)) {
                            isRegistered = true;
                        }
                    } catch (Exception e) {
                        // Invalid token, treat as guest
                        isRegistered = false;
                    }
                }
                
                if (roomService.getRoom(roomCode) == null) {
                    session.sendMessage(new TextMessage("{\"type\":\"ERROR\",\"message\":\"Room not found\"}"));
                    return;
                }

                roomPlayersOrder.computeIfAbsent(roomCode, k -> new ArrayList<>());
                roomScores.computeIfAbsent(roomCode, k -> new HashMap<>());

                List<String> order = roomPlayersOrder.get(roomCode);
                Map<String, Integer> scores = roomScores.get(roomCode);

                if (!order.contains(username)) {
                    order.add(username);
                }

                scores.putIfAbsent(username, 0);

                roomTurnIndex.putIfAbsent(roomCode, 0);
                sessionUsernameMap.put(session, username);
                sessionIsRegisteredMap.put(session, isRegistered);

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

            else if (type.equals("CHAT")) {

                String messageText = node.get("message").asText();
                String username = sessionUsernameMap.get(session);

                // ❌ Prevent drawer from guessing
                if (username.equals(roomDrawer.get(roomCode))) {
                    return;
                }

                String actualWord = roomService.getRoom(roomCode).getCurrentWord();

                Map<String, Object> response = new HashMap<>();

                // 🎯 Correct Guess
                if (messageText.equalsIgnoreCase(actualWord)) {

                    Map<String, Integer> scores = roomScores.get(roomCode);

                    if (scores == null) {
                        scores = new HashMap<>();
                        roomScores.put(roomCode, scores);
                    }

                    // 🎯 Give points
                    scores.put(username, scores.getOrDefault(username, 0) + 10);

                    // Only update database for registered users (not guests)
                    Boolean isRegistered = sessionIsRegisteredMap.get(session);
                    if (isRegistered != null && isRegistered) {
                        try {
                            userService.updateScore(username, 10);
                            System.out.println("Updated database score for registered user: " + username);
                        } catch (Exception e) {
                            System.err.println("Failed to update user score: " + e.getMessage());
                        }
                    }

                    response.put("type", "CORRECT_GUESS");
                    response.put("username", username);

                    String json = mapper.writeValueAsString(response);

                    for (WebSocketSession s : roomSessions.get(roomCode)) {
                        if (s.isOpen()) {
                            s.sendMessage(new TextMessage(json));
                        }
                    }

                    // 🔁 Move to next turn
                    nextTurn(roomCode);

                } else {
                    response.put("type", "CHAT");
                    response.put("username", username);
                    response.put("message", messageText);

                    String json = mapper.writeValueAsString(response);

                    for (WebSocketSession s : roomSessions.get(roomCode)) {
                        if (s.isOpen()) {
                            s.sendMessage(new TextMessage(json));
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


    private void nextTurn(String roomCode) throws Exception {

        List<String> players = roomPlayersOrder.get(roomCode);
        if (players == null || players.isEmpty()) return;

        int index = roomTurnIndex.getOrDefault(roomCode, 0);
        index = (index + 1) % players.size();
        roomTurnIndex.put(roomCode, index);

        String nextDrawer = players.get(index);
        roomDrawer.put(roomCode, nextDrawer);

        System.out.println("Next drawer: " + nextDrawer);

        sendWordToDrawer(roomCode);
        broadcastScores(roomCode);
    }


    private void broadcastScores(String roomCode) throws Exception {

        Map<String, Integer> scores = roomScores.get(roomCode);

        Map<String, Object> response = new HashMap<>();
        response.put("type", "SCORES");
        response.put("scores", scores);

        String json = mapper.writeValueAsString(response);

        for (WebSocketSession s : roomSessions.get(roomCode)) {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage(json));
            }
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