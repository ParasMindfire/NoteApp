import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PrivateRoute } from '@/components/auth/PrivateRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/notes" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      { path: '/notes', element: <div>Coming soon</div> },
      { path: '/notes/new', element: <div>Coming soon</div> },
      { path: '/notes/:id', element: <div>Coming soon</div> },
      { path: '/search', element: <div>Coming soon</div> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
