import { authService } from '../services/auth';

/**
 * Página: Emissão de Novo Documento (/instituicao/documentos/novo)
 * Somente instituições aprovadas e utilizadores autorizados.
 * Validação rigorosa no servidor, código único anti-colisão, hash SHA-256 e QR Code.
 */
export function renderDocumentCreatePage(): string {
  const user = authService.getUser();

  if (!user) {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-0 shadow-sm mx-auto rounded-4" style="max-width: 500px;">
          <div class="text-danger fs-1 mb-3"><i class="bi bi-shield-lock"></i></div>
          <h4 class="fw-bold text-dark">Acesso Restrito</h4>
          <p class="text-secondary small mb-4">Inicie sessão para emitir documentos oficiais.</p>
          <a href="/login" data-route="/login" class="btn btn-vd-primary">Entrar</a>
        </div>
      </div>
    `;
  }

  if (user.role !== 'admin' && user.institutionStatus !== 'approved') {
    return `
      <div class="container py-5 text-center">
        <div class="card p-5 border-warning border-opacity-50 shadow-sm mx-auto rounded-4" style="max-width: 600px;">
          <div class="text-warning fs-1 mb-3"><i class="bi bi-exclamation-triangle"></i></div>
          <h4 class="fw-bold text-dark">Emissão Não Autorizada</h4>
          <p class="text-secondary small mb-4">
            A sua instituição encontra-se com o status <strong>${(user.institutionStatus || 'PENDING').toUpperCase()}</strong>.
            Apenas entidades devidamente <strong>APROVADAS</strong> podem emitir certificados com validade jurídica.
          </p>
          <a href="/instituicao/dashboard" data-route="/instituicao/dashboard" class="btn btn-outline-secondary">
            Voltar ao Dashboard
          </a>
        </div>
      </div>
    `;
  }

  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="py-4 bg-dark text-white border-bottom border-light border-opacity-10" style="background: radial-gradient(circle at 80% 0%, #172E5A 0%, #0A1428 65%, #050B16 100%) !important;">
      <div class="container">
        <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge bg-primary text-white">EMISSÃO OFICIAL</span>
              <span class="text-secondary small">Instituição: <strong>${user.institutionName || 'VeriDoc Authority'}</strong></span>
            </div>
            <h2 class="fw-bold mb-0 text-white">Emitir Novo Documento Autêntico</h2>
          </div>

          <div class="d-flex gap-2">
            <a href="/instituicao/documentos" data-route="/instituicao/documentos" class="btn btn-vd-outline btn-sm">
              <i class="bi bi-file-earmark-text me-1"></i> Ver Documentos
            </a>
            <a href="/instituicao/dashboard" data-route="/instituicao/dashboard" class="btn btn-outline-light btn-sm">
              <i class="bi bi-speedometer2 me-1"></i> Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-9 col-xl-8">

          <!-- Alert de Feedback -->
          <div id="createDocAlert" class="d-none mb-4"></div>

          <!-- Card do Formulário -->
          <div class="card border border-light-subtle rounded-4 shadow-sm bg-white p-4 p-md-5">
            <div class="d-flex align-items-center gap-2 mb-4 pb-3 border-bottom border-light-subtle">
              <div class="vd-logo-shield" style="width: 38px; height: 38px; font-size: 1.1rem;">
                <i class="bi bi-patch-plus"></i>
              </div>
              <div>
                <h5 class="fw-bold text-dark mb-0">Dados do Documento e Titular</h5>
                <span class="text-secondary small">Todos os dados passarão por validação e assinatura criptográfica</span>
              </div>
            </div>

            <form id="formCreateDocument">
              
              <!-- 1. Nome completo do titular -->
              <div class="mb-4">
                <label for="docHolderName" class="vd-form-label">Nome Completo do Titular *</label>
                <div class="input-group">
                  <span class="input-group-text bg-light text-muted border-end-0"><i class="bi bi-person"></i></span>
                  <input 
                    type="text" 
                    id="docHolderName" 
                    class="form-control vd-form-control border-start-0" 
                    placeholder="Ex: Carlos Eduardo de Oliveira Mendes" 
                    required
                  >
                </div>
                <span class="text-muted small" style="font-size: 0.75rem;">Nome exatamente como constará no certificado ou diploma impresso.</span>
              </div>

              <div class="row g-3 mb-4">
                <!-- 2. Tipo de documento -->
                <div class="col-md-6">
                  <label for="docType" class="vd-form-label">Tipo de Documento *</label>
                  <select id="docType" class="form-select vd-form-control" required>
                    <option value="" disabled selected>Selecione o tipo...</option>
                    <option value="Diploma de Licenciatura">Diploma de Licenciatura</option>
                    <option value="Diploma de Mestrado">Diploma de Mestrado</option>
                    <option value="Diploma de Doutoramento">Diploma de Doutoramento</option>
                    <option value="Certificado de Pós-Graduação">Certificado de Pós-Graduação</option>
                    <option value="Certificado de Conclusão de Curso">Certificado de Conclusão de Curso</option>
                    <option value="Declaração Provisória de Matrícula">Declaração Provisória de Matrícula</option>
                    <option value="Certidão de Regularidade Profissional">Certidão de Regularidade Profissional</option>
                    <option value="Alvará / Licença Institucional">Alvará / Licença Institucional</option>
                    <option value="Outro Documento Oficial">Outro Documento Oficial</option>
                  </select>
                </div>

                <!-- 3. Curso / Certificação -->
                <div class="col-md-6">
                  <label for="docCourse" class="vd-form-label">Curso / Formação *</label>
                  <input 
                    type="text" 
                    id="docCourse" 
                    class="form-control vd-form-control" 
                    placeholder="Ex: Engenharia de Software" 
                    required
                  >
                </div>

                <!-- 4. Área -->
                <div class="col-md-6">
                  <label for="docArea" class="vd-form-label">Área Científica / Profissional</label>
                  <input 
                    type="text" 
                    id="docArea" 
                    class="form-control vd-form-control" 
                    placeholder="Ex: Ciências Tecnológicas e da Computação"
                  >
                </div>

                <!-- 5. Data de emissão -->
                <div class="col-md-3">
                  <label for="docIssueDate" class="vd-form-label">Data de Emissão *</label>
                  <input 
                    type="date" 
                    id="docIssueDate" 
                    class="form-control vd-form-control" 
                    value="${today}" 
                    required
                  >
                </div>

                <!-- 6. Data de validade -->
                <div class="col-md-3">
                  <label for="docExpiryDate" class="vd-form-label">Data de Validade</label>
                  <input 
                    type="date" 
                    id="docExpiryDate" 
                    class="form-control vd-form-control" 
                    placeholder="Opcional"
                  >
                  <span class="text-muted small" style="font-size: 0.72rem;">Deixar vazio se vitalício</span>
                </div>
              </div>

              <!-- 7. Descrição -->
              <div class="mb-3">
                <label for="docDescription" class="vd-form-label">Descrição do Documento</label>
                <textarea 
                  id="docDescription" 
                  class="form-control vd-form-control" 
                  rows="3" 
                  placeholder="Ex: Certifica-se que o titular completou com êxito todas as unidades curriculares com média final de 18 valores..."
                ></textarea>
              </div>

              <!-- 8. Observações -->
              <div class="mb-4">
                <label for="docObservations" class="vd-form-label">Observações Legais / Referências Internas</label>
                <input 
                  type="text" 
                  id="docObservations" 
                  class="form-control vd-form-control" 
                  placeholder="Ex: Registado no Livro de Atas nº 42, Folha 88, Processo Académico 2026/A1"
                >
              </div>

              <!-- Termos de Emissão -->
              <div class="p-3 bg-light rounded-3 mb-4 border border-light-subtle small text-secondary">
                <div class="d-flex align-items-center gap-2 mb-1 fw-bold text-dark">
                  <i class="bi bi-shield-check text-primary"></i>
                  Processo Automático e Inviolável no Servidor:
                </div>
                Ao clicar em <strong>"Emitir Documento"</strong>, o servidor gerará um código alfanumérico único (ex: <code>VD-2026-XXXXXXXX</code>) testado contra colisões, calculará a assinatura digital <strong>SHA-256</strong> e produzirá o <strong>QR Code oficial</strong> gravando a transação em log de auditoria.
              </div>

              <!-- Botão de Ação -->
              <div class="d-flex justify-content-between align-items-center">
                <a href="/instituicao/documentos" data-route="/instituicao/documentos" class="text-secondary small text-decoration-none">
                  <i class="bi bi-arrow-left me-1"></i> Cancelar e Voltar
                </a>
                <button type="submit" class="btn btn-vd-primary btn-lg px-4" id="btnSubmitDoc">
                  <i class="bi bi-patch-check-fill me-2"></i> Emitir Documento Oficial
                </button>
              </div>

            </form>
          </div>

          <!-- Card de Sucesso Imediato (Exibido após emissão) -->
          <div id="docSuccessCard" class="card border-2 border-success rounded-4 shadow-lg bg-white p-4 p-md-5 mt-4 d-none">
            <div class="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom border-light-subtle">
              <div class="d-flex align-items-center gap-2">
                <div class="vd-seal-badge">
                  <i class="bi bi-check-circle-fill me-1"></i> EMITIDO COM SUCESSO
                </div>
                <span class="badge bg-success bg-opacity-10 text-success border border-success">ESTADO: VALID</span>
              </div>
              <span class="text-muted small">Registado no MySQL</span>
            </div>

            <div class="row align-items-center g-4">
              <div class="col-md-7">
                <span class="text-secondary small text-uppercase fw-bold" style="font-size: 0.72rem;">Código Único Gerado:</span>
                <div class="display-6 font-monospace fw-bold text-primary mb-2" id="successDocCode">
                  VD-2026-XXXXXXXX
                </div>

                <div class="mb-3">
                  <span class="text-muted small d-block" style="font-size: 0.75rem;">Titular:</span>
                  <strong class="text-dark fs-5" id="successDocHolder">Nome do Titular</strong>
                </div>

                <div class="row g-2 small mb-3">
                  <div class="col-6">
                    <span class="text-muted d-block" style="font-size: 0.72rem;">Documento:</span>
                    <span class="text-dark fw-semibold" id="successDocType">-</span>
                  </div>
                  <div class="col-6">
                    <span class="text-muted d-block" style="font-size: 0.72rem;">Curso:</span>
                    <span class="text-dark fw-semibold" id="successDocCourse">-</span>
                  </div>
                  <div class="col-6">
                    <span class="text-muted d-block" style="font-size: 0.72rem;">Data de Emissão:</span>
                    <span class="text-dark" id="successDocIssueDate">-</span>
                  </div>
                  <div class="col-6">
                    <span class="text-muted d-block" style="font-size: 0.72rem;">Validade:</span>
                    <span class="text-dark" id="successDocExpiryDate">Vitalício</span>
                  </div>
                </div>

                <div class="p-2 bg-light rounded-2 font-monospace text-secondary mb-3 text-break" style="font-size: 0.68rem;">
                  <strong class="text-dark">Hash SHA-256:</strong> <span id="successDocHash">...</span>
                </div>

                <div class="d-flex flex-wrap gap-2">
                  <a href="/verificar" id="successDocVerifyLink" data-route="/verificar" class="btn btn-vd-primary btn-sm">
                    <i class="bi bi-shield-check me-1"></i> Testar Verificação Pública
                  </a>
                  <a href="/instituicao/documentos" data-route="/instituicao/documentos" class="btn btn-outline-secondary btn-sm">
                    <i class="bi bi-list-check me-1"></i> Ver Todos os Documentos
                  </a>
                  <button type="button" class="btn btn-outline-primary btn-sm" id="btnEmitAnother">
                    <i class="bi bi-plus-lg me-1"></i> Emitir Outro
                  </button>
                </div>
              </div>

              <!-- Selo QR Code -->
              <div class="col-md-5 text-center">
                <div class="p-3 bg-white rounded-4 border border-light-subtle shadow-sm d-inline-block">
                  <img src="" id="successDocQrImage" alt="QR Code VeriDoc" class="img-fluid rounded-3" style="width: 220px; height: 220px;">
                  <div class="mt-2 text-secondary small fw-semibold" style="font-size: 0.75rem;">
                    <i class="bi bi-qr-code me-1"></i> Selo Digital de Autenticidade
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}
