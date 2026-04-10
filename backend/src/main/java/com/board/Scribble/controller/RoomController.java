package com.board.Scribble.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.board.Scribble.Service.RoomService;

import com.board.Scribble.Entity.Room;

@RestController
@RequestMapping("/api/rooms")
@CrossOrigin(origins = "http://localhost:5173") 
public class RoomController {
        @Autowired
    private RoomService roomService;

    @PostMapping("/create")
    public Room createRoom() {
        return roomService.createRoom(null);
    }

    @GetMapping("/{code}")
    public Room getRoom(@PathVariable String code) {
        return roomService.getRoom(code);
    }
}
