import React from "react";
import { supabase } from "./supabaseClient";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error(error);
        setError("Fehler beim Abrufen der Session");
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      console.error(error);
      setError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return <div className="p-6">Prüfe Anmeldung …</div>;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <form
          onSubmit={handleLogin}
          className="bg-white shadow-md rounded-lg p-6 w-full max-w-sm space-y-4"
        >
          <h1 className="text-lg font-semibold text-center">
            Work Request Planner – Login
          </h1>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-sm font-medium">E-Mail</label>
            <input
              type="email"
              className="border rounded px-2 py-1 w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Passwort</label>
            <input
              type="password"
              className="border rounded px-2 py-1 w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 text-white py-2 text-sm font-medium"
          >
            Anmelden
          </button>
        </form>
      </div>
    );
  }

  // Angemeldet → App anzeigen + Logout-Button
  return (
    <>
      {children}
    </>
  );
}
