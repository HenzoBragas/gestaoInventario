package com.gestaoInvetario.application.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.gestaoInvetario.application.exception.GlobalExceptionHandler;
import com.gestaoInvetario.application.security.TokenService;
import com.gestaoInvetario.application.security.UserAuthenticationConverter;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Autorizacao por papel verificada no servidor. Hierarquia:
 * VIEWER (leitura) < OPERATOR (+entradas, saidas, transferencias)
 * < MANAGER (+cadastros e ajustes) < ADMIN (+usuarios e configuracoes).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] CATALOG = {"/products/**", "/categories/**", "/suppliers/**", "/locations/**", "/invoices/**"};

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, UserAuthenticationConverter converter,
                                           ObjectMapper mapper) throws Exception {
        http
                .csrf(csrf -> csrf.disable()) // API stateless com Bearer token (sem cookies de sessao)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/health").permitAll()
                        .requestMatchers("/users/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/settings").hasRole("ADMIN")
                        .requestMatchers("/audit/**").hasAnyRole("MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/movements").hasAnyRole("OPERATOR", "MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, CATALOG).hasAnyRole("MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, CATALOG).hasAnyRole("MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, CATALOG).hasAnyRole("MANAGER", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, CATALOG).hasAnyRole("MANAGER", "ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(converter))
                        .authenticationEntryPoint((request, response, ex) ->
                                writeError(response, mapper, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                                        "Sessão expirada ou inválida. Entre novamente.")))
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint((request, response, ex) ->
                                writeError(response, mapper, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                                        "Autenticação necessária."))
                        .accessDeniedHandler((request, response, ex) ->
                                writeError(response, mapper, HttpStatus.FORBIDDEN, "FORBIDDEN",
                                        "Seu perfil não tem permissão para esta operação.")));
        return http.build();
    }

    @Bean
    public JwtDecoder jwtDecoder(TokenService tokens) {
        return tokens.decoder();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    private static void writeError(HttpServletResponse response, ObjectMapper mapper, HttpStatus status,
                                   String code, String message) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        mapper.writeValue(response.getOutputStream(), GlobalExceptionHandler.body(status, code, message, Map.of()));
    }
}
