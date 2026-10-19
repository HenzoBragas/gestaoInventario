package com.gestaoInvetario.application.exception;

import java.util.Map;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Erro de negocio com status HTTP, codigo estavel (para o frontend) e mensagem legivel. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", what + " não encontrado(a).");
    }

    public static ApiException conflict(String code, String message, String field) {
        return new ApiException(HttpStatus.CONFLICT, code, message, field == null ? Map.of() : Map.of(field, message));
    }

    public static ApiException unprocessable(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    public static ApiException unprocessable(String code, String message, String field) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, Map.of(field, message));
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}
