import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';
import { api } from '@/lib/api';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);

  if (AUTH_ROUTES.includes(location.pathname)) {
    return null;
  }

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Logout is idempotent — proceed even if request fails
    }
    clearAuth();
    queryClient.clear();
    navigate('/login');
  }

  return (
    <header className="border-b border-border bg-background px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/notes" className="font-semibold text-foreground">
          NoteApp
        </Link>
        <nav className="flex items-center gap-4">
          <span
            aria-disabled="true"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground cursor-not-allowed opacity-50 select-none"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Trash (Coming Soon)
          </span>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/notes/new">
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            New Note
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
