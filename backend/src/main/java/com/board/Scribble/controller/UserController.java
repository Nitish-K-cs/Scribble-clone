package com.board.Scribble.controller;

import com.board.Scribble.Entity.User;
import com.board.Scribble.Service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfile(Authentication authentication) {
        String username = authentication.getName();
        try {
            User user = userService.getProfile(username);
            return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "totalScore", user.getTotalScore(),
                "gamesPlayed", user.getGamesPlayed()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/score")
    public ResponseEntity<?> updateScore(@RequestBody Map<String, Object> request, Authentication authentication) {
        String username = authentication.getName();
        int score = request.get("score") != null ? (int) request.get("score") : 10;
        
        try {
            User user = userService.updateScore(username, score);
            return ResponseEntity.ok(Map.of(
                "username", user.getUsername(),
                "totalScore", user.getTotalScore(),
                "gamesPlayed", user.getGamesPlayed()
            ));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/leaderboard")
    public ResponseEntity<List<User>> getLeaderboard() {
        return ResponseEntity.ok(userService.getLeaderboard());
    }
}