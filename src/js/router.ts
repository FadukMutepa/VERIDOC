import { renderNavbar } from './components/navbar';
import { renderFooter } from './components/footer';
import { renderHomePage } from './views/home';
import { renderVerifyPage } from './views/verify';
import { renderLoginPage } from './views/login';
import { renderRegisterPage } from './views/register';
import { renderDashboardPage } from './views/dashboard';
import { authService } from './services/auth';

export class VeriDocRouter {
  private appElement: HTMLElement;
  private currentPath: string = '/';

  constructor(appElementId: string = 'app') {
    const el = document.getElementById(appElementId);
    if (!el) {
      throw new Error(`Elemento #${appElementId} não encontrado no DOM.`);
    }
    this.appElement = el;

    this.init();
  }

  private async init(): Promise<void> {
    // Inicializar sessão com backend
    await authService.init();

    // Escuta evento de navegação do histórico
    window.addEventListener('popstate', () => {
      this.resolveRoute(window.location.pathname);
    });

    // Escuta mudanças de hash
    window.addEventListener('hashchange', () => {
      const hashPath = window.location.hash.replace('#', '') || '/';
      this.resolveRoute(hashPath);
    });

    // Delegação de cliques global para links com atributo data-route
    document.addEventListener('click', (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest('a[data-route]') as HTMLAnchorElement | null;
      if (target) {
        event.preventDefault();
        const route = target.getAttribute('data-route') || '/';
        this.navigateTo(route);
      }
    });

    // Rota inicial
    const initialHash = window.location.hash.replace('#', '');
    const initialPath = initialHash || window.location.pathname || '/';
    this.resolveRoute(initialPath);
  }

  public navigateTo(path: string): void {
    if (this.currentPath === path) return;

    window.history.pushState({}, '', path);
    window.location.hash = path;
    this.resolveRoute(path);
  }

  private resolveRoute(rawPath: string): void {
    let normalized = rawPath.trim();
    if (normalized.startsWith('#')) normalized = normalized.substring(1);
    if (!normalized.startsWith('/')) normalized = '/' + normalized;

    if (normalized === '' || normalized === '/') {
      this.currentPath = '/';
    } else if (normalized.startsWith('/verificar')) {
      this.currentPath = '/verificar';
    } else if (normalized.startsWith('/login')) {
      this.currentPath = '/login';
    } else if (normalized.startsWith('/instituicao/cadastro')) {
      this.currentPath = '/instituicao/cadastro';
    } else if (normalized.startsWith('/instituicao/dashboard')) {
      this.currentPath = '/instituicao/dashboard';
    } else {
      this.currentPath = '/';
    }

    this.render();
  }

  private render(): void {
    window.scrollTo(0, 0);

    const demoSwitcher = this.renderDemoSwitcher();
    let pageHtml = '';
    const isDashboard = this.currentPath === '/instituicao/dashboard';

    switch (this.currentPath) {
      case '/verificar':
        pageHtml = renderVerifyPage();
        break;
      case '/login':
        pageHtml = renderLoginPage();
        break;
      case '/instituicao/cadastro':
        pageHtml = renderRegisterPage();
        break;
      case '/instituicao/dashboard':
        pageHtml = renderDashboardPage();
        break;
      case '/':
      default:
        pageHtml = renderHomePage();
        break;
    }

    this.appElement.innerHTML = `
      ${demoSwitcher}
      ${renderNavbar(this.currentPath)}
      <div class="flex-grow-1">
        ${pageHtml}
      </div>
      ${!isDashboard ? renderFooter() : ''}
    `;

    this.attachPageEvents();
  }

