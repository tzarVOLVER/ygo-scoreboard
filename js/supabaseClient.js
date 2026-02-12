import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://rnwnfhvwpvyjqhosmcta.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJud25maHZ3cHZ5anFob3NtY3RhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4NDY1OTcsImV4cCI6MjA4NjQyMjU5N30.2siuZaTkcGc5f8xdd4XB_i5cVNVUmKdSLpgPT6rd7QM";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
