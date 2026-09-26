import { authService, AuthUser } from '../services/auth';

/**
 * 5. Dashboard Institucional e Painel de Homologação Administrativa
 * Conectado ao MySQL via API Laravel/Express:
 * - Calcula números em tempo real: Total de documentos, válidos, revogados e verificações.
 * - Integração do controle de acesso: Administrador pode aprovar ou suspender instituições.
 */
export function renderDashboardPage(): string {
  const user = authService.getUser();

  if (!user) {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 500px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-lock"></i></div>
          <h4 class="fw-bold text-dark">Acesso Restrito</h4>
          <p class="text-secondary small mb-4">Esta área requer autenticação com uma instituição aprovada ou como Administrador.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">
            <i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sessão
          </a>
        </div>
      </div>
    `;
  }

  // Se a instituição não for aprovada (regra de segurança do Middleware)
  if (user.role !== 'admin' && user.institutionStatus === 'pending') {
    return `
      <div class="container py-5">
        <div class="card p-5 border-warning border-opacity-50 shadow-sm mx-auto rounded-4 bg-white text-center" style="max-width: 650px;">
          <div class="text-warning fs-1 mb-3"><i class="bi bi-hourglass-split"></i></div>
          <span class="badge bg-warning text-dark px-3 py-1 rounded-pill small fw-bold mb-2">STATUS: PENDING</span>
          <h3 class="fw-bold text-dark">Instituição Aguardando Homologação</h3>
          <p class="text-secondary small mb-4">
            A sua instituição <strong>${user.institutionName}</strong> foi registada com sucesso, mas o acesso ao painel de emissão está bloqueado pelo middleware de segurança até que o <strong>Administrador Central</strong> aprove a candidatura.
          </p>
          <div class="p-3 bg-light rounded-3 text-start small mb-4">
            <div class="fw-bold text-dark mb-1"><i class="bi bi-info-circle text-primary me-1"></i> Como proceder com o teste?</div>
            <div class="text-secondary">
              1. Encerre esta sessão clicando no botão abaixo.<br>
              2. Entre com a conta do Administrador (<code>admin@veridoc.app</code> / <code>Admin@2026</code>).<br>
              3. No painel de administração, localize a sua instituição e clique em <strong>APROVAR</strong>.<br>
              4. Em seguida, faça login novamente com esta conta para acessar o dashboard completo!
            </div>
          </div>
          <button type="button" class="btn btn-outline-danger" id="btnDashLogout">
            <i class="bi bi-box-arrow-left me-1"></i> Encerrar Sessão
          </button>
        </div>
      </div>
    `;
  }

  const isAdmin = user.role === 'admin';

  return `
    <div class="d-flex flex-column flex-lg-row min-vh-100">
      
      <!-- SIDEBAR DA INSTITUIÇÃO / ADMIN -->
      <aside class="vd-dash-sidebar p-3 p-lg-4">
        <!-- Perfil Resumido -->
        <div class="d-flex align-items-center gap-3 pb-4 mb-4 border-bottom border-light border-opacity-10">
          <div class="vd-logo-shield" style="width: 44px; height: 44px; font-size: 1.25rem; ${isAdmin ? 'background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);' : ''}">
            <i class="bi ${isAdmin ? 'bi-shield-shaded' : 'bi-building'}"></i>
          </div>
          <div class="overflow-hidden">
            <h6 class="text-white fw-bold mb-0 text-truncate">${isAdmin ? 'Administração Central' : (user.institutionName || 'Instituição')}</h6>
            <span class="badge ${isAdmin ? 'bg-danger' : 'bg-success'} bg-opacity-25 text-white border border-light border-opacity-25 small" style="font-size: 0.68rem;">
              <i class="bi bi-check-circle-fill me-1"></i> ${isAdmin ? 'Super Admin' : 'Homologada (APPROVED)'}
            </span>
          </div>
        </div>

        <!-- Links de Navegação do Painel -->
        <nav class="d-flex flex-column gap-1">
          <span class="text-secondary small fw-bold text-uppercase px-3 mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
            Navegação do Painel
          </span>

          <button type="button" class="btn text-start vd-dash-menu-item active" id="tabBtnStats">
            <i class="bi bi-speedometer2"></i> ${isAdmin ? 'Métricas da Plataforma' : 'Dashboard Geral'}
          </button>

          ${isAdmin ? `
            <button type="button" class="btn text-start vd-dash-menu-item text-secondary" id="tabBtnAdminInst">
              <i class="bi bi-building-gear"></i> Gestão de Instituições
              <span class="badge bg-warning text-dark ms-auto" id="pendingBadgeCount">0</span>
            </button>
          ` : `
            <a href="#documentos" class="vd-dash-menu-item text-secondary">
              <i class="bi bi-file-earmark-text"></i> Documentos da Instituição
            </a>
            <a href="#auditoria" class="vd-dash-menu-item text-secondary">
              <i class="bi bi-journal-text"></i> Histórico de Auditoria
            </a>
          `}

          <span class="text-secondary small fw-bold text-uppercase px-3 mt-4 mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
            Sessão & Segurança
          </span>

          <div class="px-3 py-2 bg-dark bg-opacity-50 rounded-3 text-secondary small mb-2 border border-secondary border-opacity-25">
            <div class="text-white fw-semibold mb-0" style="font-size: 0.78rem;">${user.name}</div>
            <div style="font-size: 0.7rem;" class="text-truncate">${user.email}</div>
          </div>

          <button type="button" class="btn text-start vd-dash-menu-item text-danger" id="btnDashLogout">
            <i class="bi bi-box-arrow-left"></i> Encerrar Sessão
          </button>
        </nav>
      </aside>

      <!-- CONTEÚDO PRINCIPAL DO DASHBOARD -->
      <main class="flex-grow-1 p-4 p-lg-5 bg-light">
        
        <!-- Feedback de Ação -->
        <div id="dashAlertBox" class="d-none mb-4"></div>

        <!-- VIEW 1: MÉTRICAS (CALCULADAS DIRETO DO BANCO MYSQL) -->
        <div id="viewStatsSection">
          <!-- Header do Painel -->
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div>
              <span class="text-primary fw-semibold small text-uppercase" style="letter-spacing: 0.05em;">
                ${isAdmin ? 'Painel de Auditoria Global' : 'Painel de Controlo do Emissor'}
              </span>
              <h2 class="fw-bold text-dark mb-1">Visão Geral de Certificações</h2>
              <p class="text-secondary small mb-0">
                ${isAdmin 
                  ? 'Estatísticas consolidadas da base de dados MySQL (todas as entidades e logs de auditoria).'
                  : `Dados em tempo real da instituição: <strong>${user.institutionName}</strong>.`}
              </p>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2" id="btnRefreshStats">
                <i class="bi bi-arrow-clockwise"></i> Atualizar Dados
              </button>
            </div>
          </div>

          <!-- 4 CARDS CALCULADOS DIRETAMENTE DO MYSQL -->
          <div class="row g-4 mb-5">
            <!-- Card 1: Documentos emitidos -->
            <div class="col-sm-6 col-xl-3">
              <div class="vd-stat-card h-100">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span class="text-secondary small fw-semibold text-uppercase" style="font-size: 0.75rem;">Documentos Emitidos</span>
                    <div class="vd-stat-number mt-1" id="statTotalDocs">...</div>
                  </div>
                  <div class="vd-stat-icon bg-primary bg-opacity-10 text-primary">
                    <i class="bi bi-file-earmark-check"></i>
                  </div>
                </div>
                <div class="text-secondary small" style="font-size: 0.78rem;">
                  <span class="text-primary fw-semibold"><i class="bi bi-database-check me-1"></i>Consultado no MySQL</span>
                </div>
              </div>
            </div>

            <!-- Card 2: Documentos válidos -->
            <div class="col-sm-6 col-xl-3">
              <div class="vd-stat-card h-100 border-start border-4 border-success">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span class="text-secondary small fw-semibold text-uppercase" style="font-size: 0.75rem;">Documentos Válidos</span>
                    <div class="vd-stat-number text-success mt-1" id="statValidDocs">...</div>
                  </div>
                  <div class="vd-stat-icon bg-success bg-opacity-10 text-success">
                    <i class="bi bi-patch-check-fill"></i>
                  </div>
                </div>
                <div class="text-secondary small" style="font-size: 0.78rem;">
                  <span class="text-success fw-semibold"><i class="bi bi-check2-all me-1"></i>Status = 'valid'</span>
                </div>
              </div>
            </div>

            <!-- Card 3: Documentos revogados -->
            <div class="col-sm-6 col-xl-3">
              <div class="vd-stat-card h-100 border-start border-4 border-danger">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span class="text-secondary small fw-semibold text-uppercase" style="font-size: 0.75rem;">Documentos Revogados</span>
                    <div class="vd-stat-number text-danger mt-1" id="statRevokedDocs">...</div>
                  </div>
                  <div class="vd-stat-icon bg-danger bg-opacity-10 text-danger">
                    <i class="bi bi-shield-x"></i>
                  </div>
                </div>
                <div class="text-secondary small" style="font-size: 0.78rem;">
                  <span class="text-danger fw-semibold"><i class="bi bi-slash-circle me-1"></i>Status = 'revoked'</span>
                </div>
              </div>
            </div>

            <!-- Card 4: Verificações -->
            <div class="col-sm-6 col-xl-3">
              <div class="vd-stat-card h-100 border-start border-4 border-info">
                <div class="d-flex justify-content-between align-items-start mb-3">
                  <div>
                    <span class="text-secondary small fw-semibold text-uppercase" style="font-size: 0.75rem;">Verificações</span>
                    <div class="vd-stat-number text-dark mt-1" id="statVerifications">...</div>
                  </div>
                  <div class="vd-stat-icon bg-info bg-opacity-10 text-primary">
                    <i class="bi bi-qr-code-scan"></i>
                  </div>
                </div>
                <div class="text-secondary small" style="font-size: 0.78rem;">
                  <span class="text-info fw-semibold"><i class="bi bi-eye me-1"></i>Registadas na tabela</span>
                </div>
              </div>
            </div>
          </div>

          <!-- TABELA DE DOCUMENTOS REAIS DO BANCO -->
          <div class="card border border-light-subtle rounded-4 shadow-sm overflow-hidden mb-4">
            <div class="card-header bg-white py-3 px-4 border-bottom border-light-subtle d-flex justify-content-between align-items-center">
              <div>
                <h5 class="fw-bold text-dark mb-0">Documentos Registados no Banco de Dados</h5>
                <span class="text-muted small">Registros retornados pela consulta direta ao MySQL</span>
              </div>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light text-secondary small text-uppercase">
                  <tr>
                    <th class="ps-4">Código Único</th>
                    <th>Título / Tipo</th>
                    <th>Titular</th>
                    <th>Curso / Especialidade</th>
                    <th>Data Emissão</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody class="small" id="recentDocsTableBody">
                  <tr>
                    <td colspan="6" class="text-center py-4 text-muted">A carregar registos do banco...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- VIEW 2: GESTÃO ADMINISTRATIVA DE INSTITUIÇÕES (APENAS PARA O ADMIN) -->
        ${isAdmin ? `
          <div id="viewAdminSection" class="d-none">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <div>
                <span class="badge bg-danger text-white mb-1">MÓDULO EXCLUSIVO DO ADMINISTRADOR</span>
                <h2 class="fw-bold text-dark mb-1">Homologação de Instituições</h2>
                <p class="text-secondary small mb-0">
                  Somente o administrador pode alterar o estado das instituições para <strong>APPROVED</strong> ou <strong>SUSPENDED</strong>.
                </p>
              </div>
              <button class="btn btn-outline-secondary btn-sm" id="btnRefreshAdminList">
                <i class="bi bi-arrow-clockwise me-1"></i> Atualizar Lista
              </button>
            </div>

            <!-- Tabela de Instituições -->
            <div class="card border border-light-subtle rounded-4 shadow-sm overflow-hidden">
              <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                  <thead class="table-light text-secondary small text-uppercase">
                    <tr>
                      <th class="ps-4">ID</th>
                      <th>Instituição</th>
                      <th>Tipo / Localização</th>
                      <th>Email Oficial</th>
                      <th>Responsável</th>
                      <th>Status Atual</th>
                      <th class="text-end pe-4">Ação Administrativa</th>
                    </tr>
                  </thead>
                  <tbody class="small" id="adminInstitutionsTableBody">
                    <tr>
                      <td colspan="7" class="text-center py-4 text-muted">A carregar instituições...</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}

      </main>

    </div>
  `;
}
