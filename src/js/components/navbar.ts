import { authService } from '../services/auth';

/**
 * Navbar Reutilizável - VeriDoc
 * Integrada com sessão ativa, perfis de Administrador e Instituição
 */
export function renderNavbar(currentPath: string): string {
  const user = authService.getUser();

  return `
    <nav class="navbar navbar-expand-lg vd-navbar sticky-top">
      <div class="container">
        <!-- Logo VeriDoc -->
        <a class="vd-brand-logo" href="/" data-route="/">
          <div class="vd-logo-shield">
            <i class="bi bi-shield-check"></i>
          </div>
          <span>Veri<span class="vd-brand-accent">Doc</span></span>
        </a>

        <!-- Botão Mobile -->
        <button class="navbar-toggler border-0 text-white" type="button" data-bs-toggle="collapse" data-bs-target="#veridocNavbar" aria-controls="veridocNavbar" aria-expanded="false" aria-label="Alternar navegação">
          <i class="bi bi-list fs-2 text-white"></i>
        </button>

        <!-- Links e Ações -->
        <div class="collapse navbar-collapse" id="veridocNavbar">
          <ul class="navbar-nav mx-auto mb-2 mb-lg-0 gap-1">
            <li class="nav-item">
              <a class="nav-link vd-nav-link ${currentPath === '/' ? 'active' : ''}" href="/" data-route="/">Início</a>
            </li>
            <li class="nav-item">
              <a class="nav-link vd-nav-link ${currentPath.startsWith('/verificar') ? 'active' : ''}" href="/verificar" data-route="/verificar">
                <i class="bi bi-patch-check me-1"></i> Verificar
              </a>
            </li>
            ${user && user.role === 'admin' ? `
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/admin/dashboard' ? 'active' : ''}" href="/admin/dashboard" data-route="/admin/dashboard">
                  <i class="bi bi-speedometer2 me-1"></i> Painel Geral
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/admin/institutions' ? 'active' : ''}" href="/admin/institutions" data-route="/admin/institutions">
                  <i class="bi bi-building-gear me-1"></i> Instituições
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/admin/documents' ? 'active' : ''}" href="/admin/documents" data-route="/admin/documents">
                  <i class="bi bi-file-earmark-check me-1"></i> Documentos
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/admin/verifications' ? 'active' : ''}" href="/admin/verifications" data-route="/admin/verifications">
                  <i class="bi bi-shield-check me-1"></i> Verificações
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/admin/logs' ? 'active' : ''}" href="/admin/logs" data-route="/admin/logs">
                  <i class="bi bi-journal-text me-1"></i> Logs
                </a>
              </li>
            ` : user ? `
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/instituicao/dashboard' ? 'active' : ''}" href="/instituicao/dashboard" data-route="/instituicao/dashboard">
                  <i class="bi bi-speedometer2 me-1"></i> Dashboard
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/instituicao/documentos' ? 'active' : ''}" href="/instituicao/documentos" data-route="/instituicao/documentos">
                  <i class="bi bi-file-earmark-text me-1"></i> Documentos
                </a>
              </li>
              <li class="nav-item">
                <a class="nav-link vd-nav-link text-warning ${currentPath === '/instituicao/documentos/novo' ? 'active text-white' : ''}" href="/instituicao/documentos/novo" data-route="/instituicao/documentos/novo">
                  <i class="bi bi-plus-circle me-1"></i> Emitir
                </a>
              </li>
            ` : `
              <li class="nav-item">
                <a class="nav-link vd-nav-link ${currentPath === '/instituicao/cadastro' ? 'active' : ''}" href="/instituicao/cadastro" data-route="/instituicao/cadastro">
                  Para Instituições
                </a>
              </li>
            `}
          </ul>

          <div class="d-flex align-items-center gap-2 mt-3 mt-lg-0">
            ${user ? `
              <div class="dropdown">
                <button class="btn btn-vd-outline btn-sm dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'} text-white">
                    ${user.role === 'admin' ? 'SUPER ADMIN' : (user.institutionName || 'INSTITUIÇÃO')}
                  </span>
                  <span class="text-white small d-none d-sm-inline">${user.name.split(' ')[0]}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow border-0 bg-dark text-white p-2">
                  <li class="px-3 py-1">
                    <div class="fw-bold small text-white">${user.name}</div>
                    <div class="text-muted small" style="font-size: 0.72rem;">${user.email}</div>
                  </li>
                  <li><hr class="dropdown-divider border-secondary"></li>
                  ${user.role === 'admin' ? `
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/admin/dashboard" data-route="/admin/dashboard">
                        <i class="bi bi-speedometer2 me-2"></i> Painel Geral Admin
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/admin/institutions" data-route="/admin/institutions">
                        <i class="bi bi-building-gear me-2"></i> Gestão de Instituições
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/admin/documents" data-route="/admin/documents">
                        <i class="bi bi-file-earmark-check me-2"></i> Consultar Documentos
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/admin/verifications" data-route="/admin/verifications">
                        <i class="bi bi-shield-check me-2"></i> Consultar Verificações
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/admin/logs" data-route="/admin/logs">
                        <i class="bi bi-journal-text me-2"></i> Logs de Auditoria
                      </a>
                    </li>
                  ` : `
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/instituicao/dashboard" data-route="/instituicao/dashboard">
                        <i class="bi bi-speedometer2 me-2"></i> Dashboard Geral
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/instituicao/documentos" data-route="/instituicao/documentos">
                        <i class="bi bi-file-earmark-text me-2"></i> Ver Documentos
                      </a>
                    </li>
                    <li>
                      <a class="dropdown-item text-white small rounded-2" href="/instituicao/documentos/novo" data-route="/instituicao/documentos/novo">
                        <i class="bi bi-patch-plus me-2 text-warning"></i> Emitir Novo Documento
                      </a>
                    </li>
                  `}
                  <li><hr class="dropdown-divider border-secondary"></li>
                  <li>
                    <button class="dropdown-item text-danger small rounded-2" id="navBtnLogout">
                      <i class="bi bi-box-arrow-left me-2"></i> Encerrar Sessão
                    </button>
                  </li>
                </ul>
              </div>
            ` : `
              <a class="btn btn-vd-outline ${currentPath === '/login' ? 'active' : ''}" href="/login" data-route="/login">
                <i class="bi bi-box-arrow-in-right"></i> Entrar
              </a>
              <a class="btn btn-vd-primary" href="/verificar" data-route="/verificar">
                <i class="bi bi-qr-code-scan"></i> Validar
              </a>
            `}
          </div>
        </div>
      </div>
    </nav>
  `;
}
