import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useState, useEffect, useCallback } from "react";
import { useApi } from "./use-api";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { request } = useApi();

  const fetchProfile = useCallback(async () => {
    try {
      const { data, error } = await request<any>("/me/user");
      if (error) {
        console.error("Profile fetch error:", error);
        setUser(null);
      } else {
        setUser(data);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile();
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
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
  }, [fetchProfile]);

  const signIn = async ({ email }: { email: string }) => {
    if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
    return await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/start"
      }
    });
  };

  const signUp = async ({ email, password, name, tosAccepted, marketingAccepted }: any) => {
    if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, tos_accepted: tosAccepted, marketing_accepted: marketingAccepted },
        emailRedirectTo: window.location.origin + "/start"
      }
    });
  };

  const signInWithPassword = async ({ email, password }: any) => {
    if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const verifyOtp = async ({ email, token }: { email: string; token: string }) => {
    if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
    return await supabase.auth.verifyOtp({ email, token, type: 'email' });
  };

  const signInAnonymous = async () => {
    if (!isSupabaseConfigured) throw new Error("Supabase no está configurado");
    return await supabase.auth.signInAnonymously();
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  return {
    isLoading,
    isAuthenticated: !!session,
    user,
    session,
    signIn,
    signUp,
    signInWithPassword,
    verifyOtp,
    signInAnonymous,
    signOut,
    isConfigured: isSupabaseConfigured
  };
}
