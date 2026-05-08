package com.hermes.service;

import com.hermes.entity.User;
import com.hermes.exception.AppException;
import com.hermes.exception.AppException.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Serviço de validação de complexidade de senhas do HERMES.
 *
 * <p>Centraliza todas as regras de negócio relacionadas à qualidade de senhas,
 * garantindo que as mesmas regras sejam aplicadas tanto na troca de primeiro
 * acesso quanto em futuras telas de alteração de senha.</p>
 *
 * <p>Regras validadas:</p>
 * <ul>
 *   <li>Mínimo de 6 caracteres</li>
 *   <li>Pelo menos 1 letra maiúscula</li>
 *   <li>Pelo menos 1 letra minúscula</li>
 *   <li>Pelo menos 1 número</li>
 *   <li>Pelo menos 1 caractere especial</li>
 *   <li>Não pode conter sequências numéricas crescentes ou decrescentes (ex: 1234, 4321)</li>
 *   <li>Não pode conter sequências de caracteres repetidos (ex: aaa, 111)</li>
 *   <li>Não pode conter partes do nome do usuário (case-insensitive, min 3 chars)</li>
 *   <li>Não pode ser igual à senha atual (verificada via bcrypt)</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordValidationService {

    /** Tamanho mínimo de fragmento do nome considerado proibido na senha. */
    private static final int MIN_NAME_FRAGMENT_LENGTH = 3;

    /** Tamanho mínimo de sequência numérica proibida (crescente ou decrescente). */
    private static final int SEQUENTIAL_SEQUENCE_LENGTH = 4;

    private static final Pattern HAS_UPPERCASE    = Pattern.compile("[A-Z]");
    private static final Pattern HAS_LOWERCASE    = Pattern.compile("[a-z]");
    private static final Pattern HAS_DIGIT        = Pattern.compile("\\d");
    private static final Pattern HAS_SPECIAL      = Pattern.compile("[^A-Za-z0-9]");

    private final PasswordEncoder passwordEncoder;

    /**
     * Valida a nova senha contra todas as regras de complexidade.
     *
     * <p>Lança {@link AppException} com código {@code PASSWORD_POLICY_VIOLATION}
     * contendo a lista de todas as violações encontradas (não para na primeira).</p>
     *
     * @param newPassword     senha em texto puro a validar.
     * @param user            entidade do usuário (para checar nome e senha atual).
     * @param currentPassword senha atual em texto puro (para verificação de reutilização).
     */
    public void validate(String newPassword, User user, String currentPassword) {
        List<String> violations = new ArrayList<>();

        // ── Comprimento mínimo ────────────────────────────────────────────
        if (newPassword.length() < 6) {
            violations.add("A senha deve ter no mínimo 6 caracteres.");
        }

        // ── Complexidade ──────────────────────────────────────────────────
        if (!HAS_UPPERCASE.matcher(newPassword).find()) {
            violations.add("A senha deve conter pelo menos 1 letra maiúscula.");
        }
        if (!HAS_LOWERCASE.matcher(newPassword).find()) {
            violations.add("A senha deve conter pelo menos 1 letra minúscula.");
        }
        if (!HAS_DIGIT.matcher(newPassword).find()) {
            violations.add("A senha deve conter pelo menos 1 número.");
        }
        if (!HAS_SPECIAL.matcher(newPassword).find()) {
            violations.add("A senha deve conter pelo menos 1 caractere especial (ex: @, !, #, $).");
        }

        // ── Sequências numéricas ──────────────────────────────────────────
        if (hasNumericSequence(newPassword)) {
            violations.add("A senha não pode conter sequências numéricas (ex: 1234, 4321).");
        }

        // ── Caracteres repetidos ──────────────────────────────────────────
        if (hasRepeatedChars(newPassword)) {
            violations.add("A senha não pode conter caracteres repetidos consecutivos (ex: aaa, 111).");
        }

        // ── Partes do nome do usuário ─────────────────────────────────────
        if (containsNamePart(newPassword, user.getName())) {
            violations.add("A senha não pode conter partes do seu nome.");
        }

        // ── Igual à senha atual ───────────────────────────────────────────
        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            violations.add("A nova senha não pode ser igual à senha atual.");
        }

        if (!violations.isEmpty()) {
            throw AppException.passwordPolicyViolation(violations);
        }
    }

    // -------------------------------------------------------------------------
    // Verificações privadas
    // -------------------------------------------------------------------------

    /**
     * Verifica se a senha contém sequência numérica crescente ou decrescente
     * de tamanho {@value #SEQUENTIAL_SEQUENCE_LENGTH} ou mais.
     *
     * @param password senha a verificar.
     * @return {@code true} se contiver sequência proibida.
     */
    private boolean hasNumericSequence(String password) {
        int consecutiveAsc = 1;
        int consecutiveDesc = 1;

        for (int i = 1; i < password.length(); i++) {
            char prev = password.charAt(i - 1);
            char curr = password.charAt(i);

            if (Character.isDigit(prev) && Character.isDigit(curr)) {
                if (curr - prev == 1) {
                    consecutiveAsc++;
                    if (consecutiveAsc >= SEQUENTIAL_SEQUENCE_LENGTH) return true;
                } else {
                    consecutiveAsc = 1;
                }

                if (prev - curr == 1) {
                    consecutiveDesc++;
                    if (consecutiveDesc >= SEQUENTIAL_SEQUENCE_LENGTH) return true;
                } else {
                    consecutiveDesc = 1;
                }
            } else {
                consecutiveAsc = 1;
                consecutiveDesc = 1;
            }
        }
        return false;
    }

    /**
     * Verifica se a senha contém 3 ou mais caracteres idênticos consecutivos.
     *
     * @param password senha a verificar.
     * @return {@code true} se contiver repetição proibida.
     */
    private boolean hasRepeatedChars(String password) {
        int count = 1;
        for (int i = 1; i < password.length(); i++) {
            if (password.charAt(i) == password.charAt(i - 1)) {
                count++;
                if (count >= 3) return true;
            } else {
                count = 1;
            }
        }
        return false;
    }

    /**
     * Verifica se a senha contém algum fragmento do nome do usuário
     * com {@value #MIN_NAME_FRAGMENT_LENGTH} ou mais caracteres (case-insensitive).
     *
     * <p>O nome é dividido por espaços e cada parte é verificada individualmente.
     * Fragmentos com menos de {@value #MIN_NAME_FRAGMENT_LENGTH} caracteres são ignorados.</p>
     *
     * @param password senha a verificar.
     * @param fullName nome completo do usuário.
     * @return {@code true} se contiver fragmento do nome.
     */
    private boolean containsNamePart(String password, String fullName) {
        if (fullName == null || fullName.isBlank()) return false;

        String passwordLower = password.toLowerCase();
        String[] nameParts = fullName.trim().toLowerCase().split("\\s+");

        for (String part : nameParts) {
            if (part.length() >= MIN_NAME_FRAGMENT_LENGTH && passwordLower.contains(part)) {
                return true;
            }
        }
        return false;
    }
}