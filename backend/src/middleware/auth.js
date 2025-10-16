import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const auth = req.headers["authorization"] || "";
  const [scheme, token] = auth.split(" ");

  if (scheme !== "Bearer" || !token) {
    const e = new Error("No autenticado.");
    e.status = 401;
    return next(e);
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      nombre: payload.nombre
    };
    next();
  } catch (err) {
    err.status = 401;
    next(err);
  }
}

export function requireRole(roles = []) {
  const allow = roles.map((r) => String(r).toLowerCase());
  return (req, _res, next) => {
    const rol = String(req?.user?.rol || "").toLowerCase();
    if (!allow.includes(rol)) {
      const e = new Error("No autorizado.");
      e.status = 403;
      return next(e);
    }
    next();
  };
}
