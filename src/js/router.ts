import { renderNavbar } from './components/navbar';
import { renderFooter } from './components/footer';
import { renderHomePage } from './views/home';
import { renderVerifyPage, buildVerificationResultHtml } from './views/verify';
import { renderLoginPage } from './views/login';
import { renderRegisterPage } from './views/register';
import { renderDashboardPage } from './views/dashboard';
import { renderDocumentCreatePage } from './views/document_create';
import { renderDocumentListPage } from './views/document_list';
import { renderAdminDashboardPage } from './views/admin_dashboard';
import { renderAdminInstitutionsPage } from './views/admin_institutions';
import { renderAdminDocumentsPage } from './views/admin_documents';
import { renderAdminVerificationsPage } from './views/admin_verifications';
import { renderAdminLogsPage } from './views/admin_logs';
import { authService, DocumentItem } from './services/auth';
import { escapeHtml } from './utils/sanitize';

export class VeriDocRouter {
  private appElement: HTMLElement;
  private currentPath: string = '/';
  private currentVerifyCode: string = '';

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
      this.resolveRoute(window.location.pathname + window.location.search);
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
    const initialPath = initialHash || window.location.pathname + window.location.search || '/';
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

    // Remove query params para comparação de rota base
    const basePath = normalized.split('?')[0];

    // Controle de Acesso Estrito para Rotas Administrativas (/admin/*)
    if (basePath.startsWith('/admin')) {
      if (!authService.isAuthenticated()) {
        this.currentPath = '/login';
        this.currentVerifyCode = '';
        this.render();
        return;
      }
      if (!authService.isAdmin()) {
        // SEGURANÇA ESTRITA: Um utilizador institucional NUNCA deve conseguir acessar as rotas administrativas
        this.currentPath = '/instituicao/dashboard';
        this.currentVerifyCode = '';
        this.render();
        return;
      }
    }

    if (basePath === '' || basePath === '/') {
      this.currentPath = '/';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/admin/dashboard')) {
      this.currentPath = '/admin/dashboard';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/admin/institutions')) {
      this.currentPath = '/admin/institutions';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/admin/documents')) {
      this.currentPath = '/admin/documents';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/admin/verifications')) {
      this.currentPath = '/admin/verifications';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/admin/logs')) {
      this.currentPath = '/admin/logs';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/verificar')) {
      this.currentPath = '/verificar';
      // Extrair código da URL: /verificar/VD-2026-XXXXXXXX ou /verificar?code=VD-2026-XXXXXXXX
      const pathMatch = basePath.match(/^\/verificar\/([A-Za-z0-9\-_]+)$/i);
      if (pathMatch && pathMatch[1]) {
        this.currentVerifyCode = pathMatch[1].trim();
      } else {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentVerifyCode = (urlParams.get('code') || '').trim();
      }
    } else if (basePath.startsWith('/login')) {
      this.currentPath = '/login';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/instituicao/cadastro')) {
      this.currentPath = '/instituicao/cadastro';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/instituicao/dashboard')) {
      this.currentPath = '/instituicao/dashboard';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/instituicao/documentos/novo')) {
      this.currentPath = '/instituicao/documentos/novo';
      this.currentVerifyCode = '';
    } else if (basePath.startsWith('/instituicao/documentos')) {
      this.currentPath = '/instituicao/documentos';
      this.currentVerifyCode = '';
    } else {
      this.currentPath = '/';
      this.currentVerifyCode = '';
    }

