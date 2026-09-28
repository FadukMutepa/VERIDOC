/**
 * VeriDoc - Serviço de Autenticação e API
 * Comunicação com o backend MySQL / Express / Laravel
 */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'institution_admin' | 'institution_operator';
  institutionId: number | null;
  institutionName?: string;
  institutionStatus?: 'pending' | 'approved' | 'suspended' | 'rejected';
  institutionType?: string;
}

export interface DashboardStats {
  total_documents: number;
  valid_documents: number;
  revoked_documents: number;
  total_verifications: number;
}

export interface InstitutionItem {
  id: number;
  name: string;
  type: string;
  country: string;
  city: string;
  email: string;
  phone: string;
  responsible_name: string;
  responsible_email: string;
  status: 'pending' | 'approved' | 'suspended' | 'rejected';
  total_documents: number;
  total_users: number;
  created_at: string;
}

export interface DocumentItem {
  id: number;
  institution_id: number;
  holder_name: string;
  document_type: string;
  course: string;
  area?: string;
  issue_date: string;
  expiry_date?: string;
  description?: string;
  observations?: string;
  verification_code: string;
  hash: string;
  qr_code?: string;
  status: 'valid' | 'revoked' | 'expired';
  institution_name?: string;
  verification_count?: number;
  created_at: string;
}

export interface DocumentHistoryItem {
  id: number;
  document_id: number;
  user_id: number;
  action: string;
  description: string;
  created_at: string;
  user_name?: string;
}

export interface AdminStats {
  institutions: {
    total: number;
    pending: number;
    approved: number;
    suspended: number;
    rejected: number;
  };
  documents: {
    total: number;
    valid: number;
    revoked: number;
    expired: number;
  };
  verifications: {
    total: number;
    valid: number;
    revoked: number;
    expired: number;
    not_found: number;
    tampered: number;
  };
  recent_institutions?: any[];
  recent_documents?: any[];
  recent_verifications?: any[];
  recent_logs?: any[];
}

export interface VerificationItem {
  id: number;
  document_id?: number;
  verification_code: string;
  result: 'valid' | 'revoked' | 'expired' | 'not_found' | 'tampered';
  ip_address: string;
  user_agent?: string;
  verified_at: string;
  holder_name?: string;
  document_type?: string;
  course?: string;
  institution_name?: string;
}

export interface AuditLogItem {
  id: number;
  user_id?: number;
  action: string;
  ip_address: string;
  details: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  institution_name?: string;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private csrfToken: string | null = null;
  private initialized: boolean = false;

