// Trage hier die Angaben aus deinem Supabase-Projekt ein (Project Settings → API).
// Der "anon public"-Schlüssel darf öffentlich sein: Die Datenbank-Regeln aus datenbank.sql
// sorgen dafür, dass jedes Konto nur seine eigenen Listen sieht.
window.VOCI_CONFIG = {
  supabaseUrl: "",      // z. B. "https://abcdefghijkl.supabase.co"
  supabaseAnonKey: ""   // z. B. "eyJhbGciOi..." oder "sb_publishable_..."
};