    this.render();
  }

  private render(): void {
    window.scrollTo(0, 0);

    const demoSwitcher = this.renderDemoSwitcher();
    let pageHtml = '';
    const isDashboard = this.currentPath.includes('/instituicao/') || this.currentPath.startsWith('/admin');

    switch (this.currentPath) {
      case '/admin/dashboard':
        pageHtml = renderAdminDashboardPage();
        break;
      case '/admin/institutions':
        pageHtml = renderAdminInstitutionsPage();
        break;
      case '/admin/documents':
        pageHtml = renderAdminDocumentsPage();
        break;
      case '/admin/verifications':
        pageHtml = renderAdminVerificationsPage();
        break;
      case '/admin/logs':
        pageHtml = renderAdminLogsPage();
        break;
      case '/instituicao/documentos/novo':
        pageHtml = renderDocumentCreatePage();
        break;
      case '/instituicao/documentos':
        pageHtml = renderDocumentListPage();
        break;
      case '/verificar':
        pageHtml = renderVerifyPage(this.currentVerifyCode);
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
      { path: '/', label: 'Início (/)' },
      { path: '/verificar', label: 'Verificar (/verificar)' },
      { path: '/login', label: 'Login (/login)' },
      { path: '/instituicao/cadastro', label: 'Cadastro (/instituicao/cadastro)' },
      { path: '/instituicao/dashboard', label: 'Dashboard (/instituicao/dashboard)' },
      { path: '/instituicao/documentos/novo', label: '+ Emitir Doc (/documentos/novo)' },
      { path: '/instituicao/documentos', label: 'Documentos (/documentos)' },
    ];

    if (user && user.role === 'admin') {
      pages.push({ path: '/admin/dashboard', label: 'Admin Dashboard' });
      pages.push({ path: '/admin/institutions', label: 'Admin Instituições' });
      pages.push({ path: '/admin/documents', label: 'Admin Docs' });
      pages.push({ path: '/admin/verifications', label: 'Admin Verificações' });
      pages.push({ path: '/admin/logs', label: 'Admin Logs' });
    }

    return `
      <div class="bg-dark text-white py-2 px-3 border-bottom border-secondary border-opacity-50" style="font-size: 0.8rem; background-color: #050B14 !important;">
        <div class="container d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div class="d-flex align-items-center gap-2">
            <span class="badge ${user ? (user.role === 'admin' ? 'bg-danger' : 'bg-success') : 'bg-primary'} text-white" style="font-size: 0.7rem;">
              ${user ? `SESSÃO: ${user.role.toUpperCase()}` : 'ETAPA 4 · EMISSÃO DE DOCUMENTOS'}
            </span>
            <span class="text-secondary d-none d-md-inline">
              ${user ? `Entidade: <strong>${user.institutionName || 'Administração Central'}</strong>` : 'Acesso rápido:'}
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
    // 1. Logout Global
    const handleLogout = async () => {
      await authService.logout();
      this.navigateTo('/login');
    };

    const navLogout = document.getElementById('navBtnLogout');
    if (navLogout) navLogout.addEventListener('click', handleLogout);

    const dashLogout = document.getElementById('btnDashLogout');
    if (dashLogout) dashLogout.addEventListener('click', handleLogout);

    const adminLogout = document.getElementById('btnAdminLogout');
    if (adminLogout) adminLogout.addEventListener('click', handleLogout);

    // 2. Tela de Emissão de Documento (/instituicao/documentos/novo)
    if (this.currentPath === '/instituicao/documentos/novo') {
      this.attachCreateDocEvents();
    }

    // 3. Tela de Listagem de Documentos (/instituicao/documentos)
    if (this.currentPath === '/instituicao/documentos') {
      this.attachDocumentListEvents();
    }

    // 4. Tela de Verificação (/verificar)
    if (this.currentPath === '/verificar') {
      this.attachVerifyEvents();
    }

    // 5. Tela de Login (/login)
    if (this.currentPath === '/login') {
      this.attachLoginEvents();
    }

    // 6. Tela de Cadastro (/instituicao/cadastro)
    if (this.currentPath === '/instituicao/cadastro') {
      this.attachRegisterEvents();
    }

    // 7. Dashboard Institucional (/instituicao/dashboard)
    if (this.currentPath === '/instituicao/dashboard') {
      this.loadDashboardData();
    }

    // 8. Admin Dashboard (/admin/dashboard)
    if (this.currentPath === '/admin/dashboard') {
      this.attachAdminDashboardEvents();
    }

    // 9. Admin Gestão de Instituições (/admin/institutions)
    if (this.currentPath === '/admin/institutions') {
      this.attachAdminInstitutionsEvents();
    }

    // 10. Admin Documentos Globais (/admin/documents)
    if (this.currentPath === '/admin/documents') {
      this.attachAdminDocumentsEvents();
    }

    // 11. Admin Verificações (/admin/verifications)
    if (this.currentPath === '/admin/verifications') {
      this.attachAdminVerificationsEvents();
    }

    // 12. Admin Logs de Auditoria (/admin/logs)
    if (this.currentPath === '/admin/logs') {
      this.attachAdminLogsEvents();
    }
  }

  /**
   * Eventos: Emissão de Novo Documento
   */
  private attachCreateDocEvents(): void {
    const form = document.getElementById('formCreateDocument') as HTMLFormElement | null;
    const alertBox = document.getElementById('createDocAlert');
    const successCard = document.getElementById('docSuccessCard');
    const btnSubmit = document.getElementById('btnSubmitDoc') as HTMLButtonElement | null;
    const btnEmitAnother = document.getElementById('btnEmitAnother');

    if (btnEmitAnother && form && successCard) {
      btnEmitAnother.addEventListener('click', () => {
        form.reset();
        successCard.classList.add('d-none');
        form.classList.remove('d-none');
        window.scrollTo({ top: 100, behavior: 'smooth' });
      });
    }

    if (form && alertBox && successCard) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = {
          holder_name: (document.getElementById('docHolderName') as HTMLInputElement)?.value,
          document_type: (document.getElementById('docType') as HTMLSelectElement)?.value,
          course: (document.getElementById('docCourse') as HTMLInputElement)?.value,
          area: (document.getElementById('docArea') as HTMLInputElement)?.value,
          issue_date: (document.getElementById('docIssueDate') as HTMLInputElement)?.value,
          expiry_date: (document.getElementById('docExpiryDate') as HTMLInputElement)?.value,
          description: (document.getElementById('docDescription') as HTMLTextAreaElement)?.value,
          observations: (document.getElementById('docObservations') as HTMLInputElement)?.value,
        };

        if (btnSubmit) {
          btnSubmit.disabled = true;
          btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>A gerar código e QR Code no servidor...';
        }

        const res = await authService.createDocument(formData);

        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = '<i class="bi bi-patch-check-fill me-2"></i> Emitir Documento Oficial';
        }

        if (!res.success || !res.document) {
          alertBox.className = 'alert alert-danger py-3 small';
          alertBox.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> ${res.error || 'Erro na emissão.'}`;
          alertBox.classList.remove('d-none');
          window.scrollTo({ top: 100, behavior: 'smooth' });
          return;
        }

        alertBox.classList.add('d-none');

        // Preenche o Card de Sucesso com os dados gerados pelo servidor
        const doc = res.document;
        (document.getElementById('successDocCode') as HTMLElement).textContent = doc.verification_code;
        (document.getElementById('successDocHolder') as HTMLElement).textContent = doc.holder_name;
        (document.getElementById('successDocType') as HTMLElement).textContent = doc.document_type;
        (document.getElementById('successDocCourse') as HTMLElement).textContent = doc.course;
        (document.getElementById('successDocIssueDate') as HTMLElement).textContent = new Date(doc.issue_date).toLocaleDateString('pt-PT');
        (document.getElementById('successDocExpiryDate') as HTMLElement).textContent = doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('pt-PT') : 'Vitalício';
        (document.getElementById('successDocHash') as HTMLElement).textContent = doc.hash;

        const qrImg = document.getElementById('successDocQrImage') as HTMLImageElement | null;
        if (qrImg && doc.qr_code) {
          qrImg.src = doc.qr_code;
        }

        const verifyLink = document.getElementById('successDocVerifyLink') as HTMLAnchorElement | null;
        if (verifyLink) {
          verifyLink.href = `/verificar?code=${encodeURIComponent(doc.verification_code)}`;
          verifyLink.setAttribute('data-route', `/verificar?code=${encodeURIComponent(doc.verification_code)}`);
        }

        // Esconde formulário e exibe card de sucesso
        form.classList.add('d-none');
        successCard.classList.remove('d-none');
        window.scrollTo({ top: 100, behavior: 'smooth' });
      });
    }
  }

  /**
   * Eventos: Listagem de Documentos
   */
  private attachDocumentListEvents(): void {
    const searchInput = document.getElementById('docSearchInput') as HTMLInputElement | null;
    const statusFilter = document.getElementById('docStatusFilter') as HTMLSelectElement | null;
    const btnRefresh = document.getElementById('btnRefreshDocList');

    const triggerReload = () => {
      this.loadDocumentsList({
        search: searchInput?.value || '',
        status: statusFilter?.value || '',
      });
    };

    if (searchInput) {
      let timeout: any;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeout);
        timeout = setTimeout(triggerReload, 350);
      });
    }

    if (statusFilter) statusFilter.addEventListener('change', triggerReload);
    if (btnRefresh) btnRefresh.addEventListener('click', triggerReload);

    // Carregamento inicial da lista
    this.loadDocumentsList();

    // Evento de confirmação de revogação no modal
    const btnConfirmRevoke = document.getElementById('btnConfirmRevoke');
    if (btnConfirmRevoke) {
      btnConfirmRevoke.addEventListener('click', async () => {
        const docId = Number((document.getElementById('revokeDocIdInput') as HTMLInputElement)?.value);
        const reason = (document.getElementById('revokeReasonInput') as HTMLTextAreaElement)?.value;
        const alertBox = document.getElementById('revokeAlertBox');

        if (!reason || reason.trim().length < 5) {
          if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.textContent = 'A justificativa deve conter pelo menos 5 caracteres.';
            alertBox.classList.remove('d-none');
          }
          return;
        }

        btnConfirmRevoke.setAttribute('disabled', 'true');
        btnConfirmRevoke.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>A revogar...';

        const res = await authService.revokeDocument(docId, reason);

        btnConfirmRevoke.removeAttribute('disabled');
        btnConfirmRevoke.innerHTML = '<i class="bi bi-slash-circle me-1"></i> Confirmar Revogação';

        if (!res.success) {
          if (alertBox) {
            alertBox.className = 'alert alert-danger py-2 small';
            alertBox.textContent = res.error || 'Erro ao revogar.';
            alertBox.classList.remove('d-none');
          }
          return;
        }

        // Fecha modal
        const modalEl = document.getElementById('modalRevokeDoc');
        if (modalEl && (window as any).bootstrap) {
          const modalInst = (window as any).bootstrap.Modal.getInstance(modalEl);
          if (modalInst) modalInst.hide();
        }

        // Exibe alerta na lista e recarrega
        const listAlert = document.getElementById('docListAlert');
        if (listAlert) {
          listAlert.className = 'alert alert-success py-2 px-3 small';
          listAlert.textContent = res.message || 'Documento revogado com sucesso.';
          listAlert.classList.remove('d-none');
          setTimeout(() => listAlert.classList.add('d-none'), 5000);
        }

        triggerReload();
      });
    }
  }

  private async loadDocumentsList(params?: { search?: string; status?: string }): Promise<void> {
    const tableBody = document.getElementById('docsTableBody');
    const countSummary = document.getElementById('docCountSummary');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          A consultar documentos no MySQL...
        </td>
      </tr>
    `;

    const res = await authService.getDocuments(params);

    if (!res.success || !res.documents) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Falha ao carregar documentos: ${res.error}</td></tr>`;
      return;
    }

    const docs = res.documents;
    if (countSummary) {
      countSummary.textContent = `A exibir ${docs.length} documento(s) registado(s)`;
    }

    if (docs.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-5 text-muted">
            <i class="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>
            Nenhum documento encontrado com os critérios selecionados.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = docs.map(doc => {
      const statusBadge = 
        doc.status === 'valid' ? '<span class="badge bg-success bg-opacity-15 text-success border border-success border-opacity-50 px-2 py-1"><i class="bi bi-patch-check-fill me-1"></i>VALID</span>' :
        doc.status === 'revoked' ? '<span class="badge bg-danger bg-opacity-15 text-danger border border-danger border-opacity-50 px-2 py-1"><i class="bi bi-slash-circle me-1"></i>REVOKED</span>' :
        '<span class="badge bg-warning bg-opacity-15 text-warning border border-warning border-opacity-50 px-2 py-1"><i class="bi bi-clock-history me-1"></i>EXPIRED</span>';

      const dateStr = doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('pt-PT') : '-';
      const safeCode = escapeHtml(doc.verification_code);
      const safeHolder = escapeHtml(doc.holder_name);
      const safeCourse = escapeHtml(doc.course || 'Geral');
      const safeType = escapeHtml(doc.document_type);

      return `
        <tr>
          <td class="ps-4">
            <span class="font-monospace fw-bold text-primary">${safeCode}</span>
          </td>
          <td>
            <div class="fw-bold text-dark">${safeHolder}</div>
            <div class="text-muted small">${safeCourse}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${safeType}</span></td>
          <td class="text-muted">${dateStr}</td>
          <td>${statusBadge}</td>
          <td class="text-end pe-4">
            <div class="btn-group btn-group-sm">
              <!-- Visualizar -->
              <button class="btn btn-outline-primary btn-action-view" data-id="${doc.id}" title="Visualizar Detalhes e QR Code">
                <i class="bi bi-eye"></i>
              </button>
              <!-- Verificar -->
              <a href="/verificar/${encodeURIComponent(doc.verification_code)}" data-route="/verificar/${encodeURIComponent(doc.verification_code)}" class="btn btn-outline-info" title="Validar na Plataforma">
                <i class="bi bi-shield-check"></i>
              </a>
              <!-- Revogar -->
              ${doc.status !== 'revoked' ? `
                <button class="btn btn-outline-danger btn-action-revoke" data-id="${doc.id}" data-code="${safeCode}" data-holder="${safeHolder}" title="Revogar Documento">
                  <i class="bi bi-slash-circle"></i>
                </button>
              ` : `
                <button class="btn btn-outline-secondary disabled" title="Já revogado">
                  <i class="bi bi-slash-circle"></i>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Listener para o botão Visualizar
    document.querySelectorAll('.btn-action-view').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number((e.currentTarget as HTMLElement).getAttribute('data-id'));
        this.openDocumentModal(id);
      });
    });

    // Listener para o botão Revogar
    document.querySelectorAll('.btn-action-revoke').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const id = target.getAttribute('data-id') || '';
        const code = target.getAttribute('data-code') || '';
        const holder = target.getAttribute('data-holder') || '';

        (document.getElementById('revokeDocIdInput') as HTMLInputElement).value = id;
        (document.getElementById('revokeModalDocCode') as HTMLElement).textContent = code;
        (document.getElementById('revokeModalDocHolder') as HTMLElement).textContent = holder;
        (document.getElementById('revokeReasonInput') as HTMLTextAreaElement).value = '';
        document.getElementById('revokeAlertBox')?.classList.add('d-none');

        const modalEl = document.getElementById('modalRevokeDoc');
        if (modalEl && (window as any).bootstrap) {
          const modalInstance = (window as any).bootstrap.Modal.getOrCreateInstance(modalEl);
          modalInstance.show();
        }
      });
    });
  }

  /**
   * Abre o Modal de Visualização Completa de Documento com Histórico
   */
  private async openDocumentModal(id: number): Promise<void> {
    const modalBody = document.getElementById('modalViewBody');
    const modalTitle = document.getElementById('modalViewTitle');
    const modalBtnVerify = document.getElementById('modalBtnVerify') as HTMLAnchorElement | null;
    const modalEl = document.getElementById('modalViewDoc');

    if (!modalBody || !modalTitle) return;

    modalBody.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary mb-2"></div>
        <div>A carregar dados do documento e histórico do MySQL...</div>
      </div>
    `;

    if (modalEl && (window as any).bootstrap) {
      (window as any).bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }

    const res = await authService.getDocument(id);

    if (!res.success || !res.document) {
      modalBody.innerHTML = `<div class="alert alert-danger py-2 small">${res.error || 'Erro ao carregar documento.'}</div>`;
      return;
    }

    const doc = res.document;
    const history = res.history || [];

    modalTitle.textContent = `${doc.document_type} - ${doc.verification_code}`;

    if (modalBtnVerify) {
      modalBtnVerify.href = `/verificar?code=${encodeURIComponent(doc.verification_code)}`;
      modalBtnVerify.setAttribute('data-route', `/verificar?code=${encodeURIComponent(doc.verification_code)}`);
      modalBtnVerify.onclick = (e) => {
        e.preventDefault();
        (window as any).bootstrap.Modal.getInstance(modalEl)?.hide();
        this.navigateTo(`/verificar?code=${encodeURIComponent(doc.verification_code)}`);
      };
    }

    const statusBadge = 
      doc.status === 'valid' ? '<span class="badge bg-success">VALID</span>' :
      doc.status === 'revoked' ? '<span class="badge bg-danger">REVOKED</span>' :
      '<span class="badge bg-warning text-dark">EXPIRED</span>';

    const issueDateStr = doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('pt-PT') : '-';
    const expiryDateStr = doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('pt-PT') : 'Vitalício';
    const safeCode = escapeHtml(doc.verification_code);
    const safeHolder = escapeHtml(doc.holder_name);
    const safeCourse = escapeHtml(doc.course);
    const safeArea = escapeHtml(doc.area || '');
    const safeInst = escapeHtml(doc.institution_name || 'Instituição Homologada');
    const safeType = escapeHtml(doc.document_type);
    const safeDesc = escapeHtml(doc.description || '');
    const safeHash = escapeHtml(doc.hash);

    modalBody.innerHTML = `
      <div class="bg-white p-4 rounded-4 border border-light-subtle shadow-sm mb-4">
        <div class="row align-items-center g-4">
          <div class="col-md-8">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="font-monospace fw-bold fs-4 text-primary">${safeCode}</span>
              ${statusBadge}
            </div>
            <h4 class="fw-bold text-dark mb-1">${safeHolder}</h4>
            <div class="text-secondary small mb-3">${safeCourse} ${safeArea ? `· ${safeArea}` : ''}</div>

            <div class="row g-2 small border-top pt-3">
              <div class="col-6">
                <span class="text-muted d-block">Entidade Emissora:</span>
                <strong>${safeInst}</strong>
              </div>
              <div class="col-6">
                <span class="text-muted d-block">Tipo de Documento:</span>
                <strong>${safeType}</strong>
              </div>
              <div class="col-6">
                <span class="text-muted d-block">Data de Emissão:</span>
                <span>${issueDateStr}</span>
              </div>
              <div class="col-6">
                <span class="text-muted d-block">Data de Validade:</span>
                <span>${expiryDateStr}</span>
              </div>
            </div>

            ${doc.description ? `
              <div class="mt-3 p-2 bg-light rounded text-secondary small">
                <strong>Descrição:</strong> ${safeDesc}
              </div>
            ` : ''}

            <div class="mt-3 p-2 bg-dark text-secondary rounded font-monospace small text-break" style="font-size: 0.68rem;">
              <span class="text-white">Hash Criptográfico SHA-256 (Canônico):</span><br>
              <span class="text-info">${safeHash}</span>
            </div>
          </div>

          <div class="col-md-4 text-center">
            ${doc.qr_code ? `
              <div class="p-2 bg-white rounded-3 border border-light-subtle shadow-sm d-inline-block">
                <img src="${doc.qr_code}" alt="QR Code" style="width: 170px; height: 170px;" class="img-fluid">
                <div class="mt-1 small text-muted" style="font-size: 0.7rem;">Selo Digital QR Code</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- HISTÓRICO DO DOCUMENTO (AUDITORIA E RASTREABILIDADE) -->
      <div class="card border border-light-subtle rounded-4 p-3 bg-white">
        <h6 class="fw-bold text-dark mb-3"><i class="bi bi-clock-history me-1 text-primary"></i> Linha do Tempo & Histórico</h6>
        <div class="timeline small">
          ${history.length === 0 ? '<div class="text-muted">Nenhum evento registrado.</div>' : history.map(h => `
            <div class="d-flex gap-2 mb-2 pb-2 border-bottom border-light-subtle">
              <span class="badge ${h.action === 'created' ? 'bg-success' : h.action === 'reissued' ? 'bg-info text-dark' : h.action === 'updated' ? 'bg-warning text-dark' : 'bg-danger'} text-uppercase" style="font-size: 0.68rem; height: fit-content;">
                ${escapeHtml(h.action)}
              </span>
              <div class="flex-grow-1">
                <div class="text-dark fw-semibold">${escapeHtml(h.description)}</div>
                <div class="text-muted" style="font-size: 0.72rem;">
                  Operador: ${escapeHtml(h.user_name || 'Sistema')} · ${new Date(h.created_at).toLocaleString('pt-PT')}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Eventos: Verificação Pública (/verificar e /verificar/{codigo})
   */
  private attachVerifyEvents(): void {
    const inputCode = document.getElementById('verificationCodeInput') as HTMLInputElement | null;
    const btnVerify = document.getElementById('btnVerifyCode');
    const resultContainer = document.getElementById('resultContainer');
    const qrFileInput = document.getElementById('qrFileInput') as HTMLInputElement | null;

    const executeVerify = async (codeToVerify: string) => {
      const code = codeToVerify.trim().toUpperCase();
      if (!code || !resultContainer) return;

      if (inputCode) inputCode.value = code;

      resultContainer.innerHTML = `
        <div class="py-5 text-center">
          <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
          <h5 class="fw-bold text-dark">A consultar registro oficial no MySQL...</h5>
          <p class="text-secondary small">Verificando integridade criptográfica, instituição e estado da certificação</p>
        </div>
      `;

      const res = await authService.verifyDocumentPublic(code);

      resultContainer.innerHTML = buildVerificationResultHtml({
        found: res.found,
        result: (res.result as any) || 'not_found',
        title: (res as any).title || (res.found ? 'DOCUMENTO VÁLIDO' : 'DOCUMENTO NÃO ENCONTRADO'),
        message: (res as any).message,
        document: (res as any).document,
        queryCode: code,
      });

      document.getElementById('btnResetVerify')?.addEventListener('click', () => {
        if (inputCode) inputCode.value = '';
        this.currentVerifyCode = '';
        this.navigateTo('/verificar');
      });
    };

    if (btnVerify && inputCode) {
      btnVerify.addEventListener('click', () => {
        executeVerify(inputCode.value);
      });

      inputCode.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          executeVerify(inputCode.value);
        }
      });
    }

    if (qrFileInput) {
      qrFileInput.addEventListener('change', () => {
        alert('Foto selecionada com sucesso! Aponte a câmara ou insira o código alfanumérico impresso sob o QR Code para consulta direta.');
      });
    }

    // Se houver código na URL (/verificar/{codigo} ou ?code=...)
    if (this.currentVerifyCode) {
      executeVerify(this.currentVerifyCode);
    } else if (resultContainer) {
      // Estado inicial sem código submetido
      resultContainer.innerHTML = `
        <div class="p-5 text-center">
          <div class="mx-auto mb-3 text-secondary opacity-50" style="font-size: 3rem;">
            <i class="bi bi-shield-check"></i>
          </div>
          <h4 class="fw-bold text-dark mb-2">Aguardando Validação</h4>
          <p class="text-secondary small mx-auto mb-0" style="max-width: 480px;">
            Insira o código do documento ou escaneie o QR Code oficial para consultar a autenticidade e validade em tempo real.
          </p>
        </div>
      `;
    }
  }

  /**
   * Eventos: Login
   */
  private attachLoginEvents(): void {
    const emailInput = document.getElementById('loginEmail') as HTMLInputElement | null;
    const passInput = document.getElementById('loginPassword') as HTMLInputElement | null;
    const alertBox = document.getElementById('loginAlertBox');
    const form = document.getElementById('loginForm');

    const fillAdmin = document.getElementById('fillAdmin');
    if (fillAdmin && emailInput && passInput) {
      fillAdmin.addEventListener('click', () => {
        emailInput.value = 'admin@veridoc.app';
        passInput.value = 'Admin@2026';
        if (alertBox) alertBox.classList.add('d-none');
      });
    }

    const fillApproved = document.getElementById('fillApproved');
    if (fillApproved && emailInput && passInput) {
      fillApproved.addEventListener('click', () => {
        emailInput.value = 'carlos@politecnico.pt';
        passInput.value = 'Carlos@2026';
        if (alertBox) alertBox.classList.add('d-none');
      });
    }

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
              <div class="fw-bold mb-1"><i class="bi bi-hourglass-split me-1"></i> Cadastro PENDENTE</div>
              <div>${res.error}</div>
            `;
          } else {
            alertBox.innerHTML = `<i class="bi bi-exclamation-triangle me-1"></i> ${res.error}`;
          }
          alertBox.classList.remove('d-none');
          return;
        }

        this.navigateTo('/instituicao/dashboard');
      });
    }

    const btnOpenRecovery = document.getElementById('btnOpenRecovery');
    if (btnOpenRecovery) {
      btnOpenRecovery.addEventListener('click', () => {
        const modalEl = document.getElementById('modalRecovery');
        if (modalEl && (window as any).bootstrap) {
          (window as any).bootstrap.Modal.getOrCreateInstance(modalEl).show();
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
          recAlert.textContent = 'Informe o email.';
          recAlert.classList.remove('d-none');
          return;
        }

        btnSubmitRecovery.textContent = 'A enviar...';
        const res = await authService.forgotPassword(recEmail);
        btnSubmitRecovery.textContent = 'Enviar Link de Redefinição';

        if (recAlert) {
          recAlert.className = 'alert alert-success py-2 small';
          recAlert.textContent = res.message || 'Instruções enviadas.';
          recAlert.classList.remove('d-none');
        }
      });
    }
  }

  /**
   * Eventos: Cadastro Institucional
   */
  private attachRegisterEvents(): void {
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
          return;
        }

        regAlert.className = 'alert alert-success py-4 px-4 small border-success shadow-sm';
        regAlert.innerHTML = `
          <div class="d-flex align-items-start gap-3">
            <div class="text-success fs-3"><i class="bi bi-check-circle-fill"></i></div>
            <div>
              <h5 class="alert-heading fw-bold text-success mb-1">Candidatura Registada!</h5>
              <p class="mb-2 text-dark">
                A instituição <strong>${formData.name}</strong> foi gravada com o status <span class="badge bg-warning text-dark">PENDING</span>.
              </p>
              <a href="/login" data-route="/login" class="btn btn-sm btn-success">Ir para o Login</a>
            </div>
          </div>
        `;
        regAlert.classList.remove('d-none');
        regForm.reset();
      });
    }
  }

  /**
   * Eventos: Dashboard Geral
   */
  private async loadDashboardData(): Promise<void> {
    const user = authService.getUser();
    if (!user) return;
    if (user.role !== 'admin' && user.institutionStatus === 'pending') return;

    const isAdmin = user.role === 'admin';

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

      document.getElementById('btnRefreshAdminList')?.addEventListener('click', () => this.loadAdminInstitutions());
    }

    document.getElementById('btnRefreshStats')?.addEventListener('click', () => this.fetchStats());

    await this.fetchStats();
    if (isAdmin) {
      this.updateAdminPendingBadge();
    }
  }

  private async fetchStats(): Promise<void> {
    const res = await authService.getDashboardStats();
    if (!res.success) return;

    const stats = res.data.stats;
    const recent = res.data.recent_documents || [];

    const elTotal = document.getElementById('statTotalDocs');
    const elValid = document.getElementById('statValidDocs');
    const elRevoked = document.getElementById('statRevokedDocs');
    const elVerif = document.getElementById('statVerifications');

    if (elTotal) elTotal.textContent = stats.total_documents.toString();
    if (elValid) elValid.textContent = stats.valid_documents.toString();
    if (elRevoked) elRevoked.textContent = stats.revoked_documents.toString();
    if (elVerif) elVerif.textContent = stats.total_verifications.toString();

    const tableBody = document.getElementById('recentDocsTableBody');
    if (tableBody) {
      if (recent.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">Nenhum documento emitido até o momento.</td></tr>`;
      } else {
        tableBody.innerHTML = recent.map((doc: any) => {
          const statusBadge = 
            doc.status === 'valid' ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">Válido</span>' :
            doc.status === 'revoked' ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2 py-1">Revogado</span>' :
            '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1">Expirado</span>';

          const formattedDate = doc.issue_date ? new Date(doc.issue_date).toLocaleDateString('pt-PT') : '-';

          return `
            <tr>
              <td class="ps-4 font-monospace fw-bold text-primary">${escapeHtml(doc.verification_code)}</td>
              <td class="fw-semibold">${escapeHtml(doc.document_type)}</td>
              <td>${escapeHtml(doc.holder_name)}</td>
              <td>${escapeHtml(doc.course || 'Geral')}</td>
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
      }
    }
  }

  private async loadAdminInstitutions(): Promise<void> {
    await this.loadAdminInstitutionsList();
  }

  // ==========================================================================
  // MÉTODOS DO PAINEL ADMINISTRATIVO (ROLE: ADMIN)
  // ==========================================================================

  /**
   * 1. Dashboard Administrativo (/admin/dashboard)
   * Carrega e monitora os 7 KPIs e tabelas em tempo real
   */
  private async attachAdminDashboardEvents(): Promise<void> {
    const btnRefresh = document.getElementById('btnRefreshAdminStats');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadAdminDashboardStats());
    }

    await this.loadAdminDashboardStats();
  }

  private async loadAdminDashboardStats(): Promise<void> {
    const res = await authService.getAdminStats();
    if (!res.success || !res.stats) return;

    const stats = res.stats;

    // 1. Número de instituições
    const elInstTotal = document.getElementById('kpiTotalInstitutions');
    if (elInstTotal) elInstTotal.textContent = stats.institutions.total.toString();

    // 2. Instituições pendentes
    const elInstPending = document.getElementById('kpiPendingInstitutions');
    if (elInstPending) elInstPending.textContent = stats.institutions.pending.toString();

    // 3. Instituições aprovadas
    const elInstApproved = document.getElementById('kpiApprovedInstitutions');
    if (elInstApproved) elInstApproved.textContent = stats.institutions.approved.toString();

    // 4. Documentos emitidos
    const elDocsTotal = document.getElementById('kpiTotalDocuments');
    if (elDocsTotal) elDocsTotal.textContent = stats.documents.total.toString();

    // 5. Documentos válidos
    const elDocsValid = document.getElementById('kpiValidDocuments');
    if (elDocsValid) elDocsValid.textContent = stats.documents.valid.toString();

    // 6. Documentos revogados
    const elDocsRevoked = document.getElementById('kpiRevokedDocuments');
    if (elDocsRevoked) elDocsRevoked.textContent = stats.documents.revoked.toString();

    // 7. Total de verificações
    const elVerifTotal = document.getElementById('kpiTotalVerifications');
    if (elVerifTotal) elVerifTotal.textContent = stats.verifications.total.toString();

    // Alerta de Pendências
    const alertBox = document.getElementById('adminPendingAlert');
    const alertCount = document.getElementById('pendingAlertCount');
    const sidebarBadge = document.getElementById('adminSidebarPendingBadge');

    if (stats.institutions.pending > 0) {
      if (alertBox) alertBox.classList.remove('d-none');
      if (alertCount) alertCount.textContent = stats.institutions.pending.toString();
      if (sidebarBadge) {
        sidebarBadge.textContent = stats.institutions.pending.toString();
        sidebarBadge.classList.remove('d-none');
      }
    } else {
      if (alertBox) alertBox.classList.add('d-none');
      if (sidebarBadge) sidebarBadge.classList.add('d-none');
    }

    // Tabela de Instituições Recentes
    const tblInst = document.getElementById('tblRecentInstitutions');
    if (tblInst) {
      const recInst = stats.recent_institutions || [];
      if (recInst.length === 0) {
        tblInst.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma instituição registada.</td></tr>`;
      } else {
        tblInst.innerHTML = recInst.map((item: any) => {
          const badgeClass = item.status === 'approved' ? 'bg-success' : item.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger';
          return `
            <tr>
              <td>
                <div class="fw-bold text-dark">${escapeHtml(item.name)}</div>
                <div class="text-muted small">${escapeHtml(item.city)}, ${escapeHtml(item.country)}</div>
              </td>
              <td><span class="badge bg-light text-dark border">${escapeHtml(item.type)}</span></td>
              <td><span class="badge ${badgeClass} text-uppercase px-2 py-1">${item.status}</span></td>
              <td class="text-end">
                <a href="/admin/institutions" data-route="/admin/institutions" class="btn btn-outline-primary btn-sm py-0 px-2" style="font-size: 0.72rem;">
                  Gerir
                </a>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // Tabela de Verificações Recentes
    const tblVerif = document.getElementById('tblRecentVerifications');
    if (tblVerif) {
      const recVerif = stats.recent_verifications || [];
      if (recVerif.length === 0) {
        tblVerif.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">Nenhuma verificação realizada ainda.</td></tr>`;
      } else {
        tblVerif.innerHTML = recVerif.map((item: any) => {
          const isOk = item.result === 'valid';
          const isRev = item.result === 'revoked';
          const badgeClass = isOk ? 'bg-success' : isRev ? 'bg-danger' : 'bg-warning text-dark';
          const dateStr = item.verified_at ? new Date(item.verified_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '-';

          return `
            <tr>
              <td>
                <span class="font-monospace fw-bold text-primary">${escapeHtml(item.verification_code)}</span>
              </td>
              <td><span class="badge ${badgeClass} text-uppercase px-2 py-1">${escapeHtml(item.result)}</span></td>
              <td><span class="text-muted font-monospace small">${escapeHtml(item.ip_address || '-')}</span></td>
              <td class="text-muted small">${dateStr}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  /**
   * 2. Gestão de Instituições (/admin/institutions)
   * Pesquisa, filtros, aprovação, suspensão, rejeição e visualização detalhada
   */
  private currentInstFilterStatus: string = 'all';
  private currentInstSearchQuery: string = '';

  private attachAdminInstitutionsEvents(): void {
    const inputSearch = document.getElementById('inputSearchInstitutions') as HTMLInputElement | null;
    const selectStatus = document.getElementById('selectStatusFilter') as HTMLSelectElement | null;
    const btnClear = document.getElementById('btnClearSearch');
    const btnRefresh = document.getElementById('btnRefreshInstitutions');

    // Parse URL params se houver (ex: /admin/institutions?status=pending)
    const urlParams = new URLSearchParams(window.location.search);
    const initialStatus = urlParams.get('status');
    if (initialStatus && selectStatus) {
      selectStatus.value = initialStatus;
      this.currentInstFilterStatus = initialStatus;
    }

    if (inputSearch) {
      inputSearch.addEventListener('input', () => {
        this.currentInstSearchQuery = inputSearch.value.trim();
        this.loadAdminInstitutionsList();
      });
    }

    if (btnClear && inputSearch) {
      btnClear.addEventListener('click', () => {
        inputSearch.value = '';
        this.currentInstSearchQuery = '';
        this.loadAdminInstitutionsList();
      });
    }

    if (selectStatus) {
      selectStatus.addEventListener('change', () => {
        this.currentInstFilterStatus = selectStatus.value;
        this.loadAdminInstitutionsList();
      });
    }

    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.loadAdminInstitutionsList());
    }

    // Clique nos cards estatísticos superiores como filtro rápido
    document.querySelectorAll('.institution-stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.getAttribute('data-filter') || 'all';
        this.currentInstFilterStatus = filter;
        if (selectStatus) selectStatus.value = filter;
        this.loadAdminInstitutionsList();
      });
    });

    // Submissão do Modal de Mudança de Status
    const btnConfirmStatus = document.getElementById('btnConfirmStatusChange');
    if (btnConfirmStatus) {
      btnConfirmStatus.addEventListener('click', async () => {
        const instId = Number((document.getElementById('changeStatusInstId') as HTMLInputElement)?.value);
        const newStatus = (document.getElementById('changeStatusNewStatus') as HTMLInputElement)?.value;
        const reason = (document.getElementById('changeStatusReason') as HTMLTextAreaElement)?.value;

        if (!instId || !newStatus) return;

        btnConfirmStatus.setAttribute('disabled', 'true');
        btnConfirmStatus.textContent = 'A processar...';

        const res = await authService.updateInstitutionStatus(instId, newStatus, reason);

        btnConfirmStatus.removeAttribute('disabled');
        btnConfirmStatus.textContent = 'Confirmar Alteração';

        // Fecha modal
        const modalEl = document.getElementById('modalChangeStatus');
        if (modalEl) {
          ((window as any).bootstrap?.Modal?.getInstance(modalEl))?.hide();
        }

        if (res.success) {
          await this.loadAdminInstitutionsList();
        } else {
          alert('Erro ao alterar status: ' + (res.error || 'Erro desconhecido.'));
        }
      });
    }

    this.loadAdminInstitutionsList();
  }

  private async loadAdminInstitutionsList(): Promise<void> {
    const tableBody = document.getElementById('institutionsTableBody');
    const countBadge = document.getElementById('countInstitutionsShown');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          A consultar base de dados MySQL...
        </td>
      </tr>
    `;

    const res = await authService.getAdminInstitutions(this.currentInstSearchQuery, this.currentInstFilterStatus);
    if (!res.success || !res.institutions) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-4 text-danger">
            <i class="bi bi-exclamation-circle me-1"></i> Falha ao carregar instituições: ${res.error}
          </td>
        </tr>
      `;
      return;
    }

    const institutions = res.institutions;
    const stats = res.stats || {};

    // Atualiza contadores superiores
    const elTot = document.getElementById('statInstTotal');
    const elPend = document.getElementById('statInstPending');
    const elApp = document.getElementById('statInstApproved');
    const elSusp = document.getElementById('statInstSuspended');

    if (elTot) elTot.textContent = stats.total?.toString() || '0';
    if (elPend) elPend.textContent = stats.pending?.toString() || '0';
    if (elApp) elApp.textContent = stats.approved?.toString() || '0';
    if (elSusp) elSusp.textContent = stats.suspended?.toString() || '0';

    if (countBadge) countBadge.textContent = institutions.length.toString();

    if (institutions.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center py-5 text-muted">
            <i class="bi bi-search fs-3 d-block mb-2 text-secondary"></i>
            Nenhuma instituição encontrada para os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = institutions.map(inst => {
      const isApproved = inst.status === 'approved';
      const isPending = inst.status === 'pending';
      const isSuspended = inst.status === 'suspended';
      const isRejected = inst.status === 'rejected';

      const statusBadge = 
        isApproved ? '<span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2.5 py-1">APROVADA</span>' :
        isPending ? '<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2.5 py-1">PENDENTE</span>' :
        isSuspended ? '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-2.5 py-1">SUSPENSA</span>' :
        '<span class="badge bg-secondary px-2.5 py-1">REJEITADA</span>';

      return `
        <tr>
          <td class="fw-bold text-muted font-monospace">#${inst.id}</td>
          <td>
            <div class="fw-bold text-dark">${escapeHtml(inst.name)}</div>
            <span class="text-muted small font-monospace">${escapeHtml(inst.email)}</span>
          </td>
          <td>
            <span class="badge bg-light text-dark border small">${escapeHtml(inst.type)}</span>
          </td>
          <td>
            <div class="text-dark small">${escapeHtml(inst.city)}, ${escapeHtml(inst.country)}</div>
          </td>
          <td>
            <div class="text-dark small fw-semibold">${escapeHtml(inst.responsible_name)}</div>
            <span class="text-muted small" style="font-size: 0.72rem;">${escapeHtml(inst.responsible_email)}</span>
          </td>
          <td>
            <span class="badge bg-light text-dark border font-monospace">${inst.total_documents || 0}</span>
          </td>
          <td>${statusBadge}</td>
          <td class="text-end">
            <div class="btn-group btn-group-sm">
              <!-- Visualizar -->
              <button 
                type="button" 
                class="btn btn-outline-secondary btn-sm btn-view-inst" 
                data-id="${inst.id}" 
                title="Visualizar Detalhes"
              >
                <i class="bi bi-eye"></i>
              </button>

              <!-- Aprovar (se não estiver aprovada) -->
              ${!isApproved ? `
                <button 
                  type="button" 
                  class="btn btn-outline-success btn-sm btn-action-modal-status" 
                  data-id="${inst.id}" 
                  data-name="${escapeHtml(inst.name)}" 
                  data-status="approved" 
                  title="Aprovar Instituição"
                >
                  <i class="bi bi-check-lg"></i>
                </button>
              ` : ''}

              <!-- Suspender (se aprovada) -->
              ${isApproved ? `
                <button 
                  type="button" 
                  class="btn btn-outline-warning btn-sm btn-action-modal-status" 
                  data-id="${inst.id}" 
                  data-name="${escapeHtml(inst.name)}" 
                  data-status="suspended" 
                  title="Suspender Acesso"
                >
                  <i class="bi bi-pause-circle"></i>
                </button>
              ` : ''}

              <!-- Rejeitar (se pendente) -->
              ${isPending ? `
                <button 
                  type="button" 
                  class="btn btn-outline-danger btn-sm btn-action-modal-status" 
                  data-id="${inst.id}" 
                  data-name="${escapeHtml(inst.name)}" 
                  data-status="rejected" 
                  title="Rejeitar Candidatura"
                >
                  <i class="bi bi-x-circle"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos dos botões da tabela
    // 1. Botão Visualizar
    document.querySelectorAll('.btn-view-inst').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = Number((e.currentTarget as HTMLElement).getAttribute('data-id'));
        await this.showInstitutionDetailsModal(id);
      });
    });

    // 2. Botão Abrir Modal de Status
    document.querySelectorAll('.btn-action-modal-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = (e.currentTarget as HTMLElement);
        const id = el.getAttribute('data-id') || '';
        const name = el.getAttribute('data-name') || '';
        const status = el.getAttribute('data-status') || 'approved';

        const titleEl = document.getElementById('changeStatusTitle');
        const promptEl = document.getElementById('changeStatusPrompt');
        const idInput = document.getElementById('changeStatusInstId') as HTMLInputElement | null;
        const statusInput = document.getElementById('changeStatusNewStatus') as HTMLInputElement | null;
        const reasonInput = document.getElementById('changeStatusReason') as HTMLTextAreaElement | null;

        if (idInput) idInput.value = id;
        if (statusInput) statusInput.value = status;
        if (reasonInput) reasonInput.value = '';

        if (titleEl) {
          titleEl.innerHTML = status === 'approved' 
            ? '<i class="bi bi-shield-check text-success me-2"></i> Aprovar Instituição' 
            : status === 'suspended'
            ? '<i class="bi bi-slash-circle text-warning me-2"></i> Suspender Instituição'
            : '<i class="bi bi-x-circle text-danger me-2"></i> Rejeitar Candidatura';
        }

        if (promptEl) {
          promptEl.innerHTML = `Você está prestes a alterar o status da instituição <strong>${name}</strong> para <strong>${status.toUpperCase()}</strong>.`;
        }

        const modalEl = document.getElementById('modalChangeStatus');
        if (modalEl) {
          ((window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl))?.show();
        }
      });
    });
  }

  private async showInstitutionDetailsModal(id: number): Promise<void> {
    const modalEl = document.getElementById('modalViewInstitution');
    const modalBody = document.getElementById('modalViewInstitutionBody');
    if (!modalEl || !modalBody) return;

    modalBody.innerHTML = `
      <div class="text-center py-5">
        <div class="spinner-border text-primary mb-2"></div>
        <div class="text-muted small">A carregar detalhes da instituição...</div>
      </div>
    `;

    ((window as any).bootstrap?.Modal?.getOrCreateInstance(modalEl))?.show();

    const res = await authService.getAdminInstitution(id);
    if (!res.success || !res.institution) {
      modalBody.innerHTML = `<div class="alert alert-danger">Falha ao buscar dados da instituição: ${res.error}</div>`;
      return;
    }

    const inst = res.institution;
    const users = res.users || [];
    const recentDocs = res.recent_documents || [];
    const dateStr = inst.created_at ? new Date(inst.created_at).toLocaleDateString('pt-PT') : '-';

    modalBody.innerHTML = `
      <div class="row g-4">
        <!-- Coluna 1: Dados Institucionais -->
        <div class="col-md-6">
          <div class="p-3 bg-light rounded-3 h-100">
            <h6 class="fw-bold text-dark border-bottom pb-2 mb-3">
              <i class="bi bi-building me-1 text-primary"></i> Identificação Institucional
            </h6>
            <div class="mb-2">
              <span class="text-muted small d-block">Nome Oficial:</span>
              <strong class="text-dark">${escapeHtml(inst.name)}</strong>
            </div>
            <div class="mb-2">
              <span class="text-muted small d-block">Tipo de Entidade:</span>
              <span class="badge bg-secondary">${escapeHtml(inst.type)}</span>
            </div>
            <div class="mb-2">
              <span class="text-muted small d-block">Localização:</span>
              <span class="text-dark">${escapeHtml(inst.city)}, ${escapeHtml(inst.country)}</span>
            </div>
            <div class="mb-2">
              <span class="text-muted small d-block">Email de Contato:</span>
              <span class="font-monospace small text-primary">${escapeHtml(inst.email)}</span>
            </div>
            <div class="mb-2">
              <span class="text-muted small d-block">Data de Registro:</span>
              <span class="text-dark">${dateStr}</span>
            </div>
            <div>
              <span class="text-muted small d-block">Estado Atual:</span>
              <span class="badge ${inst.status === 'approved' ? 'bg-success' : inst.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger'} text-uppercase px-2.5 py-1">
                ${inst.status}
              </span>
            </div>
          </div>
        </div>

        <!-- Coluna 2: Responsável e Estatísticas -->
        <div class="col-md-6">
          <div class="p-3 bg-light rounded-3 h-100">
            <h6 class="fw-bold text-dark border-bottom pb-2 mb-3">
              <i class="bi bi-person-badge me-1 text-primary"></i> Responsável Legal
            </h6>
            <div class="mb-2">
              <span class="text-muted small d-block">Nome do Responsável:</span>
              <strong class="text-dark">${escapeHtml(inst.responsible_name)}</strong>
            </div>
            <div class="mb-3">
              <span class="text-muted small d-block">Email Institucional:</span>
              <span class="font-monospace small text-primary">${escapeHtml(inst.responsible_email)}</span>
            </div>

            <h6 class="fw-bold text-dark border-bottom pb-2 mb-2">
              <i class="bi bi-bar-chart me-1 text-primary"></i> Atividade na Plataforma
            </h6>
            <div class="row g-2">
              <div class="col-6">
                <div class="p-2 bg-white rounded border text-center">
                  <span class="text-muted small d-block">Documentos</span>
                  <span class="fs-5 fw-bold text-dark">${inst.total_documents || 0}</span>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 bg-white rounded border text-center">
                  <span class="text-muted small d-block">Operadores</span>
                  <span class="fs-5 fw-bold text-dark">${inst.total_users || users.length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Lista de Usuários Operadores -->
        <div class="col-12">
          <h6 class="fw-bold text-dark mb-2">
            <i class="bi bi-people me-1 text-primary"></i> Utilizadores Vinculados (${users.length})
          </h6>
          <div class="table-responsive bg-white border rounded">
            <table class="table table-sm table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Perfil (Role)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${users.length === 0 ? '<tr><td colspan="4" class="text-center py-2 text-muted">Nenhum operador vinculado.</td></tr>' : users.map(u => `
                  <tr>
                    <td>${escapeHtml(u.name)}</td>
                    <td class="font-monospace">${escapeHtml(u.email)}</td>
                    <td><span class="badge bg-light text-dark border">${escapeHtml(u.role)}</span></td>
                    <td><span class="badge bg-success bg-opacity-10 text-success">${escapeHtml(u.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Últimos Documentos Emitidos -->
        <div class="col-12">
          <h6 class="fw-bold text-dark mb-2">
            <i class="bi bi-file-earmark-check me-1 text-primary"></i> Últimos Documentos Emitidos (${recentDocs.length})
          </h6>
          <div class="table-responsive bg-white border rounded">
            <table class="table table-sm table-hover mb-0 small">
              <thead class="table-light">
                <tr>
                  <th>Código</th>
                  <th>Titular</th>
                  <th>Tipo / Curso</th>
                  <th>Data</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentDocs.length === 0 ? '<tr><td colspan="5" class="text-center py-2 text-muted">Nenhum documento emitido por esta instituição.</td></tr>' : recentDocs.map(d => `
                  <tr>
                    <td class="font-monospace fw-bold text-primary">${escapeHtml(d.verification_code)}</td>
                    <td>${escapeHtml(d.holder_name)}</td>
                    <td>${escapeHtml(d.document_type)} - ${escapeHtml(d.course || '')}</td>
                    <td class="text-muted">${d.issue_date ? new Date(d.issue_date).toLocaleDateString('pt-PT') : '-'}</td>
                    <td><span class="badge ${d.status === 'valid' ? 'bg-success' : 'bg-danger'}">${escapeHtml(d.status)}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  /**
   * 3. Consulta Global de Documentos (/admin/documents)
   */
  private attachAdminDocumentsEvents(): void {
    const inputSearch = document.getElementById('inputSearchAdminDocs') as HTMLInputElement | null;
    const selectStatus = document.getElementById('selectAdminDocStatus') as HTMLSelectElement | null;
    const selectInst = document.getElementById('selectAdminDocInstitution') as HTMLSelectElement | null;
    const btnRefresh = document.getElementById('btnRefreshAdminDocs');

    // Popula dropdown de instituições
    authService.getAdminInstitutions().then(res => {
      if (res.success && res.institutions && selectInst) {
        selectInst.innerHTML = '<option value="all">Todas as Instituições</option>' +
          res.institutions.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
      }
    });

    const triggerReload = () => {
      const search = inputSearch?.value.trim() || '';
      const status = selectStatus?.value || 'all';
      const instId = selectInst?.value || 'all';
      this.loadAdminDocumentsList(search, status, instId);
    };

    if (inputSearch) inputSearch.addEventListener('input', triggerReload);
    if (selectStatus) selectStatus.addEventListener('change', triggerReload);
    if (selectInst) selectInst.addEventListener('change', triggerReload);
    if (btnRefresh) btnRefresh.addEventListener('click', triggerReload);

    this.loadAdminDocumentsList();
  }

  private async loadAdminDocumentsList(search?: string, status?: string, instId?: string): Promise<void> {
    const tableBody = document.getElementById('adminDocsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          A carregar documentos...
        </td>
      </tr>
    `;

    const res = await authService.getAdminDocuments(search, status, instId);
    if (!res.success || !res.documents) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Falha ao buscar documentos: ${res.error}</td></tr>`;
      return;
    }

    const docs = res.documents;
    if (docs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-5 text-muted">Nenhum documento encontrado.</td></tr>`;
      return;
    }

    tableBody.innerHTML = docs.map(d => {
      const isOk = d.status === 'valid';
      const isRev = d.status === 'revoked';
      const badgeClass = isOk ? 'bg-success' : isRev ? 'bg-danger' : 'bg-warning text-dark';
      const dateStr = d.issue_date ? new Date(d.issue_date).toLocaleDateString('pt-PT') : '-';

      return `
        <tr>
          <td>
            <a href="/verificar/${d.verification_code}" data-route="/verificar/${d.verification_code}" class="font-monospace fw-bold text-primary text-decoration-none">
              ${escapeHtml(d.verification_code)}
            </a>
          </td>
          <td><strong class="text-dark">${escapeHtml(d.holder_name)}</strong></td>
          <td>
            <div>${escapeHtml(d.document_type)}</div>
            <span class="text-muted small">${escapeHtml(d.course || '-')}</span>
          </td>
          <td><span class="text-dark small">${escapeHtml(d.institution_name || '-')}</span></td>
          <td class="text-muted small">${dateStr}</td>
          <td><span class="badge ${badgeClass} text-uppercase px-2.5 py-1">${escapeHtml(d.status)}</span></td>
          <td><span class="badge bg-light text-dark border font-monospace">${(d as any).total_verifications || 0}</span></td>
          <td class="text-end">
            <a href="/verificar/${d.verification_code}" data-route="/verificar/${d.verification_code}" class="btn btn-outline-primary btn-sm py-0 px-2" style="font-size: 0.72rem;">
              <i class="bi bi-patch-check me-1"></i> Validar
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * 4. Consulta de Verificações Públicas (/admin/verifications)
   */
  private attachAdminVerificationsEvents(): void {
    const inputSearch = document.getElementById('inputSearchVerifications') as HTMLInputElement | null;
    const selectResult = document.getElementById('selectVerificationResult') as HTMLSelectElement | null;
    const btnRefresh = document.getElementById('btnRefreshVerifications');

    const triggerReload = () => {
      const search = inputSearch?.value.trim() || '';
      const result = selectResult?.value || 'all';
      this.loadAdminVerificationsList(search, result);
    };

    if (inputSearch) inputSearch.addEventListener('input', triggerReload);
    if (selectResult) selectResult.addEventListener('change', triggerReload);
    if (btnRefresh) btnRefresh.addEventListener('click', triggerReload);

    this.loadAdminVerificationsList();
  }

  private async loadAdminVerificationsList(search?: string, result?: string): Promise<void> {
    const tableBody = document.getElementById('verificationsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          A carregar histórico de verificações...
        </td>
      </tr>
    `;

    const res = await authService.getAdminVerifications(search, result);
    if (!res.success || !res.verifications) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Falha ao buscar verificações: ${res.error}</td></tr>`;
      return;
    }

    const items = res.verifications;
    if (items.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">Nenhum registro de verificação localizado.</td></tr>`;
      return;
    }

    tableBody.innerHTML = items.map(v => {
      const isOk = v.result === 'valid';
      const isRev = v.result === 'revoked';
      const isNotFound = v.result === 'not_found';
      const isTampered = v.result === 'tampered';

      const badgeClass = 
        isOk ? 'bg-success' :
        isRev ? 'bg-danger' :
        isNotFound ? 'bg-secondary' :
        isTampered ? 'bg-danger border border-white' : 'bg-warning text-dark';

      const dateStr = v.verified_at ? new Date(v.verified_at).toLocaleString('pt-PT') : '-';

      return `
        <tr>
          <td>
            <span class="font-monospace fw-bold text-primary">${escapeHtml(v.verification_code)}</span>
          </td>
          <td><span class="badge ${badgeClass} text-uppercase px-2.5 py-1">${escapeHtml(v.result)}</span></td>
          <td>
            <div class="text-dark fw-semibold">${escapeHtml(v.holder_name || '(Não identificado)')}</div>
            <span class="text-muted small">${escapeHtml(v.document_type || '')}</span>
          </td>
          <td><span class="text-muted small">${escapeHtml(v.institution_name || '-')}</span></td>
          <td><span class="font-monospace small text-muted">${escapeHtml(v.ip_address || '-')}</span></td>
          <td class="text-muted small">${dateStr}</td>
          <td class="text-end">
            <a href="/verificar/${v.verification_code}" data-route="/verificar/${v.verification_code}" class="btn btn-outline-secondary btn-sm py-0 px-2" style="font-size: 0.72rem;">
              Ver na Web
            </a>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * 5. Consulta de Logs de Auditoria (/admin/logs)
   */
  private attachAdminLogsEvents(): void {
    const inputSearch = document.getElementById('inputSearchLogs') as HTMLInputElement | null;
    const selectAction = document.getElementById('selectLogAction') as HTMLSelectElement | null;
    const btnRefresh = document.getElementById('btnRefreshLogs');

    const triggerReload = () => {
      const search = inputSearch?.value.trim() || '';
      const action = selectAction?.value || 'all';
      this.loadAdminLogsList(action, search);
    };

    if (inputSearch) inputSearch.addEventListener('input', triggerReload);
    if (selectAction) selectAction.addEventListener('change', triggerReload);
    if (btnRefresh) btnRefresh.addEventListener('click', triggerReload);

    this.loadAdminLogsList();
  }

  private async loadAdminLogsList(action?: string, search?: string): Promise<void> {
    const tableBody = document.getElementById('logsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-5 text-muted">
          <div class="spinner-border spinner-border-sm text-primary me-2"></div>
          A consultar trilha de auditoria...
        </td>
      </tr>
    `;

    const res = await authService.getAdminLogs(action, search);
    if (!res.success || !res.logs) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">Falha ao buscar logs: ${res.error}</td></tr>`;
      return;
    }

    const logs = res.logs;
    if (logs.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">Nenhum registro de log encontrado.</td></tr>`;
      return;
    }

    tableBody.innerHTML = logs.map(l => {
      const actionBadge = 
        l.action.includes('login') ? 'bg-primary' :
        l.action.includes('issued') ? 'bg-success' :
        l.action.includes('revoked') ? 'bg-danger' :
        l.action.includes('status') ? 'bg-warning text-dark' : 'bg-dark';

      const dateStr = l.created_at ? new Date(l.created_at).toLocaleString('pt-PT') : '-';

      return `
        <tr>
          <td class="font-monospace text-muted fw-bold">#${l.id}</td>
          <td><span class="badge ${actionBadge} small font-monospace">${escapeHtml(l.action)}</span></td>
          <td>
            <div class="fw-semibold text-dark">${escapeHtml(l.user_name || 'Sistema')}</div>
            <span class="text-muted small" style="font-size: 0.72rem;">${escapeHtml(l.user_email || '')}</span>
          </td>
          <td><span class="font-monospace small text-muted">${escapeHtml(l.ip_address || '-')}</span></td>
          <td class="small text-secondary" style="max-width: 320px;">${escapeHtml(l.details)}</td>
          <td class="text-muted small text-nowrap">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }
}

