import { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useMatches, useNavigate } from 'react-router-dom';
import {
  Send,
  LayoutDashboard,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bell,
  Menu,
  X,
  Users,
  Upload,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../core/auth/useAuth';
import { UserRole } from '../../core/constants/appConstants';
import styles from './MainLayout.module.css';

/** Chave de persistência no localStorage para estado da sidebar */
const SIDEBAR_STORAGE_KEY = 'hermes_sidebar_collapsed';

/**
 * Mapa de rotas → títulos de página exibidos no header.
 */
const ROUTE_TITLES = {
  '/dashboard':          'Dashboard',
  '/templates':          'Templates',
  '/templates/new':      'Novo Template',
  '/notifications/new':  'Nova Notificação',
  '/notifications/bulk': 'Envio em Massa',
  '/users':              'Usuários',
  '/users/new':          'Novo Usuário',
  '/celulas':            'Células',
  '/celulas/new':        'Nova Célula',
};

/** Retorna o título da rota ativa mais específica. */
function usePageTitle() {
  const matches = useMatches();
  if (!matches.length) return 'HERMES';

  for (let i = matches.length - 1; i >= 0; i--) {
    const title = ROUTE_TITLES[matches[i].pathname];
    if (title) return title;
  }
  return 'HERMES';
}

/**
 * Gera as iniciais de um nome para exibir no avatar.
 * @param {string} name
 * @returns {string}
 */
function getInitials(name = '') {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * Retorna o label de role para exibição no rodapé da sidebar e no badge do header.
 * @param {string} role
 * @returns {string}
 */
function getRoleLabel(role) {
  if (role === UserRole.ADMIN)  return 'Administrador';
  if (role === UserRole.GESTOR) return 'Gestor';
  return 'Usuário';
}

/* ─────────────────────────────────────────────────────────── */

/**
 * @component MainLayout
 * @description Layout principal para todas as telas autenticadas do HERMES.
 *
 * Atualizado para suporte ao role GESTOR:
 *  - Item "Células" na sidebar visível para ADMIN e GESTOR
 *  - Item "Usuários" na sidebar visível para ADMIN e GESTOR
 *  - Badge de role no header exibe "GESTOR" corretamente
 *  - Rodapé da sidebar exibe label correto por role
 *
 * @returns {JSX.Element}
 */
export default function MainLayout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const pageTitle = usePageTitle();

  const userRole = user?.role ?? UserRole.USER;
  const isGestor = userRole === UserRole.GESTOR;
  const canManageUsers  = isAdmin || isGestor;
  const canManageCelulas = isAdmin || isGestor;

  /* Estado: sidebar colapsada (desktop) */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  /* Estado: drawer aberto (mobile) */
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
    } catch { /* ignora */ }
  }, [collapsed]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => { if (e.matches) setDrawerOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);
  const toggleDrawer   = useCallback(() => setDrawerOpen((o) => !o), []);
  const closeDrawer    = useCallback(() => setDrawerOpen(false), []);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const initials  = getInitials(user?.name);
  const roleLabel = getRoleLabel(userRole);

  /* ── Itens de navegação ── */
  const NAV_ITEMS = [
    { to: '/dashboard',          label: 'Dashboard',       Icon: LayoutDashboard, show: true },
    { to: '/templates',          label: 'Templates',        Icon: FileText,        show: true },
    { to: '/notifications/new',  label: 'Nova Notificação', Icon: Send,            show: true },
    { to: '/notifications/bulk', label: 'Envio em Massa',   Icon: Upload,          show: true },
    { to: '/users',              label: 'Usuários',         Icon: Users,           show: canManageUsers },
    { to: '/celulas',            label: 'Células',          Icon: Building2,       show: canManageCelulas },
  ].filter((item) => item.show);

  /* ── Render ── */
  return (
    <div
      className={[
        styles.root,
        collapsed  ? styles.rootCollapsed  : '',
        drawerOpen ? styles.rootDrawerOpen : '',
      ].filter(Boolean).join(' ')}
    >
      {/* ── Overlay mobile ── */}
      {drawerOpen && (
        <div
          className={styles.overlay}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      {/* ══════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════ */}
      <aside
        className={[
          styles.sidebar,
          collapsed  ? styles.sidebarCollapsed  : '',
          drawerOpen ? styles.sidebarDrawerOpen : '',
        ].filter(Boolean).join(' ')}
        aria-label="Navegação principal"
      >
        {/* ── Logo ── */}
        <div className={styles.sidebarLogo}>
          <Send size={22} strokeWidth={1.75} className={styles.logoIcon} />
          {!collapsed && <span className={styles.logoText}>HERMES</span>}
        </div>

        {/* ── Navegação ── */}
        <nav className={styles.nav} role="navigation" aria-label="Menu principal">
          <ul className={styles.navList}>
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <li key={to} className={styles.navItem}>
                <NavLink
                  to={to}
                  end={to === '/dashboard'}
                  onClick={closeDrawer}
                  className={({ isActive }) =>
                    [styles.navLink, isActive ? styles.navLinkActive : '']
                      .filter(Boolean).join(' ')
                  }
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} className={styles.navIcon} />
                  {!collapsed && <span className={styles.navLabel}>{label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Rodapé da sidebar: usuário + logout ── */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userAvatar} aria-hidden="true">
            {initials}
          </div>

          {!collapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName} title={user?.name}>
                {user?.name ?? '—'}
              </span>
              <span className={styles.userRole}>{roleLabel}</span>
            </div>
          )}

          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            aria-label="Sair da conta"
            title="Sair"
          >
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Botão de colapso (desktop) ── */}
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleCollapse}
          aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed
            ? <ChevronRight size={14} strokeWidth={2} />
            : <ChevronLeft  size={14} strokeWidth={2} />
          }
        </button>
      </aside>

      {/* ══════════════════════════════════════════════
          ÁREA PRINCIPAL (header + conteúdo)
      ══════════════════════════════════════════════ */}
      <div className={styles.pageWrapper}>
        {/* ── Header ── */}
        <header className={styles.header} role="banner">
          <button
            type="button"
            className={styles.menuBtn}
            onClick={toggleDrawer}
            aria-label={drawerOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={drawerOpen}
            aria-controls="main-sidebar"
          >
            {drawerOpen
              ? <X    size={20} strokeWidth={1.75} />
              : <Menu size={20} strokeWidth={1.75} />
            }
          </button>

          <h1 className={styles.pageTitle}>{pageTitle}</h1>

          <div className={styles.headerRight}>
            <span
              className={[
                styles.roleBadge,
                isAdmin  ? styles.roleBadgeAdmin  :
                isGestor ? styles.roleBadgeGestor :
                styles.roleBadgeUser,
              ].join(' ')}
              aria-label={`Perfil: ${roleLabel}`}
            >
              {userRole}
            </span>

            <button
              type="button"
              className={styles.bellBtn}
              aria-label="Notificações"
              title="Notificações"
              disabled
            >
              <Bell size={18} strokeWidth={1.75} />
            </button>
          </div>
        </header>

        {/* ── Conteúdo da página ── */}
        <main className={styles.main} role="main" id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
