import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PrivateRoute } from '@/components/auth/PrivateRoute';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { NotesPage } from '@/pages/notes/NotesPage';
import { NoteEditorPage } from '@/pages/notes/NoteEditorPage';
import { SearchPage } from '@/pages/search/SearchPage';

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
      { path: '/notes', element: <NotesPage /> },
      { path: '/notes/new', element: <NoteEditorPage /> },
      { path: '/notes/:id', element: <NoteEditorPage /> },
      { path: '/search', element: <SearchPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
