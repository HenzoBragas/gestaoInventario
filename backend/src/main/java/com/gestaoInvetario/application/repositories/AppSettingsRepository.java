package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.AppSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingsRepository extends JpaRepository<AppSettings, Integer> {
}
