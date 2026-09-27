import { authService, InstitutionItem } from '../services/auth';
import { escapeHtml } from '../utils/sanitize';

/**
 * Gestão Centralizada de Instituições (/admin/institutions)
 * Acesso exclusivo a utilizadores com role ADMIN.
 * Funcionalidades:
 * - Pesquisar (Nome, email, responsável, cidade)
 * - Filtrar por status (Todos, Pendentes, Aprovadas, Suspensas, Rejeitadas)
 * - Aprovar (Homologar formalmente para emissão)
 * - Suspender (Bloquear temporariamente emissões)
 * - Rejeitar (Recusar candidatura)
 * - Visualizar (Detalhes completos cadastrais e estatísticas)
 */
export function renderAdminInstitutionsPage(): string {
  const user = authService.getUser();

  if (!user || user.role !== 'admin') {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 520px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-x"></i></div>
          <h4 class="fw-bold text-dark">Acesso Restrito ao Administrador</h4>
          <p class="text-secondary small mb-4">Esta funcionalidade requer privilégios de Administrador Geral do VeriDoc.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">
            <i class="bi bi-box-arrow-in-right me-1"></i> Iniciar Sessão
          </a>
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

          <a href="/admin/institutions" data-route="/admin/institutions" class="btn text-start vd-dash-menu-item active">
            <i class="bi bi-building-gear"></i> Instituições
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

      <!-- CONTEÚDO PRINCIPAL: GESTÃO DE INSTITUIÇÕES -->
      <main class="flex-grow-1 p-3 p-md-4 p-xl-5 bg-light overflow-auto">
        <div class="container-fluid p-0">
          
          <!-- Cabeçalho -->
          <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom border-light-subtle">
            <div>
              <div class="d-flex align-items-center gap-2 mb-1">
                <span class="badge bg-primary px-2.5 py-1 text-white fw-bold small">REGISTRO OFICIAL</span>
                <span class="text-muted small">| Credenciamento e Homologação</span>
              </div>
              <h2 class="fw-bold text-dark mb-0">Gestão de Instituições de Ensino</h2>
            </div>

            <div class="d-flex flex-wrap align-items-center gap-2">
              <button class="btn btn-outline-secondary btn-sm" id="btnRefreshInstitutions">
                <i class="bi bi-arrow-repeat me-1"></i> Atualizar Lista
              </button>
            </div>
          </div>

          <!-- CARDS RESUMIDOS POR ESTADO -->
          <div class="row g-3 mb-4">
            <div class="col-6 col-md-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 bg-white cursor-pointer institution-stat-card" data-filter="all">
                <span class="text-muted small fw-bold text-uppercase" style="font-size: 0.7rem;">Todas</span>
                <h4 class="fw-bold text-dark mb-0 font-monospace" id="statInstTotal">-</h4>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 bg-white cursor-pointer institution-stat-card border-warning border-opacity-50" data-filter="pending">
                <span class="text-warning small fw-bold text-uppercase" style="font-size: 0.7rem;">Pendentes</span>
                <h4 class="fw-bold text-warning mb-0 font-monospace" id="statInstPending">-</h4>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 bg-white cursor-pointer institution-stat-card" data-filter="approved">
                <span class="text-success small fw-bold text-uppercase" style="font-size: 0.7rem;">Aprovadas</span>
                <h4 class="fw-bold text-success mb-0 font-monospace" id="statInstApproved">-</h4>
              </div>
            </div>
            <div class="col-6 col-md-3">
              <div class="card p-3 border-0 shadow-sm rounded-4 bg-white cursor-pointer institution-stat-card" data-filter="suspended">
                <span class="text-danger small fw-bold text-uppercase" style="font-size: 0.7rem;">Suspensas</span>
                <h4 class="fw-bold text-danger mb-0 font-monospace" id="statInstSuspended">-</h4>
              </div>
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
                    id="inputSearchInstitutions" 
                    class="form-control border-light-subtle" 
                    placeholder="Pesquisar por nome, email, responsável, cidade..."
                    autocomplete="off"
                  >
                  <button class="btn btn-outline-secondary btn-sm" type="button" id="btnClearSearch">
                    <i class="bi bi-x"></i>
                  </button>
                </div>
              </div>

              <!-- Filtro por Estado -->
              <div class="col-md-6 col-lg-4">
                <div class="d-flex align-items-center gap-2">
                  <label for="selectStatusFilter" class="small fw-bold text-secondary text-nowrap mb-0">Estado:</label>
                  <select id="selectStatusFilter" class="form-select form-select-sm border-light-subtle">
                    <option value="all">Todos os Estados</option>
                    <option value="pending">Apenas Pendentes (Aguardando)</option>
                    <option value="approved">Apenas Aprovadas (Ativas)</option>
                    <option value="suspended">Apenas Suspensas</option>
                    <option value="rejected">Apenas Rejeitadas</option>
                  </select>
                </div>
              </div>

              <!-- Indicador de Registros -->
              <div class="col-12 col-lg-3 text-lg-end">
                <span class="text-muted small">
                  Mostrando <strong class="text-dark font-monospace" id="countInstitutionsShown">0</strong> instituição(ões)
                </span>
              </div>

            </div>
          </div>

          <!-- TABELA DE INSTITUIÇÕES -->
          <div class="card border-0 shadow-sm rounded-4 bg-white overflow-hidden">
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0" id="tableInstitutions">
                <thead class="table-light">
                  <tr>
                    <th style="width: 60px;">ID</th>
                    <th>Instituição de Ensino</th>
                    <th>Tipo</th>
                    <th>Localização</th>
                    <th>Contato & Responsável</th>
                    <th>Docs</th>
                    <th>Estado</th>
                    <th class="text-end" style="min-width: 170px;">Ações</th>
                  </tr>
                </thead>
                <tbody id="institutionsTableBody">
                  <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                      <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                      A carregar lista de instituições...
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

    </div>

    <!-- MODAL DE VISUALIZAÇÃO COMPLETA DA INSTITUIÇÃO -->
    <div class="modal fade" id="modalViewInstitution" tabindex="-1" aria-labelledby="modalViewInstitutionLabel" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-header border-bottom border-light-subtle bg-light">
            <h5 class="modal-title fw-bold text-dark d-flex align-items-center gap-2" id="modalViewInstitutionLabel">
              <i class="bi bi-building text-primary"></i> Detalhes da Instituição
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body p-4" id="modalViewInstitutionBody">
            <div class="text-center py-4">
              <div class="spinner-border text-primary"></div>
            </div>
          </div>
          <div class="modal-footer border-top border-light-subtle">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fechar</button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE ALTERAÇÃO DE STATUS (APROVAR / SUSPENDER / REJEITAR) -->
    <div class="modal fade" id="modalChangeStatus" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-4 border-0 shadow">
          <div class="modal-header border-bottom border-light-subtle">
            <h5 class="modal-title fw-bold text-dark d-flex align-items-center gap-2" id="changeStatusTitle">
              <i class="bi bi-shield-check text-primary"></i> Homologação de Instituição
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
          </div>
          <div class="modal-body p-4">
            <input type="hidden" id="changeStatusInstId">
            <input type="hidden" id="changeStatusNewStatus">

            <p class="text-secondary small mb-3" id="changeStatusPrompt">
              Confirme a atualização do status cadastral da entidade.
            </p>

            <div class="mb-3">
              <label for="changeStatusReason" class="vd-form-label mb-1">
                Justificativa / Motivo da Decisão Administrativa (gravado na auditoria):
              </label>
              <textarea 
                id="changeStatusReason" 
                class="form-control" 
                rows="3" 
                placeholder="Ex: Entidade homologada com verificação documental deferida pelo MEC."
              ></textarea>
            </div>

            <div class="alert alert-info py-2 px-3 small rounded-3 mb-0" id="changeStatusNote">
              <i class="bi bi-info-circle me-1"></i> Esta alteração entrará em vigor imediatamente para todos os operadores da instituição.
            </div>
          </div>
          <div class="modal-footer border-top border-light-subtle">
            <button type="button" class="btn btn-light btn-sm" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-vd-primary btn-sm px-3" id="btnConfirmStatusChange">
              Confirmar Alteração
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
