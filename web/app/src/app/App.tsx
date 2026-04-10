import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppRouterProvider } from './router';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouterProvider />
    </QueryClientProvider>
  );
}
