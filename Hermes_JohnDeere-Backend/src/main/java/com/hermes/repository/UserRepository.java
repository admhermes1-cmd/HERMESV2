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

    // "IsActive" → "Active" — o campo na entidade se chama "active" (sem prefixo is).
    // Spring Data deriva a query do nome do campo, não do getter.
    Page<User> findByRoleAndActiveTrue(UserRole role, Pageable pageable);

    Page<User> findByRoleAndActive(UserRole role, boolean active, Pageable pageable);

    Page<User> findByRole(UserRole role, Pageable pageable);

    Page<User> findByActive(boolean active, Pageable pageable);
}
