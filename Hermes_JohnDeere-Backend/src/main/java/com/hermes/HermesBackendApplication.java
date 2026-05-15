package com.hermes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Classe principal do HERMES — Sistema Central de Notificações.
 * John Deere / Fatec Indaiatuba Challenge.
 */
@SpringBootApplication
@EnableScheduling
public class HermesBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(HermesBackendApplication.class, args);
    }
}