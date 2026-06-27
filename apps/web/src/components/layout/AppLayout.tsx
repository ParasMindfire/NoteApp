import { Outlet } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { NavigationSetter } from '@/components/auth/NavigationSetter';

export function AppLayout() {
  return (
    <>
      <NavigationSetter />
      <AppHeader />
      <main className="flex-1">
        <Outlet />
      </main>
    </>
  );
}
