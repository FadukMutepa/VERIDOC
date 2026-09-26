/**
 * 1. Página Inicial (/)
 * Elementos:
 * - Hero section com título, descrição, botões "Verificar documento" e "Entrar"
 * - Mockup visual de certificado autêntico com QR Code
 * - Seção "Como funciona" (3 passos)
 * - Seção de benefícios (Segurança, Confiança, Agilidade)
 * - Seção para instituições (Chamada para cadastro)
 */
export function renderHomePage(): string {
  return `
    <!-- HERO SECTION -->
    <section class="vd-hero-section">
      <div class="container position-relative">
        <div class="row align-items-center g-5">
          <!-- Coluna Texto Hero -->
          <div class="col-lg-7">
            <div class="vd-hero-badge">
              <i class="bi bi-shield-check text-info"></i>
              Tecnologia de Autenticação Digital
            </div>
            
            <h1 class="vd-hero-title">
              Garantia de Autenticidade e Confiança para Documentos Oficiais
            </h1>

            <p class="vd-hero-description">
              O VeriDoc permite que universidades, escolas, empresas e órgãos reguladores emitam diplomas, certidões e declarações com selo criptográfico e QR Code de verificação instantânea.
            </p>

            <div class="d-flex flex-wrap gap-3">
              <a href="/verificar" data-route="/verificar" class="btn btn-vd-primary btn-lg">
                <i class="bi bi-patch-check-fill fs-5"></i>
                Verificar documento
              </a>

              <a href="/login" data-route="/login" class="btn btn-vd-outline btn-lg">
                <i class="bi bi-box-arrow-in-right fs-5"></i>
                Entrar
              </a>
            </div>

            <!-- Indicadores de Confiança -->
            <div class="row mt-5 pt-3 border-top border-light border-opacity-10 g-4">
              <div class="col-auto">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-shield-lock-fill text-info fs-4"></i>
                  <div>
                    <div class="fw-bold text-white small">Imutabilidade</div>
                    <div class="text-secondary small" style="font-size: 0.78rem;">Hash criptográfico único</div>
                  </div>
                </div>
              </div>
              <div class="col-auto">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-qr-code text-info fs-4"></i>
                  <div>
                    <div class="fw-bold text-white small">Leitura Instantânea</div>
                    <div class="text-secondary small" style="font-size: 0.78rem;">QR Code em qualquer câmara</div>
                  </div>
                </div>
              </div>
              <div class="col-auto">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-building-check text-info fs-4"></i>
                  <div>
                    <div class="fw-bold text-white small">Instituições Verificadas</div>
                    <div class="text-secondary small" style="font-size: 0.78rem;">Emissores homologados</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Coluna Card Mockup Hero -->
          <div class="col-lg-5">
            <div class="vd-hero-card-preview">
              <!-- Topo do Card -->
              <div class="d-flex justify-content-between align-items-start mb-4">
                <div class="d-flex align-items-center gap-2">
                  <div class="vd-logo-shield" style="width: 34px; height: 34px; font-size: 1rem;">
                    <i class="bi bi-patch-check"></i>
                  </div>
                  <div>
                    <div class="text-white fw-bold small">Certificado Homologado</div>
                    <div class="text-secondary" style="font-size: 0.75rem;">Instituto Politécnico Nacional</div>
                  </div>
                </div>
                <span class="vd-seal-badge">
                  <i class="bi bi-check-circle-fill me-1"></i> AUTÊNTICO
                </span>
              </div>

              <!-- Corpo do Certificado Simulado -->
              <div class="bg-dark bg-opacity-50 p-3 rounded-3 border border-light border-opacity-10 mb-4">
                <div class="text-secondary small mb-1" style="font-size: 0.72rem;">DOCUMENTO OFICIAL:</div>
                <div class="text-white fw-semibold small mb-2">Engenharia de Software e Sistemas de Informação</div>
                
                <div class="row g-2 text-secondary" style="font-size: 0.75rem;">
                  <div class="col-6">
                    <span class="d-block text-muted">Titular:</span>
                    <span class="text-light">Carlos Eduardo Mendes</span>
                  </div>
                  <div class="col-6">
                    <span class="d-block text-muted">Data Emissão:</span>
                    <span class="text-light">15 de Março de 2026</span>
                  </div>
                </div>
              </div>

              <!-- Rodapé do Card com QR Code e Código -->
              <div class="d-flex align-items-center justify-content-between pt-2">
                <div>
                  <div class="text-secondary small" style="font-size: 0.7rem;">CÓDIGO DE REGISTO:</div>
                  <div class="font-monospace fw-bold text-info fs-6">VD-2026-9A8F2K</div>
                  <div class="text-secondary" style="font-size: 0.68rem;">Hash: e3b0c44298fc1c14...</div>
                </div>

                <div class="p-2 bg-white rounded-3 shadow-sm text-center">
                  <i class="bi bi-qr-code fs-1 text-dark"></i>
                </div>
              </div>

              <div class="mt-4 pt-3 border-top border-light border-opacity-10 text-center">
                <a href="/verificar" data-route="/verificar" class="text-info text-decoration-none small fw-semibold">
                  Testar verificação deste modelo <i class="bi bi-arrow-right ms-1"></i>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SEÇÃO "COMO FUNCIONA" -->
    <section class="vd-section bg-white" id="como-funciona">
      <div class="container text-center">
        <span class="text-primary fw-bold text-uppercase small tracking-wider">Simplicidade & Rigor</span>
        <h2 class="vd-section-title">Como Funciona o VeriDoc</h2>
        <p class="vd-section-subtitle">
          Um fluxo transparente que conecta emissores autorizados a qualquer pessoa que precise comprovar a idoneidade de um documento em segundos.
        </p>

        <div class="row g-4 text-start mt-2">
          <!-- Passo 1 -->
          <div class="col-md-4">
            <div class="vd-feature-card">
              <div class="vd-card-icon-wrapper">
                <i class="bi bi-file-earmark-plus"></i>
              </div>
              <div class="text-muted fw-bold small mb-1">PASSO 01</div>
              <h4 class="fw-bold text-dark fs-5 mb-2">Emissão Institucional</h4>
              <p class="text-secondary small mb-0">
                A instituição credenciada registra o documento no sistema fornecendo os dados do titular e as informações oficiais da certificação.
              </p>
            </div>
          </div>

          <!-- Passo 2 -->
          <div class="col-md-4">
            <div class="vd-feature-card">
              <div class="vd-card-icon-wrapper" style="background-color: #ECFDF5; border-color: #A7F3D0; color: #059669;">
                <i class="bi bi-qr-code-scan"></i>
              </div>
              <div class="text-muted fw-bold small mb-1">PASSO 02</div>
              <h4 class="fw-bold text-dark fs-5 mb-2">Código Único & Selo QR</h4>
              <p class="text-secondary small mb-0">
                O VeriDoc gera instantaneamente um código alfanumérico exclusivo e um QR Code vinculado ao hash criptográfico dos dados.
              </p>
            </div>
          </div>

          <!-- Passo 3 -->
          <div class="col-md-4">
            <div class="vd-feature-card">
              <div class="vd-card-icon-wrapper" style="background-color: #EFF6FF; border-color: #BFDBFE; color: #2563EB;">
                <i class="bi bi-patch-check"></i>
              </div>
              <div class="text-muted fw-bold small mb-1">PASSO 03</div>
              <h4 class="fw-bold text-dark fs-5 mb-2">Validação Pública Instantânea</h4>
              <p class="text-secondary small mb-0">
                Qualquer entidade, empregador ou cidadão aponta a câmara ou digita o código e obtém o veredito oficial: Válido, Revogado ou Expirado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SEÇÃO DE BENEFÍCIOS -->
    <section class="vd-section" style="background-color: #F8FAFC;" id="beneficios">
      <div class="container">
        <div class="row align-items-center g-5">
          <div class="col-lg-5">
            <span class="text-primary fw-bold text-uppercase small tracking-wider">Por que escolher o VeriDoc</span>
            <h2 class="vd-section-title">Confiança Inquestionável para Todos os Intervenientes</h2>
            <p class="text-secondary">
              Projetado para eliminar fraudes, burocracia e custos com autenticação em cartórios ou consultas manuais por email.
            </p>

            <div class="d-flex flex-column gap-3 mt-4">
              <div class="d-flex gap-3">
                <div class="mt-1 text-primary fs-5"><i class="bi bi-shield-fill-check"></i></div>
                <div>
                  <h6 class="fw-bold text-dark mb-1">À Prova de Fraudes</h6>
                  <p class="text-secondary small mb-0">Códigos únicos associados a hashes SHA-256 impossíveis de serem adulterados sem invalidar a checagem.</p>
                </div>
              </div>

              <div class="d-flex gap-3">
                <div class="mt-1 text-primary fs-5"><i class="bi bi-phone"></i></div>
                <div>
                  <h6 class="fw-bold text-dark mb-1">Sem Necessidade de Apps</h6>
                  <p class="text-secondary small mb-0">A verificação funciona nativamente no navegador de qualquer smartphone via QR Code ou digitação.</p>
                </div>
              </div>

              <div class="d-flex gap-3">
                <div class="mt-1 text-primary fs-5"><i class="bi bi-arrow-repeat"></i></div>
                <div>
                  <h6 class="fw-bold text-dark mb-1">Gestão Completa de Ciclo de Vida</h6>
                  <p class="text-secondary small mb-0">As instituições podem revogar documentos com justificativa legal ou definir prazos de expiração.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="col-lg-7">
            <div class="row g-3">
              <div class="col-sm-6">
                <div class="p-4 bg-white rounded-4 border border-light-subtle h-100 shadow-sm">
                  <div class="text-primary fs-2 mb-3"><i class="bi bi-mortarboard-fill"></i></div>
                  <h5 class="fw-bold text-dark">Para Universidades</h5>
                  <p class="text-secondary small mb-0">Emissão de diplomas digitais e históricos acadêmicos com validade garantida e suporte contra plágio.</p>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="p-4 bg-white rounded-4 border border-light-subtle h-100 shadow-sm">
                  <div class="text-primary fs-2 mb-3"><i class="bi bi-briefcase-fill"></i></div>
                  <h5 class="fw-bold text-dark">Para Empresas & RH</h5>
                  <p class="text-secondary small mb-0">Validação imediata do currículo e títulos de candidatos em processos seletivos sem risco de certificados falsos.</p>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="p-4 bg-white rounded-4 border border-light-subtle h-100 shadow-sm">
                  <div class="text-primary fs-2 mb-3"><i class="bi bi-award-fill"></i></div>
                  <h5 class="fw-bold text-dark">Para Conselhos Profissionais</h5>
                  <p class="text-secondary small mb-0">Emissão de carteiras profissionais, licenças e certidões de regularidade com rastreabilidade total.</p>
                </div>
              </div>
              <div class="col-sm-6">
                <div class="p-4 bg-white rounded-4 border border-light-subtle h-100 shadow-sm">
                  <div class="text-primary fs-2 mb-3"><i class="bi bi-person-check-fill"></i></div>
                  <h5 class="fw-bold text-dark">Para os Cidadãos</h5>
                  <p class="text-secondary small mb-0">Portabilidade dos seus títulos e certificados em formato digital com autenticidade verificável em qualquer lugar.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SEÇÃO PARA INSTITUIÇÕES (CTA) -->
    <section class="vd-section" style="background: linear-gradient(135deg, #0A1428 0%, #0F1D38 100%);">
      <div class="container text-center text-white py-4">
        <div class="vd-hero-badge mx-auto mb-3">
          <i class="bi bi-building-add text-info"></i>
          Credenciamento Oficial
        </div>
        <h2 class="display-6 fw-bold mb-3 text-white">Sua Instituição Ainda Emite Documentos em Papel Sem Selo Digital?</h2>
        <p class="lead text-light text-opacity-75 mx-auto mb-4" style="max-width: 680px;">
          Modernize seus processos de certificação, proteja o prestígio da sua marca acadêmica ou corporativa e ofereça verificação instantânea aos seus alunos e clientes.
        </p>

        <div class="d-flex justify-content-center gap-3 flex-wrap">
          <a href="/instituicao/cadastro" data-route="/instituicao/cadastro" class="btn btn-vd-primary btn-lg">
            <i class="bi bi-building me-1"></i> Cadastrar Minha Instituição
          </a>
          <a href="/login" data-route="/login" class="btn btn-vd-outline btn-lg">
            <i class="bi bi-box-arrow-in-right me-1"></i> Já Tenho Acesso
          </a>
        </div>
      </div>
    </section>
  `;
}
