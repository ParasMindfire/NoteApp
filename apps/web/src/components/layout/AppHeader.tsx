import { useNavigate, useLocation } from 'react-router-dom';
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
      <span className="font-semibold text-foreground">NoteApp</span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </header>
  );
}
