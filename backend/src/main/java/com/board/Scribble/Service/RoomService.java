package com.board.Scribble.Service;

import org.springframework.stereotype.Service;
import java.util.*;
import com.board.Scribble.Entity.Room;

@Service
public class RoomService {
    
    private final Map<String, Room> rooms = new HashMap<>();

    public Room createRoom(String roomCode) {
        Room room = new Room();
        room.setRoomCode(roomCode);
        rooms.put(roomCode, room);
        return room;
    }

    public Room getRoom(String roomCode) {
        return rooms.get(roomCode);
    }

    public void setWord(String roomCode, String currentWord) {
        Room room = rooms.get(roomCode);
        if (room != null) {
            room.setCurrentWord(currentWord);
        }
    }
}
