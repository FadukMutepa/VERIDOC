/**
 * 3. Página de Login (/login)
 * Conectada ao backend com validação, sessão segura, hashing e controle de status.
 */
export function renderLoginPage(): string {
  return `
    <div class="vd-auth-wrapper bg-light">
      <div class="container">
        <div class="row justify-content-center">
          <div class="col-md-7 col-lg-5 col-xl-5">
            
            <!-- Card de Login -->
            <div class="vd-auth-card">
              <!-- Cabeçalho do Card -->
              <div class="text-center mb-4">
                <a href="/" data-route="/" class="d-inline-flex align-items-center gap-2 text-decoration-none mb-3">
                  <div class="vd-logo-shield" style="width: 42px; height: 42px;">
                    <i class="bi bi-shield-check fs-4"></i>
                  </div>
                  <span class="fs-4 fw-bold text-dark">Veri<span class="text-primary">Doc</span></span>
                </a>
                <h4 class="fw-bold text-dark mb-1">Acesso Institucional</h4>
                <p class="text-secondary small mb-0">Autenticação segura conectada ao banco de dados MySQL</p>
              </div>

              <!-- Mensagem de Alerta Dinâmica -->
              <div id="loginAlertBox" class="d-none mb-3"></div>

              <!-- Formulário -->
              <form id="loginForm">
                <!-- Campo: Email -->
                <div class="mb-3">
                  <label for="loginEmail" class="vd-form-label">Email Corporativo ou Académico</label>
                  <div class="input-group">
                    <span class="input-group-text bg-white border-end-0 text-secondary">
                      <i class="bi bi-envelope"></i>
                    </span>
                    <input 
                      type="email" 
                      id="loginEmail" 
                      class="form-control vd-form-control border-start-0 ps-0" 
                      placeholder="nome@instituicao.edu" 
                      required
                    >
                  </div>
                </div>

                <!-- Campo: Palavra-passe -->
                <div class="mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label for="loginPassword" class="vd-form-label mb-0">Palavra-passe</label>
                    <button type="button" class="btn btn-link p-0 text-primary text-decoration-none small" style="font-size: 0.8rem;" id="btnOpenRecovery">
                      Recuperar palavra-passe?
                    </button>
                  </div>
                  <div class="input-group">
                    <span class="input-group-text bg-white border-end-0 text-secondary">
                      <i class="bi bi-lock"></i>
                    </span>
                    <input 
                      type="password" 
                      id="loginPassword" 
                      class="form-control vd-form-control border-start-0 ps-0" 
                      placeholder="••••••••••••" 
                      required
                    >
                  </div>
                </div>

                <!-- Lembrar sessão -->
                <div class="form-check mb-4">
                  <input class="form-check-input" type="checkbox" id="rememberMe">
                  <label class="form-check-label text-secondary small" for="rememberMe">
                    Manter sessão iniciada neste dispositivo
                  </label>
                </div>

                <!-- Botão: Entrar -->
                <button type="submit" class="btn btn-vd-primary w-100 py-2 justify-content-center mb-3" id="btnLoginSubmit">
                  <i class="bi bi-box-arrow-in-right me-1"></i> Entrar no Painel
                </button>
              </form>

              <!-- Painel de Contas de Teste para Avaliação Imediata -->
              <div class="bg-light p-3 rounded-3 border border-light-subtle mb-4">
                <span class="text-secondary fw-bold text-uppercase d-block mb-2" style="font-size: 0.7rem; letter-spacing: 0.05em;">
                  Credenciais de Teste Configuradas no Banco MySQL:
                </span>
                <div class="d-flex flex-column gap-1.5">
                  <button type="button" class="btn btn-sm btn-outline-danger text-start d-flex justify-content-between align-items-center py-1.5 px-2" id="fillAdmin">
                    <div>
                      <strong class="d-block text-danger" style="font-size: 0.75rem;">1. Administrador Geral (Aprova/Suspende)</strong>
                      <span class="text-muted font-monospace" style="font-size: 0.7rem;">admin@veridoc.app</span>
                    </div>
                    <span class="badge bg-danger text-white">Preencher</span>
                  </button>

                  <button type="button" class="btn btn-sm btn-outline-primary text-start d-flex justify-content-between align-items-center py-1.5 px-2" id="fillApproved">
                    <div>
                      <strong class="d-block text-primary" style="font-size: 0.75rem;">2. Instituição APROVADA (Acesso Livre)</strong>
                      <span class="text-muted font-monospace" style="font-size: 0.7rem;">carlos@politecnico.pt</span>
                    </div>
                    <span class="badge bg-primary text-white">Preencher</span>
                  </button>

                  <div class="p-2 bg-white rounded border border-warning border-opacity-50 text-secondary" style="font-size: 0.7rem;">
                    <i class="bi bi-info-circle text-warning me-1"></i>
                    <strong>Teste de Controle de Acesso:</strong> Se criar uma nova instituição em <em>Cadastro</em>, ela começará como <strong>PENDING</strong> e o login será bloqueado com mensagem explicativa até o Admin aprovar!
                  </div>
                </div>
              </div>

              <!-- Rodapé do Card com Link para Cadastro -->
              <div class="text-center pt-2 border-top border-light-subtle">
                <span class="text-secondary small">Sua instituição ainda não é credenciada?</span>
                <a href="/instituicao/cadastro" data-route="/instituicao/cadastro" class="d-block mt-1 text-primary fw-bold small text-decoration-none">
                  Solicitar Credenciamento Institucional <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>

            <!-- Informação de Segurança no Rodapé -->
            <div class="text-center mt-3 text-secondary small" style="font-size: 0.78rem;">
              <i class="bi bi-shield-shaded me-1 text-primary"></i> Acesso protegido por CSRF, Bcrypt e Sessões HTTP-only
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- Modal Simulado de Recuperação de Palavra-passe -->
    <div class="modal fade" id="modalRecovery" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content border-0 shadow-lg rounded-4">
          <div class="modal-header border-bottom border-light-subtle pb-3">
            <h5 class="modal-title fw-bold text-dark">Recuperar Palavra-passe</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body p-4">
            <p class="text-secondary small mb-3">
              Insira o email corporativo ou do responsável associado à instituição. Se o endereço existir na base de dados, enviaremos instruções de redefinição.
            </p>
            <div id="recoveryAlertBox" class="d-none mb-3"></div>
            <div class="mb-3">
              <label for="recoveryEmail" class="vd-form-label">Email Cadastrado</label>
              <input type="email" id="recoveryEmail" class="form-control vd-form-control" placeholder="nome@instituicao.edu">
            </div>
            <button type="button" class="btn btn-vd-primary w-100" id="btnSubmitRecovery">
              Enviar Link de Redefinição
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
