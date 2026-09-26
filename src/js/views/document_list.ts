import { authService } from '../services/auth';

/**
 * Página: Lista de Documentos Emitidos (/instituicao/documentos)
 * Mostra Código, Titular, Tipo, Data, Estado e Ações (Visualizar, Verificar, Revogar)
 */
export function renderDocumentListPage(): string {
  const user = authService.getUser();

  if (!user) {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 500px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-lock"></i></div>
          <h4 class="fw-bold text-dark">Acesso Restrito</h4>
          <p class="text-secondary small mb-4">Autentique-se para consultar os documentos da sua instituição.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">Entrar</a>
        </div>
      </div>
    `;
  }

  return `
    <div class="py-4 bg-dark text-white border-bottom border-light border-opacity-10" style="background: radial-gradient(circle at 80% 0%, #172E5A 0%, #0A1428 65%, #050B16 100%) !important;">
      <div class="container">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-primary text-white">REPOSITÓRIO DE CERTIFICAÇÕES</span>
              <span class="text-secondary small">Instituição: <strong>${user.institutionName || 'Administração Central'}</strong></span>
            </div>
            <h2 class="fw-bold mb-0 text-white">Documentos Oficiais Emitidos</h2>
          </div>

          <div class="d-flex gap-2">
            <a href="/instituicao/documentos/novo" data-route="/instituicao/documentos/novo" class="btn btn-vd-primary btn-sm">
              <i class="bi bi-patch-plus me-1"></i> Emitir Novo Documento
            </a>
            <a href="/instituicao/dashboard" data-route="/instituicao/dashboard" class="btn btn-outline-light btn-sm">
              <i class="bi bi-speedometer2 me-1"></i> Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-5">
      <!-- Alerta de Ação -->
      <div id="docListAlert" class="d-none mb-4"></div>

      <!-- Barra de Filtros e Busca -->
      <div class="card border border-light-subtle rounded-4 shadow-sm bg-white p-3 mb-4">
        <div class="row g-3 align-items-center">
          <div class="col-md-5">
            <div class="input-group">
              <span class="input-group-text bg-light border-end-0 text-muted"><i class="bi bi-search"></i></span>
              <input 
                type="text" 
                id="docSearchInput" 
                class="form-control border-start-0" 
                placeholder="Buscar por código (ex: VD-2026), titular ou curso..."
              >
            </div>
          </div>

          <div class="col-md-4">
            <div class="d-flex align-items-center gap-2">
              <span class="small text-muted text-nowrap">Estado:</span>
              <select id="docStatusFilter" class="form-select form-select-sm">
                <option value="">Todos os Estados</option>
                <option value="valid">Válidos (VALID)</option>
                <option value="revoked">Revogados (REVOKED)</option>
                <option value="expired">Expirados (EXPIRED)</option>
              </select>
            </div>
          </div>

          <div class="col-md-3 text-md-end">
            <button class="btn btn-outline-secondary btn-sm" id="btnRefreshDocList">
              <i class="bi bi-arrow-clockwise me-1"></i> Atualizar Lista
            </button>
          </div>
        </div>
      </div>

      <!-- Tabela Principal de Documentos -->
      <div class="card border border-light-subtle rounded-4 shadow-sm overflow-hidden bg-white">
        <div class="table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead class="table-light text-secondary small text-uppercase">
              <tr>
                <th class="ps-4">Código Único</th>
                <th>Titular</th>
                <th>Tipo de Documento</th>
                <th>Data Emissão</th>
                <th>Estado</th>
                <th class="text-end pe-4">Ações</th>
              </tr>
            </thead>
            <tbody class="small" id="docsTableBody">
              <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                  <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                  A carregar documentos do MySQL...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="card-footer bg-white py-3 px-4 border-top border-light-subtle d-flex justify-content-between align-items-center small text-secondary">
          <span id="docCountSummary">A carregar registos...</span>
          <a href="/instituicao/documentos/novo" data-route="/instituicao/documentos/novo" class="text-primary text-decoration-none fw-semibold">
            + Emitir outro documento
          </a>
        </div>
      </div>
    </div>

    <!-- MODAL 1: VISUALIZAR DOCUMENTO COMPLETO E QR CODE -->
    <div class="modal fade" id="modalViewDoc" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div class="modal-header bg-dark text-white border-0 py-3">
            <div class="d-flex align-items-center gap-2">
              <div class="vd-logo-shield" style="width: 32px; height: 32px; font-size: 0.95rem;">
                <i class="bi bi-shield-check"></i>
              </div>
              <h5 class="modal-title fw-bold text-white" id="modalViewTitle">Detalhes do Documento</h5>
            </div>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4 bg-light" id="modalViewBody">
            <!-- Conteúdo injetado dinamicamente -->
          </div>
          <div class="modal-footer bg-white border-top border-light-subtle">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Fechar</button>
            <a href="#" id="modalBtnVerify" class="btn btn-vd-primary btn-sm">
              <i class="bi bi-patch-check me-1"></i> Validar Publicamente
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 2: REVOGAR DOCUMENTO COM JUSTIFICATIVA LEGAL -->
    <div class="modal fade" id="modalRevokeDoc" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom border-light-subtle pb-3">
            <div class="d-flex align-items-center gap-2">
              <div class="text-danger fs-4"><i class="bi bi-shield-x"></i></div>
              <h5 class="modal-title fw-bold text-dark">Revogação Oficial de Documento</h5>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <div class="alert alert-warning py-2 px-3 small border-warning mb-3">
              <i class="bi bi-exclamation-triangle me-1"></i>
              <strong>Atenção:</strong> A revogação altera o estado público do documento para <strong>REVOKED</strong> de forma permanente no MySQL e audita a identidade do operador.
            </div>

            <p class="text-secondary small mb-2">
              Documento: <strong class="text-dark font-monospace" id="revokeModalDocCode">-</strong><br>
              Titular: <span class="text-dark fw-semibold" id="revokeModalDocHolder">-</span>
            </p>

            <div class="mb-3">
              <label for="revokeReasonInput" class="vd-form-label">Justificativa Legal da Revogação *</label>
              <textarea 
                id="revokeReasonInput" 
                class="form-control vd-form-control" 
                rows="3" 
                placeholder="Ex: Anulação por decisão judicial, duplicidade ou cancelamento de matrícula..."
                required
              ></textarea>
              <span class="text-muted small" style="font-size: 0.75rem;">Mínimo de 5 caracteres. Ficará registrado no histórico do documento.</span>
            </div>

            <div id="revokeAlertBox" class="d-none mb-3"></div>

            <input type="hidden" id="revokeDocIdInput" value="">

            <div class="d-flex justify-content-end gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-danger btn-sm" id="btnConfirmRevoke">
                <i class="bi bi-slash-circle me-1"></i> Confirmar Revogação
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
