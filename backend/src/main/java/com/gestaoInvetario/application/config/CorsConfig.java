package com.gestaoInvetario.application.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(@NonNull CorsRegistry registry) {
        // Em producao o frontend chama a API pelo proxy /api (mesma origem); CORS cobre acessos diretos.
        registry.addMapping("/**")
            .allowedOriginPatterns("http://localhost:3000", "http://localhost:3100",
                    "https://*.onrender.com", "https://*.netlify.app")
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .exposedHeaders("Content-Disposition");
    }
}
