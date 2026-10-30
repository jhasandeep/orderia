// Tests use an in-memory database and fixed secrets.
process.env.DB_TYPE = "sqljs";
process.env.DB_LOCATION = "";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.APP_SECRET = "test-app-secret-for-encryption";
process.env.PUBLIC_WEB_URL = "http://localhost:3000";
process.env.TZ = "UTC";
