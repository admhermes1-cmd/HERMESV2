import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Send, MapPin, Home, X } from 'lucide-react';

import { useAuth } from '../../core/auth/useAuth';
import { ROUTES } from '../../core/constants/appConstants';
import Button from '../components/common/Button';
import styles from './NotFoundPage.module.css';

/** Duração total do countdown em segundos. */
const COUNTDOWN_DURATION = 5;

/**
 * @component NotFoundPage
 * @description Página 404 standalone do sistema HERMES — exibida quando o usuário
 * tenta acessar uma rota inexistente ou não autorizada.
 *
 * ## Comportamento
 * - Detecta autenticação via `useAuth`:
 *   autenticado → redireciona para Dashboard; não autenticado → Login.
 * - Exibe a rota tentada via `useLocation` para contexto ao usuário.
 * - Countdown automático de 5 s; ao zerar navega para o destino correto.
 * - O usuário pode cancelar o redirect clicando em "Cancelar redirect automático"
 *   — o interval é limpo e não há navegação.
 * - Clicar no botão principal navega imediatamente e limpa o interval.
 * - Foco automático no botão principal ao montar (acessibilidade / UX).
 * - Countdown exposto com `aria-live="polite"` para leitores de tela.
 *
 * ## Limpeza
 * O `setInterval` é sempre limpo no cleanup do `useEffect`, evitando memory leaks.
 */
function NotFoundPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const redirectTo    = isAuthenticated ? ROUTES.DASHBOARD : ROUTES.LOGIN;
  const redirectLabel = isAuthenticated ? 'Ir para o Dashboard' : 'Ir para o Login';

  const [countdown, setCountdown] = useState(COUNTDOWN_DURATION);
  const [cancelled, setCancelled] = useState(false);

  const intervalRef = useRef(null);
  const buttonRef   = useRef(null);

  /** Para o interval sem navegar. */
  const cancelRedirect = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCancelled(true);
  }, []);

  /** Navega imediatamente e cancela o countdown. */
  const handleNavigate = useCallback(() => {
    cancelRedirect();
    navigate(redirectTo);
  }, [cancelRedirect, navigate, redirectTo]);

  /* Foco automático no botão principal ao montar. */
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  /* Countdown de 5 s com redirect automático ao zerar. */
  useEffect(() => {
    if (cancelled) return;

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          navigate(redirectTo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // redirectTo e navigate são estáveis; cancelled controla o re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelled]);

  const progressPercent = (countdown / COUNTDOWN_DURATION) * 100;

  return (
    <div className={styles.page}>

      {/* ── Header mínimo com logo clicável ── */}
      <header className={styles.header}>
        <button
          className={styles.logo}
          onClick={handleNavigate}
          type="button"
          aria-label={`HERMES — ${redirectLabel}`}
        >
          <Send size={20} aria-hidden="true" />
          <span>HERMES</span>
        </button>
      </header>

      {/* ── Conteúdo centralizado ── */}
      <main className={styles.main} role="main">

        {/* Número 404 em tipografia gigante */}
        <p className={styles.code} aria-hidden="true">404</p>

        {/* Ícone de localização */}
        <MapPin className={styles.mapIcon} size={48} aria-hidden="true" />

        <h1 className={styles.title}>Página não encontrada</h1>

        <p className={styles.subtitle}>
          A rota{' '}
          <code className={styles.pathname}>{pathname}</code>
          {' '}não existe ou você não tem permissão para acessá-la.
        </p>

        {/* Countdown — aria-live para leitores de tela */}
        <div
          className={styles.countdownWrapper}
          aria-live="polite"
          aria-atomic="true"
        >
          {cancelled ? (
            <span className={styles.countdownText}>
              Redirect automático cancelado.
            </span>
          ) : (
            <span className={styles.countdownText}>
              Redirecionando em{' '}
              <strong>{countdown}</strong>
              {' '}segundo{countdown !== 1 ? 's' : ''}…
            </span>
          )}
        </div>

        {/* Barra de progresso */}
        <div className={styles.progressTrack} aria-hidden="true">
          <div
            className={styles.progressFill}
            style={{
              width: `${cancelled ? 0 : progressPercent}%`,
              transition: cancelled ? 'none' : 'width 1s linear',
            }}
          />
        </div>

        {/* Botão principal */}
        <Button
          ref={buttonRef}
          variant="primary"
          onClick={handleNavigate}
          type="button"
        >
          <Home size={16} aria-hidden="true" />
          {redirectLabel}
        </Button>

        {/* Link de cancelar redirect */}
        {!cancelled && (
          <button
            className={styles.cancelLink}
            onClick={cancelRedirect}
            type="button"
            aria-label="Cancelar redirect automático e permanecer nesta página"
          >
            <X size={13} aria-hidden="true" />
            Cancelar redirect automático
          </button>
        )}

      </main>
    </div>
  );
}

export default NotFoundPage;