  private renderDemoSwitcher(): string {
    const user = authService.getUser();
    const pages = [
      { path: '/', label: '1. Início (/)' },
      { path: '/verificar', label: '2. Verificar (/verificar)' },
      { path: '/login', label: '3. Login (/login)' },
      { path: '/instituicao/cadastro', label: '4. Cadastro (/instituicao/cadastro)' },
      { path: '/instituicao/dashboard', label: '5. Dashboard (/instituicao/dashboard)' },
    ];

    return `
      <div class="bg-dark text-white py-2 px-3 border-bottom border-secondary border-opacity-50" style="font-size: 0.8rem; background-color: #050B14 !important;">
        <div class="container d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${user ? (user.role === 'admin' ? 'bg-danger' : 'bg-success') : 'bg-primary'} text-white" style="font-size: 0.7rem;">
              ${user ? `SESSÃO: ${user.role.toUpperCase()}` : 'ETAPA 3 · AUTENTICAÇÃO & GESTÃO'}
            </span>
            <span class="text-secondary d-none d-md-inline">
              ${user ? `Autenticado: <strong>${user.name}</strong> (${user.institutionName || 'Admin Central'})` : 'Acesso rápido às rotas:'}
            </span>
          </div>
          <div class="d-flex flex-wrap gap-1">
            ${pages.map(p => `
              <a href="${p.path}" data-route="${p.path}" class="btn btn-sm py-0 px-2 ${this.currentPath === p.path ? 'btn-primary text-white fw-bold' : 'btn-outline-secondary text-light'}" style="font-size: 0.72rem;">
                ${p.label}
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  private attachPageEvents(): void {
    // 1. Logout Global (Navbar e Dashboard)
    const handleLogout = async () => {
      await authService.logout();
      this.navigateTo('/login');
    };

    const navLogout = document.getElementById('navBtnLogout');
    if (navLogout) navLogout.addEventListener('click', handleLogout);

    const dashLogout = document.getElementById('btnDashLogout');
    if (dashLogout) dashLogout.addEventListener('click', handleLogout);

    // 2. Eventos da Tela de Login
    if (this.currentPath === '/login') {
      const emailInput = document.getElementById('loginEmail') as HTMLInputElement | null;
      const passInput = document.getElementById('loginPassword') as HTMLInputElement | null;
      const alertBox = document.getElementById('loginAlertBox');
      const form = document.getElementById('loginForm');

      // Botão de preenchimento rápido: Admin
      const fillAdmin = document.getElementById('fillAdmin');
      if (fillAdmin && emailInput && passInput) {
        fillAdmin.addEventListener('click', () => {
          emailInput.value = 'admin@veridoc.app';
          passInput.value = 'Admin@2026';
          if (alertBox) alertBox.classList.add('d-none');
        });
      }

      // Botão de preenchimento rápido: Instituição Aprovada
      const fillApproved = document.getElementById('fillApproved');
      if (fillApproved && emailInput && passInput) {
        fillApproved.addEventListener('click', () => {
          emailInput.value = 'carlos@politecnico.pt';
          passInput.value = 'Carlos@2026';
          if (alertBox) alertBox.classList.add('d-none');
        });
      }

      // Submissão do Login
      if (form && emailInput && passInput && alertBox) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = emailInput.value.trim();
          const password = passInput.value;

          const submitBtn = document.getElementById('btnLoginSubmit') as HTMLButtonElement | null;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A autenticar...';
          }

          const res = await authService.login(email, password);

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Entrar no Painel';
          }

          if (!res.success) {
            alertBox.className = 'alert alert-danger py-2 px-3 small';
            if (res.status === 'pending') {
              alertBox.className = 'alert alert-warning py-3 px-3 small border-warning';
              alertBox.innerHTML = `
                <div class="fw-bold mb-1"><i class="bi bi-hourglass-split me-1"></i> Cadastro PENDENTE de Aprovação</div>
                <div>${res.error}</div>
                <div class="mt-2 text-muted" style="font-size: 0.75rem;">
                  <strong>Dica:</strong> Aceda com a conta <code>admin@veridoc.app</code> para aprovar esta instituição.
                </div>
              `;
            } else if (res.status === 'suspended') {
              alertBox.className = 'alert alert-danger py-3 px-3 small';
              alertBox.innerHTML = `
                <div class="fw-bold mb-1"><i class="bi bi-slash-circle me-1"></i> Instituição SUSPENSA</div>
                <div>${res.error}</div>
              `;
            } else {
              alertBox.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> ${res.error}`;
            }
            alertBox.classList.remove('d-none');
            return;
          }

          // Sucesso no Login -> Redirecionar para Dashboard
          this.navigateTo('/instituicao/dashboard');
        });
      }

      // Recuperação de senha
      const btnOpenRecovery = document.getElementById('btnOpenRecovery');
      if (btnOpenRecovery) {
        btnOpenRecovery.addEventListener('click', () => {
          const modalEl = document.getElementById('modalRecovery');
          if (modalEl && (window as any).bootstrap) {
            const modalInstance = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
          }
        });
      }

      const btnSubmitRecovery = document.getElementById('btnSubmitRecovery');
      if (btnSubmitRecovery) {
        btnSubmitRecovery.addEventListener('click', async () => {
          const recEmail = (document.getElementById('recoveryEmail') as HTMLInputElement)?.value;
          const recAlert = document.getElementById('recoveryAlertBox');
          if (!recEmail && recAlert) {
            recAlert.className = 'alert alert-warning py-2 small';
            recAlert.textContent = 'Informe o email cadastrado.';
            recAlert.classList.remove('d-none');
            return;
          }

          btnSubmitRecovery.textContent = 'A enviar...';
          const res = await authService.forgotPassword(recEmail);
          btnSubmitRecovery.textContent = 'Enviar Link de Redefinição';

          if (recAlert) {
            recAlert.className = 'alert alert-success py-2 small';
            recAlert.textContent = res.message || 'Instruções enviadas com sucesso.';
            recAlert.classList.remove('d-none');
          }
        });
      }
    }

    // 3. Eventos da Tela de Cadastro Institucional
    if (this.currentPath === '/instituicao/cadastro') {
      const regForm = document.getElementById('institutionRegisterForm') as HTMLFormElement | null;
      const regAlert = document.getElementById('registerAlertBox');

      if (regForm && regAlert) {
        regForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          const pass = (document.getElementById('registerPassword') as HTMLInputElement)?.value;
          const passConfirm = (document.getElementById('registerPasswordConfirm') as HTMLInputElement)?.value;

          if (pass !== passConfirm) {
            regAlert.className = 'alert alert-danger py-2 small';
            regAlert.innerHTML = '<i class="bi bi-exclamation-circle me-1"></i> As palavras-passe informadas não coincidem.';
            regAlert.classList.remove('d-none');
            return;
          }

          const formData = {
            name: (document.getElementById('institutionName') as HTMLInputElement)?.value,
            type: (document.getElementById('institutionType') as HTMLSelectElement)?.value,
            city: (document.getElementById('institutionCity') as HTMLInputElement)?.value,
            country: (document.getElementById('institutionCountry') as HTMLInputElement)?.value,
            address: (document.getElementById('institutionAddress') as HTMLInputElement)?.value,
            email: (document.getElementById('institutionEmail') as HTMLInputElement)?.value,
            phone: (document.getElementById('institutionPhone') as HTMLInputElement)?.value,
            website: (document.getElementById('institutionWebsite') as HTMLInputElement)?.value,
            responsible_name: (document.getElementById('responsibleName') as HTMLInputElement)?.value,
            responsible_email: (document.getElementById('responsibleEmail') as HTMLInputElement)?.value,
            password: pass,
          };

          const submitBtn = document.getElementById('btnSubmitRegister') as HTMLButtonElement | null;
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A submeter...';
          }

          const res = await authService.registerInstitution(formData);

          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-send-check me-2"></i> Submeter Candidatura Institucional';
          }

          if (!res.success) {
            regAlert.className = 'alert alert-danger py-3 small';
            regAlert.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> ${res.error}`;
            regAlert.classList.remove('d-none');
            window.scrollTo({ top: 100, behavior: 'smooth' });
            return;
          }

          // Sucesso: Estado inicial PENDING garantido
          regAlert.className = 'alert alert-success py-4 px-4 small border-success shadow-sm';
          regAlert.innerHTML = `
            <div class="d-flex align-items-start gap-3">
              <div class="text-success fs-3"><i class="bi bi-check-circle-fill"></i></div>
              <div>
                <h5 class="alert-heading fw-bold text-success mb-1">Candidatura Registada com Sucesso!</h5>
                <p class="mb-2 text-dark">
                  A instituição <strong>${formData.name}</strong> foi gravada no banco de dados com o estado inicial <span class="badge bg-warning text-dark">PENDING</span>.
                </p>
                <div class="p-3 bg-white rounded-3 border border-success border-opacity-25 small mb-3">
                  <strong>Fluxo de Teste:</strong><br>
                  1. O responsável legal <em>${formData.responsible_email}</em> ainda não poderá acessar o painel pois o status está pendente.<br>
                  2. Entre como Administrador (<code>admin@veridoc.app</code> / <code>Admin@2026</code>) e acesse a aba <strong>Gestão de Instituições</strong> para aprovar esta entidade!
                </div>
                <div class="d-flex gap-2">
                  <a href="/login" data-route="/login" class="btn btn-sm btn-success">
                    <i class="bi bi-box-arrow-in-right me-1"></i> Ir para a Página de Login
                  </a>
                </div>
              </div>
            </div>
          `;
          regAlert.classList.remove('d-none');
          regForm.reset();
          window.scrollTo({ top: 100, behavior: 'smooth' });
        });
      }
    }

    // 4. Eventos do Dashboard (Consulta Real ao MySQL & Gestão Administrativa)
    if (this.currentPath === '/instituicao/dashboard') {
      this.loadDashboardData();
    }
  }

  /**
   * Carrega os dados reais do MySQL para o Dashboard
   */
  private async loadDashboardData(): Promise<void> {
    const user = authService.getUser();
    if (!user) return;

    // Se estiver pendente, o template já bloqueou
    if (user.role !== 'admin' && user.institutionStatus === 'pending') return;

    const isAdmin = user.role === 'admin';

    // Tabs para o Admin (Métricas vs Gestão de Instituições)
    const tabBtnStats = document.getElementById('tabBtnStats');
    const tabBtnAdminInst = document.getElementById('tabBtnAdminInst');
    const viewStatsSection = document.getElementById('viewStatsSection');
    const viewAdminSection = document.getElementById('viewAdminSection');

    if (isAdmin && tabBtnStats && tabBtnAdminInst && viewStatsSection && viewAdminSection) {
      tabBtnStats.addEventListener('click', () => {
        tabBtnStats.classList.add('active');
        tabBtnStats.classList.remove('text-secondary');
        tabBtnAdminInst.classList.remove('active');
        tabBtnAdminInst.classList.add('text-secondary');
        viewStatsSection.classList.remove('d-none');
        viewAdminSection.classList.add('d-none');
      });

      tabBtnAdminInst.addEventListener('click', () => {
        tabBtnAdminInst.classList.add('active');
        tabBtnAdminInst.classList.remove('text-secondary');
        tabBtnStats.classList.remove('active');
        tabBtnStats.classList.add('text-secondary');
        viewAdminSection.classList.remove('d-none');
        viewStatsSection.classList.add('d-none');
        this.loadAdminInstitutions();
      });

      const btnRefreshAdminList = document.getElementById('btnRefreshAdminList');
      if (btnRefreshAdminList) {
        btnRefreshAdminList.addEventListener('click', () => this.loadAdminInstitutions());
      }
    }

    const btnRefresh = document.getElementById('btnRefreshStats');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.fetchStats());
    }

    // Carregar estatísticas do banco
    await this.fetchStats();

    // Se for admin, atualizar também a contagem de pendentes no badge
    if (isAdmin) {
      this.updateAdminPendingBadge();
    }
  }

  private async fetchStats(): Promise<void> {
    const res = await authService.getDashboardStats();
    if (!res.success) {
      const alertBox = document.getElementById('dashAlertBox');
      if (alertBox) {
        alertBox.className = 'alert alert-danger py-2 small';
        alertBox.textContent = res.error || 'Erro ao consultar banco de dados.';
        alertBox.classList.remove('d-none');
      }
      return;
    }

    const stats = res.data.stats;
    const recent = res.data.recent_documents || [];

    // Preenche os 4 cards calculados do MySQL
    const elTotal = document.getElementById('statTotalDocs');
    const elValid = document.getElementById('statValidDocs');
    const elRevoked = document.getElementById('statRevokedDocs');
    const elVerif = document.getElementById('statVerifications');

    if (elTotal) elTotal.textContent = stats.total_documents.toString();
    if (elValid) elValid.textContent = stats.valid_documents.toString();
    if (elRevoked) elRevoked.textContent = stats.revoked_documents.toString();
    if (elVerif) elVerif.textContent = stats.total_verifications.toString();

    // Preenche a tabela de documentos reais
    const tableBody = document.getElementById('recentDocsTableBody');
    if (tableBody) {
      if (recent.length === 0) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center py-4 text-muted">
              Nenhum documento emitido até o momento para esta instituição.
            </td>
          </tr>
        `;
      } else {
        tableBody.innerHTML = recent.map((doc: any) => {
          const statusBadge = 
            doc.status === 'valid' ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">Válido</span>' :
            doc.status === 'revoked' ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">Revogado</span>' :
            '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1">Expirado</span>';

          const formattedDate = doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('pt-PT') : '-';

          return `
            <tr>
              <td class="ps-4 font-monospace fw-bold text-primary">${doc.verification_code}</td>
              <td class="fw-semibold">${doc.document_type}</td>
              <td>${doc.holder_name}</td>
              <td>${doc.course || 'Geral'}</td>
              <td class="text-muted">${formattedDate}</td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  private async updateAdminPendingBadge(): Promise<void> {
    const res = await authService.getAdminInstitutions();
    if (res.success && res.stats) {
      const badge = document.getElementById('pendingBadgeCount');
      if (badge) {
        badge.textContent = res.stats.pending || '0';
        if (Number(res.stats.pending) > 0) {
          badge.className = 'badge bg-warning text-dark ms-auto animate-pulse';
        } else {
          badge.className = 'badge bg-secondary ms-auto';
        }
      }
    }
  }

  private async loadAdminInstitutions(): Promise<void> {
    const tableBody = document.getElementById('adminInstitutionsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">A consultar base de dados MySQL...</td></tr>`;

    const res = await authService.getAdminInstitutions();
    if (!res.success || !res.institutions) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Falha ao buscar instituições: ${res.error}</td></tr>`;
      return;
    }

    if (res.institutions.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">Nenhuma instituição encontrada.</td></tr>`;
      return;
    }

    tableBody.innerHTML = res.institutions.map(inst => {
      const statusBadge = 
        inst.status === 'approved' ? '<span class="badge bg-success px-2 py-1"><i class="bi bi-check-circle me-1"></i>APPROVED</span>' :
        inst.status === 'pending' ? '<span class="badge bg-warning text-dark px-2 py-1"><i class="bi bi-hourglass-split me-1"></i>PENDING</span>' :
        inst.status === 'suspended' ? '<span class="badge bg-danger px-2 py-1"><i class="bi bi-slash-circle me-1"></i>SUSPENDED</span>' :
        '<span class="badge bg-secondary px-2 py-1">REJECTED</span>';

      return `
        <tr>
          <td class="ps-4 fw-bold text-muted">#${inst.id}</td>
          <td>
            <div class="fw-bold text-dark">${inst.name}</div>
            <div class="text-muted small">${inst.city}, ${inst.country}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${inst.type}</span></td>
          <td><span class="font-monospace small">${inst.email}</span></td>
          <td>
            <div>${inst.responsible_name}</div>
            <div class="text-muted small">${inst.responsible_email}</div>
          </td>
          <td>${statusBadge}</td>
          <td class="text-end pe-4">
            <div class="btn-group btn-group-sm">
              ${inst.status !== 'approved' ? `
                <button class="btn btn-sm btn-success btn-action-status" data-id="${inst.id}" data-status="approved" title="Aprovar Instituição">
                  <i class="bi bi-check-lg me-1"></i> Aprovar
                </button>
              ` : ''}
              ${inst.status !== 'suspended' ? `
                <button class="btn btn-sm btn-outline-danger btn-action-status" data-id="${inst.id}" data-status="suspended" title="Suspender Instituição">
                  <i class="bi bi-slash-circle me-1"></i> Suspender
                </button>
              ` : ''}
              ${inst.status === 'suspended' ? `
                <button class="btn btn-sm btn-outline-success btn-action-status" data-id="${inst.id}" data-status="approved" title="Reativar Instituição">
                  <i class="bi bi-arrow-clockwise me-1"></i> Reativar
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Adiciona listener para os botões de ação
    document.querySelectorAll('.btn-action-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = (e.currentTarget as HTMLElement);
        const instId = Number(target.getAttribute('data-id'));
        const newStatus = target.getAttribute('data-status') || 'approved';

        target.setAttribute('disabled', 'true');
        target.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

        const updateRes = await authService.updateInstitutionStatus(instId, newStatus, 'Alteração efetuada pelo Administrador no Painel Central');

        const dashAlert = document.getElementById('dashAlertBox');
        if (dashAlert) {
          if (updateRes.success) {
            dashAlert.className = 'alert alert-success py-2 px-3 small';
            dashAlert.textContent = updateRes.message || 'Status atualizado com sucesso.';
          } else {
            dashAlert.className = 'alert alert-danger py-2 px-3 small';
            dashAlert.textContent = updateRes.error || 'Erro ao atualizar.';
          }
          dashAlert.classList.remove('d-none');
          setTimeout(() => dashAlert.classList.add('d-none'), 5000);
        }

        // Recarrega a lista e atualiza o badge
        await this.loadAdminInstitutions();
        await this.updateAdminPendingBadge();
      });
    });
  }
}
