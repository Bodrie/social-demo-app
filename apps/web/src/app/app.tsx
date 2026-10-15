import { RouterProvider } from 'react-router/dom';
import { createAppRouter } from './router';
import { Providers } from './providers';

const router = createAppRouter();

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