  public async init(): Promise<AuthUser | null> {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        this.csrfToken = data.csrfToken;
      }
    } catch (e) {
      console.error('Falha ao obter sessão:', e);
    }
    this.initialized = true;
    return this.currentUser;
  }

  public getUser(): AuthUser | null {
    return this.currentUser;
  }

  public isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  public isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }

  public getCsrfToken(): string {
    return this.csrfToken || '';
  }

  public async login(email: string, password: string): Promise<{ success: boolean; message?: string; user?: AuthUser; error?: string; status?: string }> {
    try {
      if (!this.csrfToken) {
        await this.init();
      }

      let res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      let data: any;
      try {
        data = await res.json();
      } catch (parseErr) {
        data = { error: 'O servidor retornou uma resposta inesperada.' };
      }

      // Se falhou por token CSRF ausente ou inválido, renova o token e repete a tentativa uma vez
      if (res.status === 403 && (data.error?.includes('CSRF') || data.error?.includes('Token'))) {
        await this.init();
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': this.getCsrfToken(),
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        });
        try {
          data = await res.json();
        } catch {
          data = { error: 'Falha na autenticação após renovação da sessão.' };
        }
      }

      if (!res.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Falha na autenticação.',
          status: data.status,
        };
      }

      this.currentUser = data.user;
      return { success: true, user: data.user, message: data.message };
    } catch (e: any) {
      console.error('Login error:', e);
      return { success: false, error: e.message || 'Erro de conexão com o servidor.' };
    }
  }

  public async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'x-csrf-token': this.getCsrfToken(),
        },
        credentials: 'include',
      });
    } finally {
      this.currentUser = null;
    }
  }

  public async registerInstitution(formData: Record<string, any>): Promise<{ success: boolean; message?: string; error?: string; status?: string }> {
    try {
      const res = await fetch('/api/auth/register-institution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao submeter registo institucional.' };
      }

      return { success: true, message: data.message, status: data.status };
    } catch (e) {
      return { success: false, error: 'Falha na comunicação com o servidor.' };
    }
  }

  public async forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const data = await res.json();
      return { success: true, message: data.message };
    } catch (e) {
      return { success: false, error: 'Erro ao solicitar recuperação de senha.' };
    }
  }

  public async getDashboardStats(institutionId?: number): Promise<{ success: boolean; data?: any; error?: string; status?: string }> {
    try {
      const url = institutionId ? `/api/dashboard/stats?institution_id=${institutionId}` : '/api/dashboard/stats';
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.message || data.error, status: data.status };
      }

      return { success: true, data };
    } catch (e) {
      return { success: false, error: 'Erro ao carregar dados do dashboard.' };
    }
  }

  public async getAdminStats(): Promise<{ success: boolean; stats?: AdminStats; error?: string }> {
    try {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao carregar estatísticas.' };
      }
      return { success: true, stats: data };
    } catch (e) {
      return { success: false, error: 'Erro de conexão ao buscar estatísticas do admin.' };
    }
  }

  public async getAdminInstitutions(search?: string, status?: string): Promise<{ success: boolean; institutions?: InstitutionItem[]; stats?: any; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status && status !== 'all') params.append('status', status);

      const url = params.toString() ? `/api/admin/institutions?${params.toString()}` : '/api/admin/institutions';
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, institutions: data.institutions, stats: data.stats };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar instituições.' };
    }
  }

  public async getAdminInstitution(id: number): Promise<{ success: boolean; institution?: InstitutionItem; users?: any[]; recent_documents?: any[]; error?: string }> {
    try {
      const res = await fetch(`/api/admin/institutions/${id}`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao buscar instituição.' };
      }

      return { success: true, institution: data.institution, users: data.users, recent_documents: data.recent_documents };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar detalhes da instituição.' };
    }
  }

  public async getAdminDocuments(search?: string, status?: string, institutionId?: number | string): Promise<{ success: boolean; documents?: DocumentItem[]; count?: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status && status !== 'all') params.append('status', status);
      if (institutionId && institutionId !== 'all') params.append('institution_id', String(institutionId));

      const url = `/api/admin/documents?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao carregar documentos.' };
      }

      return { success: true, documents: data.documents, count: data.count };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar documentos administrativos.' };
    }
  }

  public async getAdminVerifications(search?: string, result?: string): Promise<{ success: boolean; verifications?: VerificationItem[]; count?: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (result && result !== 'all') params.append('result', result);

      const url = `/api/admin/verifications?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao carregar verificações.' };
      }

      return { success: true, verifications: data.verifications, count: data.count };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar verificações.' };
    }
  }

  public async getAdminLogs(action?: string, search?: string): Promise<{ success: boolean; logs?: AuditLogItem[]; count?: number; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (action && action !== 'all') params.append('action', action);
      if (search) params.append('search', search);

      const url = `/api/admin/logs?${params.toString()}`;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao carregar logs.' };
      }

      return { success: true, logs: data.logs, count: data.count };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar logs de auditoria.' };
    }
  }

  public async updateInstitutionStatus(id: number, status: string, reason?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/admin/institutions/${id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify({ status, reason }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, message: data.message };
    } catch (e) {
      return { success: false, error: 'Erro ao atualizar estado da instituição.' };
    }
  }

  public async createDocument(formData: Record<string, any>): Promise<{ success: boolean; message?: string; document?: DocumentItem; error?: string }> {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao emitir documento.' };
      }

      return { success: true, message: data.message, document: data.document };
    } catch (e) {
      return { success: false, error: 'Falha na comunicação com o servidor ao emitir documento.' };
    }
  }

  public async getDocuments(params?: { status?: string; search?: string; institution_id?: number }): Promise<{ success: boolean; documents?: DocumentItem[]; error?: string }> {
    try {
      const query = new URLSearchParams();
      if (params?.status) query.append('status', params.status);
      if (params?.search) query.append('search', params.search);
      if (params?.institution_id) query.append('institution_id', params.institution_id.toString());

      const res = await fetch(`/api/documents?${query.toString()}`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao buscar documentos.' };
      }

      return { success: true, documents: data.documents };
    } catch (e) {
      return { success: false, error: 'Erro ao conectar ao servidor para listar documentos.' };
    }
  }

  public async getDocument(id: number): Promise<{ success: boolean; document?: DocumentItem; history?: DocumentHistoryItem[]; verifications?: any[]; error?: string }> {
    try {
      const res = await fetch(`/api/documents/${id}`, { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao carregar detalhes do documento.' };
      }

      return { success: true, document: data.document, history: data.history, verifications: data.verifications };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar dados do documento.' };
    }
  }

  public async revokeDocument(id: number, reason: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/documents/${id}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify({ reason }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Erro ao revogar documento.' };
      }

      return { success: true, message: data.message };
    } catch (e) {
      return { success: false, error: 'Erro ao solicitar revogação do documento.' };
    }
  }

  public async verifyDocumentPublic(code: string): Promise<{ found: boolean; result?: string; document?: any; message?: string; error?: string }> {
    try {
      const res = await fetch(`/api/public/verify/${encodeURIComponent(code)}`);
      const data = await res.json();
      return data;
    } catch (e) {
      return { found: false, error: 'Erro ao consultar serviço de verificação pública.' };
    }
  }
}

export const authService = new AuthService();
