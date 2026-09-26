/**
 * Footer Reutilizável - VeriDoc
 */
export function renderFooter(): string {
  return `
    <footer class="vd-footer">
      <div class="container">
        <div class="row g-4 mb-5">
          <!-- Coluna 1: Sobre -->
          <div class="col-lg-4 col-md-6">
            <div class="d-flex align-items-center gap-2 mb-3">
              <div class="vd-logo-shield" style="width: 32px; height: 32px; font-size: 1rem;">
                <i class="bi bi-shield-check"></i>
              </div>
              <span class="text-white fw-bold fs-5">Veri<span class="vd-brand-accent">Doc</span></span>
            </div>
            <p class="text-secondary small mb-3">
              Plataforma tecnológica para validação e emissão de documentos autênticos com selo digital e QR Code para instituições de ensino, entidades e empresas.
            </p>
            <div class="d-flex gap-3 text-secondary">
              <span class="badge bg-dark border border-secondary text-secondary p-2">
                <i class="bi bi-lock-fill text-primary me-1"></i> Criptografia SHA-256
              </span>
              <span class="badge bg-dark border border-secondary text-secondary p-2">
                <i class="bi bi-patch-check-fill text-success me-1"></i> QR Code Único
              </span>
            </div>
          </div>

          <!-- Coluna 2: Navegação -->
          <div class="col-lg-2 col-md-6 col-6">
            <h6 class="text-white fw-bold mb-3">Navegação</h6>
            <a href="/" data-route="/" class="vd-footer-link">Página Inicial</a>
            <a href="/verificar" data-route="/verificar" class="vd-footer-link">Verificar Código</a>
            <a href="/login" data-route="/login" class="vd-footer-link">Acesso Institucional</a>
            <a href="/instituicao/cadastro" data-route="/instituicao/cadastro" class="vd-footer-link">Cadastrar Entidade</a>
          </div>

          <!-- Coluna 3: Institucional -->
          <div class="col-lg-3 col-md-6 col-6">
            <h6 class="text-white fw-bold mb-3">Solução</h6>
            <a href="#como-funciona" class="vd-footer-link">Como Funciona</a>
            <a href="#beneficios" class="vd-footer-link">Para Universidades</a>
            <a href="#beneficios" class="vd-footer-link">Para Conselhos e Órgãos</a>
            <a href="/instituicao/dashboard" data-route="/instituicao/dashboard" class="vd-footer-link">Visualizar Dashboard</a>
          </div>

          <!-- Coluna 4: Conformidade e Segurança -->
          <div class="col-lg-3 col-md-6">
            <h6 class="text-white fw-bold mb-3">Segurança & Autenticidade</h6>
            <p class="small text-secondary mb-2">
              Todos os documentos registrados recebem assinatura digital inviolável, permitindo validação pública a qualquer hora.
            </p>
            <div class="p-3 rounded-3 bg-dark border border-secondary border-opacity-25">
              <div class="d-flex align-items-center gap-2 text-white small fw-semibold">
                <i class="bi bi-shield-lock text-info"></i>
                Ambiente Seguro VeriDoc
              </div>
              <div class="text-secondary" style="font-size: 0.75rem;">
                Conformidade com padrões internacionais de autenticação digital.
              </div>
            </div>
          </div>
        </div>

        <div class="border-top border-secondary border-opacity-25 pt-4 d-flex flex-column flex-md-row justify-content-between align-items-center gap-2">
          <div class="text-secondary small">
            &copy; 2026 VeriDoc. Todos os direitos reservados.
          </div>
          <div class="d-flex gap-3 small text-secondary">
            <span>Privacidade</span>
            <span>•</span>
            <span>Termos de Uso</span>
            <span>•</span>
            <span>Segurança da Informação</span>
          </div>
        </div>
      </div>
    </footer>
  `;
}
