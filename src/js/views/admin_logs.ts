import { authService } from '../services/auth';

/**
 * Consulta de Logs de Auditoria do Sistema (/admin/logs)
 * Acesso exclusivo ADMIN.
 * Rastreabilidade completa de ações críticas do VeriDoc.
 */
export function renderAdminLogsPage(): string {
  const user = authService.getUser();

  if (!user || user.role !== 'admin') {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 520px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-x"></i></div>
          <h4 class="fw-bold text-dark">Acesso Restrito ao Administrador</h4>
          <p class="text-secondary small mb-4">Esta página requer privilégios de Administrador Geral do VeriDoc.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">Iniciar Sessão</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="d-flex flex-column flex-lg-row min-vh-100">
      
      <!-- SIDEBAR ADMINISTRATIVA -->
      <aside class="vd-dash-sidebar p-3 p-lg-4" style="min-width: 270px; background: #0A1428;">
        <div class="d-flex align-items-center gap-3 pb-4 mb-4 border-bottom border-light border-opacity-10">
          <div class="vd-logo-shield" style="width: 44px; height: 44px; font-size: 1.25rem; background: linear-gradient(135deg, #DC2626 0%, #991B1B 100%);">
            <i class="bi bi-shield-shaded"></i>
          </div>
          <div class="overflow-hidden">
            <h6 class="text-white fw-bold mb-0 text-truncate">Administração Central</h6>
            <span class="badge bg-danger bg-opacity-25 text-white border border-light border-opacity-25 small" style="font-size: 0.68rem;">
              Super Administrador
            </span>
          </div>
        </div>

        <nav class="d-flex flex-column gap-1">
          <span class="text-secondary small fw-bold text-uppercase px-3 mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
            Gestão Governamental
          </span>

          <a href="/admin/dashboard" data-route="/admin/dashboard" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-speedometer2"></i> Dashboard Geral
          </a>

          <a href="/admin/institutions" data-route="/admin/institutions" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-building-gear"></i> Instituições
          </a>

          <a href="/admin/documents" data-route="/admin/documents" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-file-earmark-check"></i> Documentos Globais
          </a>

          <a href="/admin/verifications" data-route="/admin/verifications" class="btn text-start vd-dash-menu-item text-secondary">
            <i class="bi bi-shield-check"></i> Verificações Públicas
          </a>

          <a href="/admin/logs" data-route="/admin/logs" class="btn text-start vd-dash-menu-item active">
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

      <!-- CONTEÚDO PRINCIPAL: LOGS DE AUDITORIA -->
      <main class="flex-grow-1 p-3 p-md-4 p-xl-5 bg-light overflow-auto">
        <div class="container-fluid p-0">
          
          <!-- Cabeçalho -->
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom border-light-subtle">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-dark px-2.5 py-1 text-white fw-bold small">TRILHA FORENSE</span>
                <span class="text-muted small">| Registro Imutável de Eventos do Sistema</span>
              </div>
              <h2 class="fw-bold text-dark mb-0">Logs de Auditoria e Segurança</h2>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2">
              <button class="btn btn-outline-secondary btn-sm" id="btnRefreshLogs">
                <i class="bi bi-arrow-repeat me-1"></i> Atualizar Logs
              </button>
            </div>
          </div>

          <!-- BARRA DE CONTROLE: PESQUISA E FILTROS -->
          <div class="card p-3 p-md-4 border-0 shadow-sm rounded-4 bg-white mb-4">
            <div class="row g-3 align-items-center">
              
              <!-- Pesquisar -->
              <div class="col-md-6 col-lg-5">
                <div class="input-group">
                  <span class="input-group-text bg-light border-light-subtle text-muted">
                    <i class="bi bi-search"></i>
                  </span>
                  <input 
                    type="text" 
                    id="inputSearchLogs" 
                    class="form-control border-light-subtle" 
                    placeholder="Pesquisar nos detalhes, IP de origem, email..."
                    autocomplete="off"
                  >
                </div>
              </div>

              <!-- Filtro por Ação -->
              <div class="col-md-6 col-lg-4">
                <div class="d-flex align-items-center gap-2">
                  <label for="selectLogAction" class="small fw-bold text-secondary text-nowrap mb-0">Ação:</label>
                  <select id="selectLogAction" class="form-select form-select-sm border-light-subtle">
                    <option value="all">Todas as Ações</option>
                    <option value="document_issued">Emissão de Documento (document_issued)</option>
                    <option value="document_revoked">Revogação de Documento (document_revoked)</option>
                    <option value="document_verification">Consulta de Verificação (document_verification)</option>
                    <option value="institution_status_change">Alteração de Status Institucional</option>
                    <option value="user_login">Login de Utilizador (user_login)</option>
                    <option value="failed_login_attempt">Tentativa de Login Falhada</option>
                    <option value="user_logout">Encerramento de Sessão (user_logout)</option>
                    <option value="institution_registered">Cadastro de Instituição</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          <!-- TABELA DE LOGS -->
          <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0" id="tableAuditLogs">
                <thead class="table-light">
                  <tr>
                    <th style="width: 70px;">ID</th>
                    <th>Tipo de Ação</th>
                    <th>Utilizador / Entidade</th>
                    <th>Endereço IP</th>
                    <th>Descrição dos Detalhes</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody id="logsTableBody">
                  <tr>
                    <td colspan="6" class="text-center py-5 text-muted">
                      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                      A carregar registros de auditoria...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

    </div>
  `;
}
