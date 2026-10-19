package com.gestaoInvetario.application.repositories;

import com.gestaoInvetario.application.model.AppUser;
import com.gestaoInvetario.application.model.Role;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Integer> {

    Optional<AppUser> findByUsernameIgnoreCase(String username);

    Optional<AppUser> findByEmailIgnoreCase(String email);

    long countByRoleAndActiveTrue(Role role);
}
