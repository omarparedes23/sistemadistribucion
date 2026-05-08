import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Supabase client is not configured with DB types — join-query results
      // require explicit casts in server components. Downgraded to warn until
      // the typed Supabase client (with database.types.ts) is wired up.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
