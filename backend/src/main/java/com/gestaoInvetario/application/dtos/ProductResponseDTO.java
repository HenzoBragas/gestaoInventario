package com.gestaoInvetario.application.dtos;

import java.util.Date;

public record ProductResponseDTO(Integer seq, String id, String name, String model, String category, Integer stock, Date changeDate) {
}
