/** Column types that work on both SQLite (sql.js, for local use and tests) and PostgreSQL (production). */
export const IS_PG = (process.env.DB_TYPE ?? "sqljs") === "postgres";
export const DATE_COL = IS_PG ? "timestamptz" : "datetime";
