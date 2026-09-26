/**
 * Página Pública de Verificação (/verificar e /verificar/{codigo})
 * Acesso livre sem exigir autenticação.
 * Exibe exatamente os 4 estados:
 * - DOCUMENTO VÁLIDO (com Titular, Tipo, Curso, Instituição, Data de emissão, Estado, Código)
 * - DOCUMENTO NÃO ENCONTRADO
 * - DOCUMENTO REVOGADO
 * - DOCUMENTO EXPIRADO
 */

export function renderVerifyPage(initialCode?: string): string {
  return `
    <!-- Topo Institucional -->
    <div class="py-5" style="background: radial-gradient(circle at 50% 0%, #172E5A 0%, #0A1428 55%, #050B16 100%);">
      <div class="container text-center text-white py-2">
        <div class="vd-hero-badge mx-auto mb-3">
          <i class="bi bi-shield-check text-info"></i>
          Validador Público Nacional
        </div>
        <h1 class="fw-bold mb-2">Verificação Oficial de Documentos</h1>
        <p class="text-secondary mx-auto mb-0" style="max-width: 600px;">
          Consulte a autenticidade e validade jurídica de certificados, diplomas e certidões emitidos pelas instituições credenciadas no VeriDoc.
        </p>
      </div>
    </div>

    <div class="container py-5">
      <div class="vd-verify-container">
        
        <!-- CARD DE ENTRADA (Código ou QR Code) -->
        <div class="vd-verify-card p-4 p-md-5 mb-4 bg-white shadow-sm rounded-4 border border-light-subtle">
          
          <!-- Abas de Seleção: Digitar Código vs Ler QR Code -->
          <ul class="nav nav-pills nav-fill mb-4 p-1 bg-light rounded-3" id="verifyTabs" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active fw-bold small text-dark d-flex align-items-center justify-content-center gap-2" id="code-tab" data-bs-toggle="pill" data-bs-target="#by-code" type="button" role="tab">
                <i class="bi bi-keyboard"></i> Digitar Código
              </button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link fw-bold small text-dark d-flex align-items-center justify-content-center gap-2" id="qr-tab" data-bs-toggle="pill" data-bs-target="#by-qr" type="button" role="tab">
                <i class="bi bi-qr-code-scan"></i> Leitura por QR Code
              </button>
            </li>
          </ul>

          <div class="tab-content" id="verifyTabsContent">
            <!-- Modo 1: Digitar Código -->
            <div class="tab-pane fade show active" id="by-code" role="tabpanel">
              <label for="verificationCodeInput" class="vd-form-label mb-2 fw-semibold">
                Código Único de Identificação (ex: impresso no documento ou sob o QR Code):
              </label>
              <div class="input-group vd-verify-input-group mb-3">
                <input 
                  type="text" 
                  id="verificationCodeInput" 
                  class="form-control font-monospace" 
                  placeholder="Ex: VD-2026-8F72K91X" 
                  value="${initialCode || ''}"
                  autocomplete="off"
                >
                <button class="btn btn-vd-primary px-4" type="button" id="btnVerifyCode">
                  <i class="bi bi-search me-1"></i> Verificar
                </button>
              </div>
              <div class="d-flex align-items-center justify-content-between text-muted small px-1">
                <span><i class="bi bi-info-circle me-1"></i> O código alfanumérico exclusivo é gerado e assinado no servidor.</span>
                <span class="d-none d-md-inline font-monospace">Formato: VD-YYYY-XXXXXXXX</span>
              </div>
            </div>

            <!-- Modo 2: QR Code Scanner -->
            <div class="tab-pane fade" id="by-qr" role="tabpanel">
              <div class="vd-qr-scan-zone text-center p-4 bg-light rounded-4 border border-light-subtle">
                <div class="vd-qr-target-box mx-auto mb-3 position-relative" style="width: 220px; height: 220px; background: #FFFFFF; border-radius: 16px; display: flex; align-items: center; justify-content: center;">
                  <div class="vd-qr-corner vd-corner-tl"></div>
                  <div class="vd-qr-corner vd-corner-tr"></div>
                  <div class="vd-qr-corner vd-corner-bl"></div>
                  <div class="vd-qr-corner vd-corner-br"></div>
                  <div class="text-center text-muted">
                    <i class="bi bi-qr-code-scan fs-1 text-primary d-block mb-1"></i>
                    <span class="small fw-semibold">Área da Câmara</span>
                  </div>
                </div>

                <h5 class="fw-bold text-dark mb-1">Acesso Direto via QR Code</h5>
                <p class="text-secondary small mb-3 mx-auto" style="max-width: 480px;">
                  O QR Code oficial gravado no documento aponta diretamente para a URL de verificação <code>/verificar/{codigo}</code>. Aponte a câmara do telemóvel para aceder de forma instantânea.
                </p>

                <div class="d-flex justify-content-center gap-2">
                  <label class="btn btn-outline-primary btn-sm px-3 py-2 cursor-pointer">
                    <i class="bi bi-camera me-1"></i> Carregar Foto do QR Code
                    <input type="file" id="qrFileInput" accept="image/*" class="d-none">
                  </label>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- ÁREA ONDE O RESULTADO DA VERIFICAÇÃO É RENDERIZADO -->
        <div id="resultContainer" class="card border border-2 rounded-4 shadow-sm bg-white overflow-hidden">
          <div class="p-5 text-center">
            <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
            <h5 class="fw-bold text-dark">A carregar validador oficial...</h5>
            <p class="text-secondary small">Aguardando inserção ou leitura do código de verificação.</p>
          </div>
        </div>

      </div>
    </div>
  `;
}

