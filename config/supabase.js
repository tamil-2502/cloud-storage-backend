const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Secret key loaded:", !!supabaseSecretKey);

if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("Supabase environment variables are missing");
}

const supabase = createClient(
    supabaseUrl,
    supabaseSecretKey
);

module.exports = supabase;