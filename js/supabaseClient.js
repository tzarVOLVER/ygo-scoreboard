import { createClient } from "https://esm.sh/@supabase/supabase-js";

const SUPABASE_URL = "https://vzbwhvamfqkodiogwdww.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6YndodmFtZnFrb2Rpb2d3ZHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjI0NjM2NjgsImV4cCI6MjAzODAzOTY2OH0.ExqIbsojI2KKuA8kuu7hbIfBrSgDLLxJK1LrF_AlIfE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
