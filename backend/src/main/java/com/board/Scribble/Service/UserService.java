package com.board.Scribble.Service;

import com.board.Scribble.Entity.User;
import com.board.Scribble.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public User register(String username, String password) {
        Optional<User> existingUser = userRepository.findByUsername(username);
        
        if (existingUser.isPresent()) {
            throw new RuntimeException("Username already exists");
        }

        User user = new User();
        user.setUsername(username);
        user.setPassword(passwordEncoder.encode(password));
        user.setTotalScore(0);
        user.setGamesPlayed(0);
        
        return userRepository.save(user);
    }

    public Optional<User> findByUsername(String username) {
        return userRepository.findByUsername(username);
    }

    public User getOrCreateUser(String username) {
        return userRepository.findByUsername(username)
                .orElseGet(() -> {
                    User newUser = new User();
                    newUser.setUsername(username);
                    newUser.setPassword(passwordEncoder.encode("default"));
                    newUser.setTotalScore(0);
                    newUser.setGamesPlayed(0);
                    return userRepository.save(newUser);
                });
    }

    public User updateScore(String username, int scoreToAdd) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        user.setTotalScore(user.getTotalScore() + scoreToAdd);
        user.setGamesPlayed(user.getGamesPlayed() + 1);
        
        return userRepository.save(user);
    }

    public List<User> getLeaderboard() {
        return userRepository.findAll()
                .stream()
                .sorted((a, b) -> Integer.compare(b.getTotalScore(), a.getTotalScore()))
                .limit(10)
                .toList();
    }

    public User getProfile(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}