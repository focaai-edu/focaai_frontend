import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './App';
import './index.css';

// Data router com uma rota curinga: as rotas continuam declaradas em <App />
// com <Routes>, e hooks como useBlocker (saída da aula ao vivo, #9) funcionam.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
