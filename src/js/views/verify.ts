/**
 * 2. Página de Verificação (/verificar)
 * Elementos obrigatórios:
 * - Campo para código de verificação
 * - Botão "Verificar"
 * - Área preparada para leitura de QR Code
 * - Área onde futuramente aparecerá o resultado
 */
export function renderVerifyPage(): string {
  return `
    <div class="py-5" style="background: radial-gradient(circle at 50% 0%, #172E5A 0%, #0A1428 55%, #050B16 100%);">
      <div class="container text-center text-white py-3">
        <div class="vd-hero-badge mx-auto mb-3">
          <i class="bi bi-shield-check text-info"></i>
          Portal Oficial de Autenticação
        </div>
        <h1 class="fw-bold mb-2">Verificação de Autenticidade</h1>
        <p class="text-secondary mx-auto" style="max-width: 580px;">
          Digite o código impresso no documento ou utilize a câmara do seu dispositivo para escanear o QR Code de autenticação.
        </p>
      </div>
    </div>

    <div class="container py-5">
      <div class="vd-verify-container">
        
        <!-- CARD PRINCIPAL DE VERIFICAÇÃO -->
        <div class="vd-verify-card p-4 p-md-5 mb-5">
          <!-- Abas de Método: Código vs QR Code -->
          <ul class="nav nav-pills nav-fill mb-4 p-1 bg-light rounded-3" id="verifyTabs" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active fw-bold small text-dark d-flex align-items-center justify-content-center gap-2" id="code-tab" data-bs-toggle="pill" data-bs-target="#by-code" type="button" role="tab">
                <i class="bi bi-keyboard"></i> Digitar Código
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link fw-bold small text-dark d-flex align-items-center justify-content-center gap-2" id="qr-tab" data-bs-toggle="pill" data-bs-target="#by-qr" type="button" role="tab">
                <i class="bi bi-qr-code-scan"></i> Leitura de QR Code
              </button>
            </li>
          </ul>

          <div class="tab-content" id="verifyTabsContent">
            <!-- Método 1: Por Código -->
            <div class="tab-pane fade show active" id="by-code" role="tabpanel">
              <label for="verificationCodeInput" class="vd-form-label mb-2">
                Código Único de Identificação do Documento:
              </label>
              <div class="input-group vd-verify-input-group mb-3">
                <input 
                  type="text" 
                  id="verificationCodeInput" 
                  class="form-control" 
                  placeholder="EX: VD-2026-9A8F2K" 
                  aria-label="Código de verificação"
                  autocomplete="off"
                >
                <button class="btn btn-vd-primary" type="button" id="btnVerifyCode">
                  <i class="bi bi-search me-1"></i> Verificar
                </button>
              </div>
              <div class="d-flex align-items-center justify-content-between text-muted small px-1">
                <span><i class="bi bi-info-circle me-1"></i> O código alfanumérico encontra-se normalmente no rodapé ou no verso do documento.</span>
                <span class="d-none d-md-inline font-monospace">Ex: VD-2026-XXXXXX</span>
              </div>
            </div>

            <!-- Método 2: Área Preparada para QR Code -->
            <div class="tab-pane fade" id="by-qr" role="tabpanel">
              <div class="vd-qr-scan-zone">
                <div class="vd-qr-target-box">
                  <!-- Retícula de Cantos da Câmara -->
                  <div class="vd-qr-corner vd-corner-tl"></div>
                  <div class="vd-qr-corner vd-corner-tr"></div>
                  <div class="vd-qr-corner vd-corner-bl"></div>
                  <div class="vd-qr-corner vd-corner-br"></div>
                  
                  <div class="text-center text-secondary">
                    <i class="bi bi-camera fs-1 d-block mb-1 text-primary opacity-75"></i>
                    <span style="font-size: 0.72rem;" class="fw-semibold text-uppercase">Área da Câmara</span>
                  </div>
                </div>

                <h5 class="fw-bold text-dark mb-1">Escanear QR Code com a Câmara</h5>
                <p class="text-secondary small mb-4 mx-auto" style="max-width: 440px;">
                  Aponte a câmara do seu smartphone ou webcam para o QR Code estampado no documento para verificação imediata.
                </p>

                <div class="d-flex justify-content-center gap-2 flex-wrap">
                  <button type="button" class="btn btn-vd-primary btn-sm px-4 py-2" id="btnActivateCamera">
                    <i class="bi bi-camera-video me-1"></i> Ativar Câmara
                  </button>
                  <button type="button" class="btn btn-outline-secondary btn-sm px-4 py-2" id="btnUploadQR">
                    <i class="bi bi-upload me-1"></i> Carregar Imagem
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ÁREA ONDE FUTURAMENTE APARECERÁ O RESULTADO -->
        <div class="card border border-2 border-dashed border-secondary-subtle rounded-4 p-4 p-md-5 text-center bg-white shadow-sm" id="resultContainer">
          <div class="mb-3">
            <span class="badge bg-light text-primary border border-primary-subtle px-3 py-2 rounded-pill small fw-semibold">
              <i class="bi bi-hourglass-split me-1"></i> Área de Retorno do Resultado
            </span>
          </div>

          <div class="py-4">
            <div class="mx-auto mb-3 text-secondary opacity-50" style="font-size: 3rem;">
              <i class="bi bi-shield-check"></i>
            </div>
            <h4 class="fw-bold text-dark mb-2">Aguardando Validação</h4>
            <p class="text-secondary small mx-auto mb-4" style="max-width: 480px;">
              Assim que um código ou QR Code for submetido, esta seção apresentará a confirmação de autenticidade, o estado da certificação e todos os dados públicos do documento.
            </p>

            <!-- Pré-visualização estrutural dos 4 estados preparados na arquitetura -->
            <div class="mt-4 pt-4 border-top border-light-subtle">
              <div class="text-muted fw-bold small text-uppercase mb-3" style="font-size: 0.72rem; letter-spacing: 0.05em;">
                Estados que serão retornados pela plataforma:
              </div>

              <div class="row g-3 text-start">
                <!-- Estado 1: Válido -->
                <div class="col-md-3 col-6">
                  <div class="p-3 rounded-3 vd-result-state-card vd-state-valid h-100">
                    <div class="d-flex align-items-center gap-1 text-success fw-bold small mb-1">
                      <i class="bi bi-check-circle-fill"></i> Válido
                    </div>
                    <div class="text-secondary" style="font-size: 0.75rem;">
                      Documento autêntico, homologado e sem restrições.
                    </div>
                  </div>
                </div>

                <!-- Estado 2: Revogado -->
                <div class="col-md-3 col-6">
                  <div class="p-3 rounded-3 vd-result-state-card vd-state-revoked h-100">
                    <div class="d-flex align-items-center gap-1 text-danger fw-bold small mb-1">
                      <i class="bi bi-x-circle-fill"></i> Revogado
                    </div>
                    <div class="text-secondary" style="font-size: 0.75rem;">
                      Cancelado pela instituição com justificativa legal.
                    </div>
                  </div>
                </div>

                <!-- Estado 3: Expirado -->
                <div class="col-md-3 col-6">
                  <div class="p-3 rounded-3 vd-result-state-card vd-state-expired h-100">
                    <div class="d-flex align-items-center gap-1 text-warning fw-bold small mb-1">
                      <i class="bi bi-clock-history"></i> Expirado
                    </div>
                    <div class="text-secondary" style="font-size: 0.75rem;">
                      Validade expirada em relação à data corrente.
                    </div>
                  </div>
                </div>

                <!-- Estado 4: Não Encontrado -->
                <div class="col-md-3 col-6">
                  <div class="p-3 rounded-3 vd-result-state-card vd-state-notfound h-100">
                    <div class="d-flex align-items-center gap-1 text-secondary fw-bold small mb-1">
                      <i class="bi bi-question-circle-fill"></i> Não Encontrado
                    </div>
                    <div class="text-secondary" style="font-size: 0.75rem;">
                      Código inexistente (alerta de falsificação).
                    </div>
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
