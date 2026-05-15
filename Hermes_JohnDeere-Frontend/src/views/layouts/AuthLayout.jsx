import { Outlet } from 'react-router-dom';
import { Send } from 'lucide-react';
import styles from './AuthLayout.module.css';

/**
 * @component AuthLayout
 * @description Layout para telas de autenticação (ex: LoginPage).
 * Divide a tela em dois painéis:
 * - Esquerdo (40%): branding do HERMES com fundo verde corporativo (oculto em mobile)
 * - Direito (60%): área de conteúdo com `<Outlet />` para renderizar as páginas filhas
 *
 * @returns {JSX.Element}
 */
export default function AuthLayout() {
  return (
    <div className={styles.root}>
      {/* ── Painel esquerdo: branding ── */}
      <aside className={styles.brandPanel} aria-hidden="true">
        <div className={styles.brandContent}>
          <div className={styles.logo}>
            <Send size={36} strokeWidth={1.75} className={styles.logoIcon} />
            <span className={styles.logoText}>HERMES</span>
          </div>

          <p className={styles.tagline}>
            O sistema central de notificações da sua empresa
          </p>

          <div className={styles.brandDivider} />

          <ul className={styles.featureList} aria-label="Recursos do sistema">
            <li>Envio de e-mails com templates dinâmicos</li>
            <li>Agendamento e rastreamento de notificações</li>
            <li>Controle de acesso por perfil de usuário</li>
          </ul>
        </div>

        {/* Detalhe decorativo geométrico */}
        <div className={styles.brandDecor} aria-hidden="true" />
      </aside>

      {/* ── Painel direito: conteúdo (Outlet) ── */}
      <main className={styles.contentPanel} role="main">
        <div className={styles.contentInner}>
          <Outlet />
        </div>

        <footer className={styles.footer}>
          © 2026 HERMES — John Deere Fatec Challenge
        </footer>
      </main>
    </div>
  );
}