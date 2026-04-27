package com.board.Scribble.controller;

import com.board.Scribble.Service.UserService;
import com.board.Scribble.config.JwtUtil;
import com.board.Scribble.Entity.User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    public AuthController(UserService userService, JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String password = request.get("password");

            User user = userService.register(username, password);
            String token = jwtUtil.generateToken(username);

            return ResponseEntity.ok(Map.of(
                "token", token,
                "username", username
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> request) {
        String username = request.get("username");
        String password = request.get("password");

        User user = userService.findByUsername(username)
                .orElse(null);

        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        }

        // For simplicity, using plain text comparison (in production, use BCrypt)
        if (user.getPassword().equals(password) || 
            new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().matches(password, user.getPassword())) {
            String token = jwtUtil.generateToken(username);
            return ResponseEntity.ok(Map.of(
                "token", token,
                "username", username
            ));
        }

        return ResponseEntity.badRequest().body(Map.of("error", "Invalid credentials"));
    }
}