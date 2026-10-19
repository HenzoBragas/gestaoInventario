package com.gestaoInvetario.application.security;

import com.gestaoInvetario.application.model.AppUser;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/** Emissao e validacao de tokens JWT (HS256) com segredo vindo da variavel JWT_SECRET. */
@Service
public class TokenService {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    public static final String ISSUER = "gestao-inventario";

    public record IssuedToken(String token, Instant expiresAt) {
    }

    private final SecretKey key;
    private final JwtEncoder encoder;
    private final JwtDecoder decoder;
    private final Duration sessionTtl;
    private final Duration rememberTtl;

    public TokenService(@Value("${app.jwt.secret:}") String secret,
                        @Value("${app.jwt.session-hours:12}") long sessionHours,
                        @Value("${app.jwt.remember-days:7}") long rememberDays) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            // Sem segredo configurado: gera um aleatorio. Funciona, mas as sessoes caem a cada reinicio.
            log.warn("JWT_SECRET ausente ou com menos de 32 bytes: usando segredo aleatorio temporario.");
            bytes = new byte[32];
            new SecureRandom().nextBytes(bytes);
        }
        this.key = new SecretKeySpec(bytes, "HmacSHA256");
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        this.decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        this.sessionTtl = Duration.ofHours(sessionHours);
        this.rememberTtl = Duration.ofDays(rememberDays);
    }

    public IssuedToken issue(AppUser user, boolean remember) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(remember ? rememberTtl : sessionTtl);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .issuedAt(now)
                .expiresAt(expiresAt)
                .subject(user.getUsername())
                .claim("uid", user.getId())
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        return new IssuedToken(token, expiresAt);
    }

    public JwtDecoder decoder() {
        return decoder;
    }
}
