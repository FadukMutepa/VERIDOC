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
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': this.getCsrfToken(),
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

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
      return { success: false, error: 'Erro de conexão com o servidor.' };
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

  public async getAdminInstitutions(): Promise<{ success: boolean; institutions?: InstitutionItem[]; stats?: any; error?: string }> {
    try {
      const res = await fetch('/api/admin/institutions', { credentials: 'include' });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error };
      }

      return { success: true, institutions: data.institutions, stats: data.stats };
    } catch (e) {
      return { success: false, error: 'Erro ao buscar instituições.' };
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
}

export const authService = new AuthService();
