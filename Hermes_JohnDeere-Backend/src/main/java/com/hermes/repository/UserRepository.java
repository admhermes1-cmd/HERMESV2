package com.hermes.repository;

import com.hermes.entity.User;
import com.hermes.entity.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findByApiKey(String apiKey);

    boolean existsByEmail(String email);

    Page<User> findByRoleAndIsActiveTrue(UserRole role, Pageable pageable);

    Page<User> findByRoleAndIsActive(UserRole role, boolean isActive, Pageable pageable);

    Page<User> findByRole(UserRole role, Pageable pageable);

    Page<User> findByIsActive(boolean isActive, Pageable pageable);
    // findByEmail duplicado removido — causava erro de compilação:
    // "method findByEmail(String) is already defined in interface UserRepository"
}
