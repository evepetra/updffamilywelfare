import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "family" | "soldier" | "officer" | "admin" | "system_admin";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: {
    full_name: string | null;
    service_number: string | null;
    service: string | null;
    rank: string | null;
    region: string | null;
    nin: string | null;
  } | null;
  roles: Role[];
  isFamily: boolean;
  isSoldier: boolean;
  isOfficer: boolean;
  isAdmin: boolean;
  isSystemAdmin: boolean;
  isStaff: boolean;
  isBeneficiary: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(redirectIfUnauthed = true): AuthState {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadExtras = async (uid: string) => {
      const [{ data: prof }, { data: rs }] = await Promise.all([
        supabase
          .from("profiles")
        .select("full_name, service_number, service, rank, region, nin")
          .eq("id", uid)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      if (!active) return;
      setProfile(prof ?? null);
      setRoles(((rs ?? []) as { role: Role }[]).map((r) => r.role));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        setTimeout(() => loadExtras(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        loadExtras(data.session.user.id).finally(() => active && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !session && redirectIfUnauthed) {
      navigate({ to: "/login" });
    }
  }, [loading, session, redirectIfUnauthed, navigate]);

  return {
    loading,
    session,
    user: session?.user ?? null,
    profile,
    roles,
    isFamily: roles.includes("family"),
    isSoldier: roles.includes("soldier"),
    isOfficer: roles.includes("officer"),
    isAdmin: roles.includes("admin"),
    isSystemAdmin: roles.includes("system_admin"),
    isStaff:
      roles.includes("officer") ||
      roles.includes("admin") ||
      roles.includes("system_admin"),
    isBeneficiary: roles.includes("family") || roles.includes("soldier"),
    signOut: async () => {
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    },
  };
}