/**
 * 4. Página de Cadastro Institucional (/instituicao/cadastro)
 * Submissão real no MySQL com estado inicial obrigatório PENDING.
 */
export function renderRegisterPage(): string {
  return `
    <div class="py-5" style="background: radial-gradient(circle at 50% 0%, #172E5A 0%, #0A1428 55%, #050B16 100%);">
      <div class="container text-center text-white py-2">
        <div class="vd-hero-badge mx-auto mb-3">
          <i class="bi bi-building-check text-info"></i>
          Credenciamento de Emissor
        </div>
        <h1 class="fw-bold mb-2">Registo de Instituição Emissora</h1>
        <p class="text-secondary mx-auto" style="max-width: 600px;">
          Cadastre a sua entidade. Conforme as regras de segurança, todo novo registo inicia como <strong class="text-warning">PENDING</strong> até que o Administrador valide a candidatura.
        </p>
      </div>
    </div>

    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-lg-10 col-xl-9">
          
          <div class="card border border-light-subtle rounded-4 shadow-sm p-4 p-md-5 bg-white">
            <!-- Box de Mensagens de Sucesso / Erro -->
            <div id="registerAlertBox" class="d-none mb-4"></div>

            <form id="institutionRegisterForm">
              
              <!-- SEÇÃO 1: DADOS DA INSTITUIÇÃO -->
              <div class="mb-5">
                <div class="d-flex align-items-center gap-2 mb-4 pb-2 border-bottom border-light-subtle">
                  <div class="vd-logo-shield" style="width: 32px; height: 32px; font-size: 0.95rem;">
                    <i class="bi bi-building"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold text-dark mb-0">1. Informações da Entidade</h5>
                    <span class="text-muted small">Dados cadastrais da instituição emitente</span>
                  </div>
                </div>

                <div class="row g-3">
                  <!-- Nome da Instituição -->
                  <div class="col-md-8">
                    <label for="institutionName" class="vd-form-label">Nome Oficial da Instituição *</label>
                    <input 
                      type="text" 
                      id="institutionName" 
                      name="name"
                      class="form-control vd-form-control" 
                      placeholder="Ex: Universidade Europeia de Tecnologia" 
                      required
                    >
                  </div>

                  <!-- Tipo -->
                  <div class="col-md-4">
                    <label for="institutionType" class="vd-form-label">Tipo de Entidade *</label>
                    <select id="institutionType" name="type" class="form-select vd-form-control" required>
                      <option value="" disabled selected>Selecione...</option>
                      <option value="universidade">Universidade / Ensino Superior</option>
                      <option value="instituto_tecnico">Instituto Técnico / Profissional</option>
                      <option value="escola_secundaria">Escola Secundária / Básica</option>
                      <option value="orgao_publico">Órgão Governamental / Autarquia</option>
                      <option value="conselho_ordem">Conselho Profissional / Ordem</option>
                      <option value="empresa_formacao">Empresa / Academia de Treinamento</option>
                      <option value="outro">Outro Tipo de Emissor</option>
                    </select>
                  </div>

                  <!-- Cidade -->
                  <div class="col-md-6">
                    <label for="institutionCity" class="vd-form-label">Cidade *</label>
                    <input 
                      type="text" 
                      id="institutionCity" 
                      name="city"
                      class="form-control vd-form-control" 
                      placeholder="Ex: Lisboa, Coimbra, Porto..." 
                      required
                    >
                  </div>

                  <!-- País -->
                  <div class="col-md-6">
                    <label for="institutionCountry" class="vd-form-label">País *</label>
                    <input 
                      type="text" 
                      id="institutionCountry" 
                      name="country"
                      class="form-control vd-form-control" 
                      placeholder="Ex: Portugal, Brasil, Angola..." 
                      required
                    >
                  </div>

                  <!-- Endereço -->
                  <div class="col-12">
                    <label for="institutionAddress" class="vd-form-label">Endereço Sede (Opcional)</label>
                    <input 
                      type="text" 
                      id="institutionAddress" 
                      name="address"
                      class="form-control vd-form-control" 
                      placeholder="Avenida Central, nº 100"
                    >
                  </div>

                  <!-- Email Institucional -->
                  <div class="col-md-4">
                    <label for="institutionEmail" class="vd-form-label">Email Institucional Oficial *</label>
                    <input 
                      type="email" 
                      id="institutionEmail" 
                      name="email"
                      class="form-control vd-form-control" 
                      placeholder="reitoria@instituicao.edu" 
                      required
                    >
                  </div>

                  <!-- Telefone -->
                  <div class="col-md-4">
                    <label for="institutionPhone" class="vd-form-label">Telefone de Contacto *</label>
                    <input 
                      type="tel" 
                      id="institutionPhone" 
                      name="phone"
                      class="form-control vd-form-control" 
                      placeholder="+351 21 000 0000" 
                      required
                    >
                  </div>

                  <!-- Website -->
                  <div class="col-md-4">
                    <label for="institutionWebsite" class="vd-form-label">Website Oficial</label>
                    <input 
                      type="url" 
                      id="institutionWebsite" 
                      name="website"
                      class="form-control vd-form-control" 
                      placeholder="https://www.instituicao.edu"
                    >
                  </div>
                </div>
              </div>

              <!-- SEÇÃO 2: DADOS DO RESPONSÁVEL E ACESSO -->
              <div class="mb-4">
                <div class="d-flex align-items-center gap-2 mb-4 pb-2 border-bottom border-light-subtle">
                  <div class="vd-logo-shield" style="width: 32px; height: 32px; font-size: 0.95rem; background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);">
                    <i class="bi bi-person-badge"></i>
                  </div>
                  <div>
                    <h5 class="fw-bold text-dark mb-0">2. Responsável Legal e Credenciais de Acesso</h5>
                    <span class="text-muted small">Titular responsável pela emissão dos certificados</span>
                  </div>
                </div>

                <div class="row g-3">
                  <!-- Nome do Responsável -->
                  <div class="col-md-6">
                    <label for="responsibleName" class="vd-form-label">Nome Completo do Responsável *</label>
                    <input 
                      type="text" 
                      id="responsibleName" 
                      name="responsible_name"
                      class="form-control vd-form-control" 
                      placeholder="Ex: Dra. Teresa Guimarães" 
                      required
                    >
                  </div>

                  <!-- Email do Responsável -->
                  <div class="col-md-6">
                    <label for="responsibleEmail" class="vd-form-label">Email do Responsável (Utilizador de Acesso) *</label>
                    <input 
                      type="email" 
                      id="responsibleEmail" 
                      name="responsible_email"
                      class="form-control vd-form-control" 
                      placeholder="teresa.guimaraes@instituicao.edu" 
                      required
                    >
                  </div>

                  <!-- Palavra-passe -->
                  <div class="col-md-6">
                    <label for="registerPassword" class="vd-form-label">Palavra-passe de Acesso *</label>
                    <input 
                      type="password" 
                      id="registerPassword" 
                      name="password"
                      class="form-control vd-form-control" 
                      placeholder="Mínimo de 8 caracteres" 
                      required
                    >
                  </div>

                  <!-- Confirmação da Palavra-passe -->
                  <div class="col-md-6">
                    <label for="registerPasswordConfirm" class="vd-form-label">Confirmar Palavra-passe *</label>
                    <input 
                      type="password" 
                      id="registerPasswordConfirm" 
                      name="password_confirmation"
                      class="form-control vd-form-control" 
                      placeholder="Repita a palavra-passe" 
                      required
                    >
                  </div>
                </div>
              </div>

              <!-- Termos e Aceitação -->
              <div class="p-3 bg-light rounded-3 mb-4 border border-light-subtle">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" id="acceptTerms" required>
                  <label class="form-check-label text-secondary small" for="acceptTerms">
                    Declaro sob compromisso de honra a veracidade de todos os dados prestados e reconheço que a instituição iniciará com status <strong>PENDING</strong> até validação dos dados pela Administração Central.
                  </label>
                </div>
              </div>

              <!-- Botão de Ação -->
              <div class="d-flex flex-column flex-sm-row align-items-center justify-content-between gap-3">
                <a href="/login" data-route="/login" class="text-secondary small text-decoration-none">
                  <i class="bi bi-arrow-left me-1"></i> Já possui conta? Ir para o login
                </a>

                <button type="submit" class="btn btn-vd-primary btn-lg px-4" id="btnSubmitRegister">
                  <i class="bi bi-send-check me-2"></i> Submeter Candidatura Institucional
                </button>
              </div>

            </form>
          </div>

        </div>
      </div>
    </div>
  `;
}