/**
 * Helper para renderizar o resultado:
 * 1. DOCUMENTO VÁLIDO
 * 2. DOCUMENTO NÃO ENCONTRADO
 * 3. DOCUMENTO REVOGADO
 * 4. DOCUMENTO EXPIRADO
 */
export function buildVerificationResultHtml(data: {
  found: boolean;
  result: 'valid' | 'revoked' | 'expired' | 'not_found';
  title: string;
  message?: string;
  document?: {
    titular: string;
    tipo: string;
    curso: string;
    instituicao: string;
    data_emissao: string;
    data_validade?: string;
    estado: string;
    codigo: string;
    hash?: string;
    qr_code?: string;
    area?: string;
    descricao?: string;
    cidade?: string;
    pais?: string;
  };
  queryCode?: string;
}): string {
  const code = data.document?.codigo || data.queryCode || '-';

  // 1. ESTADO: DOCUMENTO NÃO ENCONTRADO
  if (!data.found || data.result === 'not_found' || !data.document) {
    return `
      <div class="border-top border-5 border-secondary bg-white p-4 p-md-5 text-center">
        <!-- Badge e Título Requerido -->
        <div class="mb-3">
          <span class="badge bg-secondary text-white px-3 py-2 rounded-pill fw-bold text-uppercase fs-6">
            <i class="bi bi-question-circle-fill me-1"></i> Resultado da Consulta
          </span>
        </div>

        <h2 class="display-6 fw-bold text-danger mb-2">DOCUMENTO NÃO ENCONTRADO</h2>
        
        <p class="text-secondary small mx-auto mb-4" style="max-width: 540px;">
          O código consultado <strong>${code}</strong> não se encontra registrado na base de dados nacional de documentos homologados pelo VeriDoc.
        </p>

        <!-- Alerta de Segurança e Falsificação -->
        <div class="alert alert-danger mx-auto text-start small mb-4 rounded-3 border-danger border-opacity-25" style="max-width: 580px;">
          <div class="fw-bold mb-1"><i class="bi bi-shield-slash-fill me-1"></i> Alerta de Segurança:</div>
          <div>
            1. Verifique se digitou o código exatamente como impresso no documento.<br>
            2. Se o documento físico possui este código, ele pode ser <strong>fraudulento, adulterado ou de emissor não credenciado</strong>.<br>
            3. Esta tentativa de verificação foi registrada no log de auditoria com IP e timestamp.
          </div>
        </div>

        <div class="font-monospace text-muted small mb-4">Código testado: <code>${code}</code></div>

        <button type="button" class="btn btn-outline-secondary btn-sm px-4" id="btnResetVerify">
          <i class="bi bi-arrow-repeat me-1"></i> Realizar Nova Consulta
        </button>
      </div>
    `;
  }

  const doc = data.document;
  const isOk = data.result === 'valid';
  const isRevoked = data.result === 'revoked';
  const isExpired = data.result === 'expired';

  const borderColor = isOk ? 'border-success' : isRevoked ? 'border-danger' : 'border-warning';
  const titleClass = isOk ? 'text-success' : isRevoked ? 'text-danger' : 'text-warning';
  const badgeClass = isOk ? 'bg-success text-white' : isRevoked ? 'bg-danger text-white' : 'bg-warning text-dark';

  // Formatadores de data
  const dateEmissaoStr = doc.data_emissao ? new Date(doc.data_emissao).toLocaleDateString('pt-PT') : '-';
  const dateValidadeStr = doc.data_validade ? new Date(doc.data_validade).toLocaleDateString('pt-PT') : 'Vitalício';

  return `
    <div class="border-top border-5 ${borderColor} bg-white p-4 p-md-5">
      
      <!-- Cabeçalho do Resultado -->
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pb-3 mb-4 border-bottom border-light-subtle">
        <div>
          <span class="badge ${badgeClass} px-3 py-1.5 rounded-pill fw-bold text-uppercase small mb-2 d-inline-block">
            <i class="bi ${isOk ? 'bi-patch-check-fill' : isRevoked ? 'bi-slash-circle-fill' : 'bi-clock-history'} me-1"></i>
            Estado Oficial: ${doc.estado}
          </span>
          <h2 class="display-6 fw-bold ${titleClass} mb-0">
            ${isOk ? 'DOCUMENTO VÁLIDO' : isRevoked ? 'DOCUMENTO REVOGADO' : 'DOCUMENTO EXPIRADO'}
          </h2>
        </div>

        <div class="text-md-end">
          <span class="text-muted small d-block">Código do Documento:</span>
          <span class="font-monospace fs-4 fw-bold text-primary">${doc.codigo}</span>
        </div>
      </div>

      <!-- Tarja de Alerta para Documentos Revogados ou Expirados -->
      ${isRevoked ? `
        <div class="alert alert-danger py-3 px-4 rounded-3 mb-4 shadow-sm">
          <div class="d-flex align-items-center gap-2 fw-bold fs-6 mb-1">
            <i class="bi bi-exclamation-octagon-fill fs-5"></i> AVISO: CERTIFICAÇÃO OFICIALMENTE REVOGADA
          </div>
          <div class="small">
            Este documento foi cancelado pela entidade emissora e <strong>não possui qualquer validade jurídica ou acadêmica</strong> perante entidades públicas ou privadas.
          </div>
        </div>
      ` : ''}

      ${isExpired ? `
        <div class="alert alert-warning py-3 px-4 rounded-3 mb-4 shadow-sm">
          <div class="d-flex align-items-center gap-2 fw-bold fs-6 mb-1">
            <i class="bi bi-clock-history fs-5"></i> AVISO: PRAZO DE VALIDADE EXPIRADO
          </div>
          <div class="small">
            A vigência temporal deste certificado expirou em <strong>${dateValidadeStr}</strong>. Para efeito de comprovação atual, o titular deverá solicitar revalidação junto da instituição.
          </div>
        </div>
      ` : ''}

      <!-- OS 7 CAMPOS OBRIGATÓRIOS EXIBIDOS COM DESTAQUE -->
      <div class="row g-4 align-items-center mb-4">
        <div class="col-md-8">
          
          <div class="p-4 bg-light rounded-4 border border-light-subtle">
            <h5 class="fw-bold text-dark mb-3 pb-2 border-bottom border-light-subtle d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-check text-primary"></i> Informações do Registro Nacional
            </h5>

            <div class="row g-3">
              <!-- 1. Titular -->
              <div class="col-12">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Titular:</span>
                <span class="fs-4 fw-bold text-dark">${doc.titular}</span>
              </div>

              <!-- 2. Tipo -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Tipo de Documento:</span>
                <span class="fw-bold text-primary">${doc.tipo}</span>
              </div>

              <!-- 3. Curso -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Curso / Formação:</span>
                <span class="fw-bold text-dark">${doc.curso}</span>
              </div>

              <!-- 4. Instituição -->
              <div class="col-12">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Instituição Emissora Homologada:</span>
                <strong class="text-dark fs-6">${doc.instituicao}</strong>
                ${doc.cidade && doc.pais ? `<span class="text-muted small ms-1">(${doc.cidade}, ${doc.pais})</span>` : ''}
              </div>

              <!-- 5. Data de emissão -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Data de Emissão:</span>
                <span class="fw-semibold text-dark">${dateEmissaoStr}</span>
              </div>

              <!-- Data de validade (se aplicável) -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Data de Validade:</span>
                <span class="fw-semibold text-dark">${dateValidadeStr}</span>
              </div>

              <!-- 6. Estado -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Estado Atual:</span>
                <span class="badge ${badgeClass} fs-6 px-3 py-1">${doc.estado}</span>
              </div>

              <!-- 7. Código -->
              <div class="col-sm-6">
                <span class="text-muted small d-block fw-semibold text-uppercase" style="font-size: 0.72rem;">Código de Verificação:</span>
                <span class="font-monospace fw-bold text-primary fs-6">${doc.codigo}</span>
              </div>
            </div>

            ${doc.descricao ? `
              <div class="mt-3 pt-3 border-top border-light-subtle small text-secondary">
                <strong>Descrição Oficial:</strong> ${doc.descricao}
              </div>
            ` : ''}
          </div>

        </div>

        <!-- Coluna com QR Code Oficial e Carimbo de Autenticidade -->
        <div class="col-md-4 text-center">
          <div class="p-3 bg-white rounded-4 border border-light-subtle shadow-sm d-inline-block">
            ${doc.qr_code ? `
              <img src="${doc.qr_code}" alt="QR Code Oficial" class="img-fluid rounded-3 mb-2" style="width: 200px; height: 200px;">
            ` : `
              <div class="p-4 bg-light text-muted small rounded-3 mb-2">QR Code não disponível</div>
            `}
            <div class="text-secondary small fw-bold">
              <i class="bi bi-qr-code me-1 text-primary"></i> Selo Digital Exclusivo
            </div>
            <div class="text-muted" style="font-size: 0.68rem;">
              URL: /verificar/${doc.codigo}
            </div>
          </div>
        </div>
      </div>

      <!-- Hash Criptográfico e Auditoria -->
      ${doc.hash ? `
        <div class="p-3 bg-dark text-secondary rounded-3 font-monospace small text-break mb-4" style="font-size: 0.72rem;">
          <div class="text-white fw-bold mb-1">
            <i class="bi bi-shield-lock-fill text-info me-1"></i> Assinatura Digital Inviolável (SHA-256):
          </div>
          <span class="text-info">${doc.hash}</span>
        </div>
      ` : ''}

      <!-- Rodapé de Ações da Página Pública -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top border-light-subtle">
        <span class="text-muted small">
          <i class="bi bi-database-check text-success me-1"></i> Consulta pública validada em tempo real na base de dados VeriDoc
        </span>
        <button type="button" class="btn btn-outline-secondary btn-sm px-4" id="btnResetVerify">
          <i class="bi bi-arrow-repeat me-1"></i> Consultar Outro Documento
        </button>
      </div>

    </div>
  `;
}
