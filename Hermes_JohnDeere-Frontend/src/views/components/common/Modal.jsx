import { useEffect, useRef, useId, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { X } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';
import styles from './Modal.module.css';

/**
 * Modal — componente de diálogo acessível com portal, focus trap e animações.
 *
 * Renderizado via ReactDOM.createPortal diretamente no document.body para
 * garantir z-index correto independente do stacking context do pai.
 *
 * @param {object}        props
 * @param {boolean}       props.isOpen               — Controla a visibilidade do modal. Obrigatório.
 * @param {function}      props.onClose              — Callback disparado ao fechar (botão X, Escape, overlay). Obrigatório.
 * @param {string}        props.title                — Título exibido no header; vinculado via aria-labelledby. Obrigatório.
 * @param {React.ReactNode} [props.children]         — Conteúdo do body do modal.
 * @param {React.ReactNode} [props.footer]           — Conteúdo do footer (tipicamente botões). Omitir para esconder o footer.
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']   — Largura máxima: sm=400px, md=560px, lg=720px, xl=920px.
 * @param {boolean}       [props.hideCloseButton=false] — Oculta o botão X. Útil em modais de sucesso.
 * @param {boolean}       [props.closeOnOverlayClick=true] — Fechar ao clicar no backdrop.
 * @param {boolean}       [props.closeOnEscape=true]  — Fechar ao pressionar Escape.
 * @param {boolean}       [props.isLoading=false]    — Exibe LoadingSpinner overlay sobre o body do modal.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  hideCloseButton = false,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  isLoading = false,
}) {
  // IDs únicos para associação ARIA (React 18 useId)
  const titleId = useId();
  const bodyId = useId();

  // Controle de montagem/desmontagem para animação de saída
  const [isMounted, setIsMounted] = useState(false);
  const [animState, setAnimState] = useState(''); // 'entering' | 'exiting' | ''

  // Ref para restaurar o foco ao fechar
  const previousFocusRef = useRef(null);
  // Ref para o container do dialog (focus trap)
  const dialogRef = useRef(null);
  // Timeout ref para cleanup do timer de desmontagem
  const exitTimerRef = useRef(null);

  // ─── Ciclo de vida: abertura e fechamento com animação ───────────────────
  useEffect(() => {
    if (isOpen) {
      // Cancela timer de saída pendente (re-abertura rápida)
      clearTimeout(exitTimerRef.current);
      // Salvar o elemento com foco atual para restaurar depois
      previousFocusRef.current = document.activeElement;
      setIsMounted(true);
      // Próximo tick para o DOM montar antes de aplicar animação
      requestAnimationFrame(() => {
        setAnimState('entering');
      });
    } else if (isMounted) {
      setAnimState('exiting');
      exitTimerRef.current = setTimeout(() => {
        setIsMounted(false);
        setAnimState('');
      }, 220); // Ligeiramente maior que a duração da animação (200ms)
    }

    return () => clearTimeout(exitTimerRef.current);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Scroll lock ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // ─── Escape handler ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // ─── Focus trap + foco inicial ───────────────────────────────────────────
  useEffect(() => {
    if (!isMounted || !isOpen || !dialogRef.current) return;

    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Mover foco para o primeiro elemento focável dentro do modal
    const focusables = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      dialogRef.current.focus();
    }

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      const focusableEls = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (focusableEls.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: ciclar para o último ao sair pelo primeiro
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: ciclar para o primeiro ao sair pelo último
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      // Restaurar foco ao elemento anterior ao abrir o modal
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [isMounted, isOpen]);

  // ─── Handler do overlay ──────────────────────────────────────────────────
  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlayClick) onClose();
  }, [closeOnOverlayClick, onClose]);

  // Não renderizar nada enquanto completamente desmontado
  if (!isMounted) return null;

  // ─── Classes dinâmicas ───────────────────────────────────────────────────
  const overlayClass = [
    styles.overlay,
    animState === 'entering' ? styles.overlayEntering : '',
    animState === 'exiting' ? styles.overlayExiting : '',
  ].filter(Boolean).join(' ');

  const dialogClass = [
    styles.dialog,
    styles[size],
    animState === 'entering' ? styles.entering : '',
    animState === 'exiting' ? styles.exiting : '',
  ].filter(Boolean).join(' ');

  // ─── Conteúdo do portal ──────────────────────────────────────────────────
  const modalContent = (
    <div
      className={overlayClass}
      onClick={handleOverlayClick}
      aria-hidden="true"
    >
      <div
        ref={dialogRef}
        className={dialogClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {!hideCloseButton && (
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Fechar modal"
              type="button"
            >
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </header>

        {/* ── Body ── */}
        <div id={bodyId} className={styles.body}>
          {isLoading && <LoadingSpinner overlay />}
          {children}
        </div>

        {/* ── Footer (opcional) ── */}
        {footer && (
          <footer className={styles.footer}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
}