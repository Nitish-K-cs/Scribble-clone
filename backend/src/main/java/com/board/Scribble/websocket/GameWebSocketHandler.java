package com.board.Scribble.websocket;

import java.util.ArrayList;
import java.util.HashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.board.Scribble.Service.RoomService;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.*;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

    private final Map<String, List<WebSocketSession>> roomSessions = new HashMap<>();

    @Autowired
    private RoomService roomService;

    @Override
    public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {

        ObjectMapper mapper = new ObjectMapper();
        JsonNode node = mapper.readTree(message.getPayload());

        String type = node.get("type").asText();
        String roomCode = node.get("roomCode").asText();

        if (type.equals("JOIN")) {
            roomSessions.computeIfAbsent(roomCode, k -> new ArrayList<>()).add(session);
        }

        if (type.equals("WORD")) {
            String word = node.get("word").asText();

            roomService.setWord(roomCode, word);

            // broadcast to all
            for (WebSocketSession s : roomSessions.get(roomCode)) {
                s.sendMessage(new TextMessage(
                    "{\"type\":\"WORD\",\"word\":\"" + word + "\"}"
                ));
            }
        }
    }
}
