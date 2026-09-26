import { renderNavbar } from './components/navbar';
import { renderFooter } from './components/footer';
import { renderHomePage } from './views/home';
import { renderVerifyPage, buildVerificationResultHtml } from './views/verify';
import { renderLoginPage } from './views/login';
import { renderRegisterPage } from './views/register';
import { renderDashboardPage } from './views/dashboard';
import { renderDocumentCreatePage } from './views/document_create';
import { renderDocumentListPage } from './views/document_list';
import { authService, DocumentItem } from './services/auth';

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

    if (basePath === '' || basePath === '/') {
      this.currentPath = '/';
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
    const isDashboard = this.currentPath.includes('/instituicao/');

    switch (this.currentPath) {
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

    // 7. Dashboard (/instituicao/dashboard)
    if (this.currentPath === '/instituicao/dashboard') {
      this.loadDashboardData();
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

      return `
        <tr>
          <td class="ps-4">
            <span class="font-monospace fw-bold text-primary">${doc.verification_code}</span>
          </td>
          <td>
            <div class="fw-bold text-dark">${doc.holder_name}</div>
            <div class="text-muted small">${doc.course || 'Geral'}</div>
          </td>
          <td><span class="badge bg-light text-dark border">${doc.document_type}</span></td>
          <td class="text-muted">${dateStr}</td>
          <td>${statusBadge}</td>
          <td class="text-end pe-4">
            <div class="btn-group btn-group-sm">
              <!-- Visualizar -->
              <button class="btn btn-outline-primary btn-action-view" data-id="${doc.id}" title="Visualizar Detalhes e QR Code">
                <i class="bi bi-eye"></i>
              </button>
              <!-- Verificar -->
              <a href="/verificar?code=${encodeURIComponent(doc.verification_code)}" data-route="/verificar?code=${encodeURIComponent(doc.verification_code)}" class="btn btn-outline-info" title="Validar na Plataforma">
                <i class="bi bi-shield-check"></i>
              </a>
              <!-- Revogar -->
              ${doc.status !== 'revoked' ? `
                <button class="btn btn-outline-danger btn-action-revoke" data-id="${doc.id}" data-code="${doc.verification_code}" data-holder="${doc.holder_name}" title="Revogar Documento">
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

    modalBody.innerHTML = `
      <div class="bg-white p-4 rounded-4 border border-light-subtle shadow-sm mb-4">
        <div class="row align-items-center g-4">
          <div class="col-md-8">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="font-monospace fw-bold fs-4 text-primary">${doc.verification_code}</span>
              ${statusBadge}
            </div>
            <h4 class="fw-bold text-dark mb-1">${doc.holder_name}</h4>
            <div class="text-secondary small mb-3">${doc.course} ${doc.area ? `· ${doc.area}` : ''}</div>

            <div class="row g-2 small border-top pt-3">
              <div class="col-6">
                <span class="text-muted d-block">Entidade Emissora:</span>
                <strong>${doc.institution_name || 'Instituição Homologada'}</strong>
              </div>
              <div class="col-6">
                <span class="text-muted d-block">Tipo de Documento:</span>
                <strong>${doc.document_type}</strong>
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
                <strong>Descrição:</strong> ${doc.description}
              </div>
            ` : ''}

            <div class="mt-3 p-2 bg-dark text-secondary rounded font-monospace small text-break" style="font-size: 0.68rem;">
              <span class="text-white">Hash Criptográfico SHA-256:</span><br>
              <span class="text-info">${doc.hash}</span>
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
              <span class="badge ${h.action === 'created' ? 'bg-success' : 'bg-danger'} text-uppercase" style="font-size: 0.68rem; height: fit-content;">
                ${h.action}
              </span>
              <div class="flex-grow-1">
                <div class="text-dark fw-semibold">${h.description}</div>
                <div class="text-muted" style="font-size: 0.72rem;">
                  Operador: ${h.user_name || 'Sistema'} · ${new Date(h.created_at).toLocaleString('pt-PT')}
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
      }
    }
  }

  private async loadAdminInstitutions(): Promise<void> {
    const tableBody = document.getElementById('adminInstitutionsTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">A consultar base de dados...</td></tr>`;

    const res = await authService.getAdminInstitutions();
    if (!res.success || !res.institutions) {
      tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">Falha ao buscar instituições: ${res.error}</td></tr>`;
      return;
    }

    tableBody.innerHTML = res.institutions.map(inst => {
      const statusBadge = 
        inst.status === 'approved' ? '<span class="badge bg-success px-2 py-1">APPROVED</span>' :
        inst.status === 'pending' ? '<span class="badge bg-warning text-dark px-2 py-1">PENDING</span>' :
        '<span class="badge bg-danger px-2 py-1">SUSPENDED</span>';

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
                <button class="btn btn-sm btn-success btn-action-status" data-id="${inst.id}" data-status="approved">
                  <i class="bi bi-check-lg me-1"></i> Aprovar
                </button>
              ` : ''}
              ${inst.status !== 'suspended' ? `
                <button class="btn btn-sm btn-outline-danger btn-action-status" data-id="${inst.id}" data-status="suspended">
                  <i class="bi bi-slash-circle me-1"></i> Suspender
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-action-status').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = (e.currentTarget as HTMLElement);
        const instId = Number(target.getAttribute('data-id'));
        const newStatus = target.getAttribute('data-status') || 'approved';

        target.setAttribute('disabled', 'true');
        await authService.updateInstitutionStatus(instId, newStatus);
        await this.loadAdminInstitutions();
        await this.updateAdminPendingBadge();
      });
    });
  }
}
