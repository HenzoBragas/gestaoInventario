package com.gestaoInvetario.application.controllers;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Verificacao de disponibilidade (publica): usada por monitores e pelo keep-alive do plano gratuito. */
@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "timestamp", Instant.now());
    }
}
