-- ============================================================
-- V1__create_celulas_and_update_users.sql
-- HERMES — Migration v1: Células, matrícula e cargo
-- Flyway executa este script automaticamente no startup.
-- ============================================================

-- 1. Criar tabela celulas
CREATE TABLE IF NOT EXISTS celulas (
    id         UUID         NOT NULL DEFAULT gen_random_uuid(),
    nome       VARCHAR(100) NOT NULL,
    gestor_id  UUID,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_celulas PRIMARY KEY (id),
    CONSTRAINT uq_celulas_nome UNIQUE (nome)
);

CREATE INDEX IF NOT EXISTS idx_celula_nome ON celulas (nome);

-- 2. FK celulas.gestor_id → users.id (SET NULL ao excluir o gestor)
ALTER TABLE celulas
    DROP CONSTRAINT IF EXISTS fk_celulas_gestor;

ALTER TABLE celulas
    ADD CONSTRAINT fk_celulas_gestor
    FOREIGN KEY (gestor_id) REFERENCES users (id)
    ON DELETE SET NULL;

-- 3. Adicionar colunas novas em users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS matricula  INTEGER,
    ADD COLUMN IF NOT EXISTS cargo      VARCHAR(100),
    ADD COLUMN IF NOT EXISTS celula_id  UUID;

-- 4. Índice único na matrícula (permite NULL por enquanto — populado abaixo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_matricula ON users (matricula);

-- 5. FK users.celula_id → celulas.id (SET NULL ao excluir a célula)
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS fk_users_celula;

ALTER TABLE users
    ADD CONSTRAINT fk_users_celula
    FOREIGN KEY (celula_id) REFERENCES celulas (id)
    ON DELETE SET NULL;

-- 6. Popular matrícula nos usuários existentes que ainda não têm
--    (começa em 10000, incrementa 1 por ordem de criação)
WITH ranked AS (
    SELECT id,
           9999 + ROW_NUMBER() OVER (ORDER BY created_at ASC) AS nova_matricula
    FROM users
    WHERE matricula IS NULL
)
UPDATE users u
SET matricula = r.nova_matricula
FROM ranked r
WHERE u.id = r.id;

-- 7. Adicionar GESTOR ao enum userrole (idempotente via DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'userrole'
          AND e.enumlabel = 'GESTOR'
    ) THEN
        ALTER TYPE userrole ADD VALUE 'GESTOR';
    END IF;
END$$;