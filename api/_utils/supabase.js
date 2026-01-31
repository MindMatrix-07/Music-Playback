import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Error: Supabase credentials missing from .env');
    // Don't crash in dev, but warn
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
