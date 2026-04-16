package com.board.Scribble.Service;

import org.springframework.stereotype.Service;
import java.util.*;
import com.board.Scribble.Entity.Room;

@Service
public class RoomService {
    
    private final Map<String, Room> rooms = new HashMap<>();

    public Room createRoom() {
        String code = generateRoomCode();

        Room room = new Room();
        room.setRoomCode(code);

        rooms.put(code, room);
        return room;
    }

    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    private String generateRoomCode() {
    String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
    StringBuilder code = new StringBuilder();

    for (int i = 0; i < 6; i++) {
        int index = (int)(Math.random() * chars.length());
        code.append(chars.charAt(index));
    }

    return code.toString();
    }

    public void setWord(String roomCode, String currentWord) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.setCurrentWord(currentWord);
        }
    }
}
