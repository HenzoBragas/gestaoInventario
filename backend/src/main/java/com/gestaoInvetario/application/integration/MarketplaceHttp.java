package com.gestaoInvetario.application.integration;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** Utilitarios compartilhados pelos clientes dos marketplaces. */
final class MarketplaceHttp {

    private MarketplaceHttp() {
    }

    /** Cliente com timeouts curtos: uma API lenta nao pode prender as threads do worker. */
    static RestClient client(RestClient.Builder builder, String baseUrl) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(20));
        return builder.clone().baseUrl(baseUrl).requestFactory(factory).build();
    }

    static String hmacSha256Hex(String key, String message) {
        if (key == null) {
            throw new MarketplaceException("Chave de assinatura nao configurada.");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(message.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank() && !"null".equals(value)) {
                return value.trim();
            }
        }
        return null;
    }
}
