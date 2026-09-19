import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { useApi } from "./use-api";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { request } = useApi();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile();
      } else {
        setIsLoading(false);
      }
    });

    // Listen for changes on auth state (sign in, sign out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile();
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile() {
    const { data } = await request<any>("/me/user");
    if (data) {
      setUser(data);
    }
    setIsLoading(false);
  }

  const signIn = async ({ email }: { email: string }) => {
    return await supabase.auth.signInWithOtp({ email });
  };

  const verifyOtp = async ({ email, token }: { email: string; token: string }) => {
    return await supabase.auth.verifyOtp({ email, token, type: 'email' });
  };

  const signInAnonymous = async () => {
    // Supabase supports anonymous sign-ins if enabled in the dashboard
    return await supabase.auth.signInAnonymously();
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  return {
    isLoading,
    isAuthenticated: !!session,
    user,
    signIn,
    verifyOtp,
    signInAnonymous,
    signOut,
  };
}
