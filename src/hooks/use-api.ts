import { supabase } from '@/lib/supabase';
import { useState, useCallback } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api` : '');

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  isLoading: boolean;
};

export function useApi() {
  const [isLoading, setIsLoading] = useState(false);

  const request = useCallback(async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null }> => {
    if (!API_BASE_URL) {
      return { data: null, error: 'API URL not configured' };
    }
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const headers = new Headers(options.headers);
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Error ${response.status}`);
      }

      return { data: result as T, error: null };
    } catch (err: any) {
      console.error(`[API Request Error] ${path}:`, err);
      return { data: null, error: err.message || 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { request, isLoading };
}
