import { authService } from '../services/auth';
import { escapeHtml } from '../utils/sanitize';

/**
 * Painel Administrativo Central - Dashboard Geral (/admin/dashboard)
 * Acesso exclusivo a utilizadores com role ADMIN.
 * Exibe os 7 KPIs fundamentais:
 * - Número de instituições
 * - Instituições pendentes
 * - Instituições aprovadas
 * - Documentos emitidos
 * - Documentos válidos
 * - Documentos revogados
 * - Total de verificações
 */
export function renderAdminDashboardPage(): string {
  const user = authService.getUser();

  if (!user || user.role !== 'admin') {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 520px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-x"></i></div>
          <h4 class="fw-bold text-dark">Acesso Administrativo Negado</h4>
          <p class="text-secondary small mb-4">Esta página é restrita exclusivamente ao Administrador Geral da infraestrutura VeriDoc.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">
            <i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sessão com Perfil Autorizado
          </a>
        </div>
      </div>
    `;
  }

  return `
    <div class="d-flex flex-column flex-lg-row min-vh-100">
      
      <!-- SIDEBAR ADMINISTRATIVA -->
      <aside class="vd-dash-sidebar p-3 p-lg-4" style="min-width: 270px; background: #0A1428;">
        <!-- Identificação do Administrador -->
        <div class="d-flex align-items-center gap-3 pb-4 mb-4 border-bottom border-light border-opacity-10">
          <div class="vd-logo-shield" style="width: 44px; height: 44px; font-size: 1.25rem; background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);">
            <i class="bi bi-shield-shaded"></i>
          </div>
          <div class="overflow-hidden">
            <h6 class="text-white fw-bold mb-0 text-truncate">Administração Central</h6>
            <span class="badge bg-danger bg-opacity-25 text-white border border-light border-opacity-25 small" style="font-size: 0.68rem;">
              <i class="bi bi-patch-check-fill me-1"></i> Super Administrador
            </span>
          </div>
        </div>

        <!-- Links de Navegação do Painel Admin -->
        <nav class="d-flex flex-column gap-1">
          <span class="text-secondary small fw-bold text-uppercase px-3 mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
            Gestão Governamental
          </span>

          <a href="/admin/dashboard" data-route="/admin/dashboard" class="btn text-start vd-dash-menu-item active">
            <i class="bi bi-speedometer2"></i> Dashboard Geral
          </a>

          <a href="/admin/institutions" data-route="/admin/institutions" class="btn text-start vd-dash-menu-item text-secondary position-relative">
            <i class="bi bi-building-gear"></i> Instituições
            <span class="badge bg-warning text-dark ms-auto d-none" id="adminSidebarPendingBadge">0</span>
          </a>

          <a href="/admin/documents" data-route="/admin/documents" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-file-earmark-check"></i> Documentos Globais
          </a>

          <a href="/admin/verifications" data-route="/admin/verifications" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-shield-check"></i> Verificações Públicas
          </a>

          <a href="/admin/logs" data-route="/admin/logs" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-journal-text"></i> Logs de Auditoria
          </a>

          <span class="text-secondary small fw-bold text-uppercase px-3 mt-4 mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
            Sessão & Segurança
          </span>

          <button type="button" class="btn text-start vd-dash-menu-item text-danger" id="btnAdminLogout">
            <i class="bi bi-box-arrow-left"></i> Encerrar Sessão
          </button>
        </nav>
      </aside>

      <!-- CONTEÚDO PRINCIPAL DO DASHBOARD -->
      <main class="flex-grow-1 p-3 p-md-4 p-xl-5 bg-light overflow-auto">
        <div class="container-fluid p-0">
          
          <!-- Cabeçalho de Boas-Vindas -->
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom border-light-subtle">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-danger px-2.5 py-1 text-white fw-bold small">PAINEL ROOT</span>
                <span class="text-muted small">| Infraestrutura Nacional VeriDoc</span>
              </div>
              <h2 class="fw-bold text-dark mb-0">Visão Geral da Plataforma</h2>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2">
              <button class="btn btn-outline-secondary btn-sm" id="btnRefreshAdminStats">
                <i class="bi bi-arrow-repeat me-1"></i> Atualizar Métricas
              </button>
              <a href="/admin/institutions" data-route="/admin/institutions" class="btn btn-vd-primary btn-sm">
                <i class="bi bi-building-add me-1"></i> Homologar Instituições
              </a>
            </div>
          </div>

          <!-- BANNER DE ALERTA: INSTITUIÇÕES PENDENTES -->
          <div id="adminPendingAlert" class="alert alert-warning border-warning border-opacity-50 shadow-sm rounded-4 p-3 mb-4 d-none">
            <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div class="d-flex align-items-center gap-3">
                <div class="fs-2 text-warning"><i class="bi bi-exclamation-triangle-fill"></i></div>
                <div>
                  <h6 class="fw-bold text-dark mb-0">Instituições Aguardando Homologação</h6>
                  <p class="text-secondary small mb-0">
                    Existem <strong class="text-dark font-monospace" id="pendingAlertCount">0</strong> entidades inscritas no estado <strong>PENDING</strong> que necessitam de aprovação para emitir certificados.
                  </p>
                </div>
              </div>
              <a href="/admin/institutions?status=pending" data-route="/admin/institutions?status=pending" class="btn btn-warning btn-sm fw-bold px-3">
                <i class="bi bi-shield-check me-1"></i> Avaliar Candidaturas
              </a>
            </div>
          </div>

          <!-- AS 7 MÉTRICAS OBRIGATÓRIAS REQUISITADAS NO BRIEFING -->
          <div class="row g-3 mb-4">
            
            <!-- 1. Número de instituições (Total) -->
            <div class="col-sm-6 col-xl-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Número de Instituições</span>
                  <div class="badge bg-primary bg-opacity-10 text-primary p-2 rounded-3">
                    <i class="bi bi-buildings fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-dark mb-1 font-monospace" id="kpiTotalInstitutions">-</h3>
                <span class="text-muted small">Total de entidades cadastradas</span>
              </div>
            </div>

            <!-- 2. Instituições pendentes -->
            <div class="col-sm-6 col-xl-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Instituições Pendentes</span>
                  <div class="badge bg-warning bg-opacity-10 text-warning p-2 rounded-3">
                    <i class="bi bi-hourglass-split fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-warning mb-1 font-monospace" id="kpiPendingInstitutions">-</h3>
                <span class="text-muted small">Aguardando homologação formal</span>
              </div>
            </div>

            <!-- 3. Instituições aprovadas -->
            <div class="col-sm-6 col-xl-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Instituições Aprovadas</span>
                  <div class="badge bg-success bg-opacity-10 text-success p-2 rounded-3">
                    <i class="bi bi-building-check fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-success mb-1 font-monospace" id="kpiApprovedInstitutions">-</h3>
                <span class="text-muted small">Habilitadas para emissão real</span>
              </div>
            </div>

            <!-- 4. Documentos emitidos (Total) -->
            <div class="col-sm-6 col-xl-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Documentos Emitidos</span>
                  <div class="badge bg-info bg-opacity-10 text-info p-2 rounded-3">
                    <i class="bi bi-file-earmark-text fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-dark mb-1 font-monospace" id="kpiTotalDocuments">-</h3>
                <span class="text-muted small">Assinados criptograficamente</span>
              </div>
            </div>

            <!-- 5. Documentos válidos -->
            <div class="col-sm-6 col-xl-4">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Documentos Válidos</span>
                  <div class="badge bg-success bg-opacity-10 text-success p-2 rounded-3">
                    <i class="bi bi-patch-check-fill fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-success mb-1 font-monospace" id="kpiValidDocuments">-</h3>
                <span class="text-muted small">Em conformidade jurídica ativa</span>
              </div>
            </div>

            <!-- 6. Documentos revogados -->
            <div class="col-sm-6 col-xl-4">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Documentos Revogados</span>
                  <div class="badge bg-danger bg-opacity-10 text-danger p-2 rounded-3">
                    <i class="bi bi-slash-circle fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-danger mb-1 font-monospace" id="kpiRevokedDocuments">-</h3>
                <span class="text-muted small">Cancelados por entidades emissoras</span>
              </div>
            </div>

            <!-- 7. Total de verificações -->
            <div class="col-sm-12 col-xl-4">
              <div class="card p-3 border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="text-secondary small fw-bold text-uppercase" style="font-size: 0.72rem;">Total de Verificações</span>
                  <div class="badge bg-primary bg-opacity-10 text-primary p-2 rounded-3">
                    <i class="bi bi-qr-code-scan fs-5"></i>
                  </div>
                </div>
                <h3 class="fw-bold text-primary mb-1 font-monospace" id="kpiTotalVerifications">-</h3>
                <span class="text-muted small">Consultas públicas via QR Code / Web</span>
              </div>
            </div>

          </div>

          <!-- ATALHOS RÁPIDOS PARA AS SEÇÕES ADMINISTRATIVAS -->
          <div class="row g-3 mb-4">
            <div class="col-md-3">
              <a href="/admin/institutions" data-route="/admin/institutions" class="card p-3 border-0 shadow-sm rounded-4 text-decoration-none bg-white hover-shadow transition">
                <div class="d-flex align-items-center gap-3">
                  <div class="p-3 bg-primary bg-opacity-10 text-primary rounded-3 fs-4">
                    <i class="bi bi-building-gear"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">Instituições</h6>
                    <span class="text-secondary small">Aprovar, rejeitar ou suspender</span>
                  </div>
                </div>
              </a>
            </div>

            <div class="col-md-3">
              <a href="/admin/documents" data-route="/admin/documents" class="card p-3 border-0 shadow-sm rounded-4 text-decoration-none bg-white hover-shadow transition">
                <div class="d-flex align-items-center gap-3">
                  <div class="p-3 bg-info bg-opacity-10 text-info rounded-3 fs-4">
                    <i class="bi bi-file-earmark-check"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">Documentos</h6>
                    <span class="text-secondary small">Consultar acervo nacional</span>
                  </div>
                </div>
              </a>
            </div>

            <div class="col-md-3">
              <a href="/admin/verifications" data-route="/admin/verifications" class="card p-3 border-0 shadow-sm rounded-4 text-decoration-none bg-white hover-shadow transition">
                <div class="d-flex align-items-center gap-3">
                  <div class="p-3 bg-success bg-opacity-10 text-success rounded-3 fs-4">
                    <i class="bi bi-shield-check"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">Verificações</h6>
                    <span class="text-secondary small">Monitorar validações e IPs</span>
                  </div>
                </div>
              </a>
            </div>

            <div class="col-md-3">
              <a href="/admin/logs" data-route="/admin/logs" class="card p-3 border-0 shadow-sm rounded-4 text-decoration-none bg-white hover-shadow transition">
                <div class="d-flex align-items-center gap-3">
                  <div class="p-3 bg-dark bg-opacity-10 text-dark rounded-3 fs-4">
                    <i class="bi bi-journal-text"></i>
                  </div>
                  <div>
                    <h6 class="fw-bold text-dark mb-0">Auditoria</h6>
                    <span class="text-secondary small">Histórico de ações e segurança</span>
                  </div>
                </div>
              </a>
            </div>
          </div>

          <!-- TABELAS DE MONITORAMENTO EM TEMPO REAL -->
          <div class="row g-4">
            
            <!-- Últimas Instituições Cadastradas -->
            <div class="col-xl-6">
              <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden h-100">
                <div class="p-3 px-4 border-bottom border-light-subtle d-flex justify-content-between align-items-center">
                  <h6 class="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i class="bi bi-buildings text-primary"></i> Instituições Recentes
                  </h6>
                  <a href="/admin/institutions" data-route="/admin/institutions" class="btn btn-link btn-sm text-decoration-none p-0 fw-semibold">
                    Ver todas <i class="bi bi-chevron-right"></i>
                  </a>
                </div>
                <div class="table-responsive">
                  <table class="table table-hover align-middle mb-0 small">
                    <thead class="table-light">
                      <tr>
                        <th>Entidade</th>
                        <th>Tipo</th>
                        <th>Estado</th>
                        <th class="text-end">Ação</th>
                      </tr>
                    </thead>
                    <tbody id="tblRecentInstitutions">
                      <tr>
                        <td colspan="4" class="text-center py-4 text-muted">
                          <div class="spinner-border spinner-border-sm text-primary me-2"></div> A carregar instituições...
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Últimas Verificações Públicas -->
            <div class="col-xl-6">
              <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden h-100">
                <div class="p-3 px-4 border-bottom border-light-subtle d-flex justify-content-between align-items-center">
                  <h6 class="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i class="bi bi-shield-check text-success"></i> Verificações em Tempo Real
                  </h6>
                  <a href="/admin/verifications" data-route="/admin/verifications" class="btn btn-link btn-sm text-decoration-none p-0 fw-semibold">
                    Ver histórico <i class="bi bi-chevron-right"></i>
                  </a>
                </div>
                <div class="table-responsive">
                  <table class="table table-hover align-middle mb-0 small">
                    <thead class="table-light">
                      <tr>
                        <th>Código</th>
                        <th>Resultado</th>
                        <th>IP Origem</th>
                        <th>Data/Hora</th>
                      </tr>
                    </thead>
                    <tbody id="tblRecentVerifications">
                      <tr>
                        <td colspan="4" class="text-center py-4 text-muted">
                          <div class="spinner-border spinner-border-sm text-primary me-2"></div> A carregar verificações...
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  `;
}
