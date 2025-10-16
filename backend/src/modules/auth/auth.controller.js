import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "./auth.model.js";
import jwt from "jsonwebtoken";

const rolesPermitidos = ["estudiante", "profesor", "tecnico", "admin"];
function esRolValido(rol) {
  return rolesPermitidos.includes(String(rol).toLowerCase().trim());
}

const dominiosPorRol = {
  estudiante: /^[^@\s]+@estudiantec\.cr$/i,
  profesor:   /^[^@\s]+@itcr\.ac\.cr$/i,
  tecnico:    /^[^@\s]+@itcr\.ac\.cr$/i,
  admin:      /^[^@\s]+@tec\.ac\.cr$/i,
};

function validarEmailyRol(email, rol) {
    const rolVal = String(rol || "").toLowerCase().trim();
    if (!esRolValido(rolVal)) return false;

    const regla = dominiosPorRol[rolVal];
    const emailVal = String(email || "").trim();

    return regla.test(emailVal);
};



function isNumeric(codigo) {
  return /^[0-9]+$/.test(String(codigo));
}

export async function registerUser(req, res, next) {

  try {
    let { nombre, correo, password, codigo, rol, carrera, telefono } = req.body || {};

    if (!nombre || !correo || !password || !codigo || !rol || !carrera || !telefono) {
      const e = new Error("Faltan campos: nombre, correo, password, codigo, rol, carrera o telefono.");
      e.status = 400;
      throw e;
    }

    correo = String(correo).toLowerCase().trim();
    rol = String(rol).toLowerCase().trim();
    nombre = String(nombre).trim();
    codigo = String(codigo).trim();
    carrera = String(carrera).trim();
    telefono = String(telefono).trim();
    

    if (!esRolValido(rol)) {
      const e = new Error("Rol inválido. Usa: estudiante | profesor | tecnico | admin.");
      e.status = 400;
      throw e;
    }

    if (!validarEmailyRol(correo, rol)) {
      const e = new Error( `Correo no coincide con el dominio institucional para ese rol. Rol: ${rol}.`);
      e.status = 400;
      throw e;
    }

    if (!isNumeric(codigo)) {
      const e = new Error("El código debe ser numérico.");
      e.status = 400;
      throw e;
    }
    
    if (!isNumeric(telefono)){
      const e = new Error("El teléfono debe ser numérico.");
      e.status = 400;
      throw e;
    }

    if( telefono.length !== 8){
      const e = new Error("El teléfono debe tener exactamente 8 dígitos (EJEMPLO: 88881234).");
      e.status = 400;
      throw e;
    }

    if (rol === "estudiante" && codigo.length !== 10) {
      const e = new Error("Para estudiantes el código debe tener exactamente 10 dígitos (EJEMPLO: 2024182540).");
      e.status = 400;
      throw e;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await createUser({
      nombre,
      correo,
      passwordHash,
      codigo,
      rol,
      carrera,
      telefono
    });

    return res.status(201).json({ user , message: "Usuario creado exitosamente."});

  } catch (err) {
    next(err);
  }
}

export async function loginUser(req, res, next) {
  try {
    let { correo, password } = req.body || {};
    correo = String(correo || "").toLowerCase().trim();
    password = String(password || "");

    if (!correo || !password) {
      const e = new Error("Faltan campos: correo y password.");
      e.status = 400; 
      throw e;
    }

    const usuario = await getUserByEmail(correo);
    if (!usuario) { 
      const e = new Error("Credenciales inválidas."); 
      e.status = 401; 
      throw e; 
    }
    if (!usuario.activo) { 
      const e = new Error("Usuario inactivo. Contacte al administrador."); 
      e.status = 403; 
      throw e; 
    }

    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) { 
      const e = new Error("Credenciales inválidas."); 
      e.status = 401; 
      throw e; 
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "15m";
    const token = jwt.sign(
      { email: usuario.correo, rol: usuario.rol, nombre: usuario.nombre },
      process.env.JWT_SECRET,
      { subject: usuario.id, expiresIn }
    );

    const { password_hash, ...safe } = usuario;

    return res.json({
      token,                     
      token_type: "Bearer",
      expires_in: expiresIn,
      user: safe,
      message: "Login exitoso."
    });

  } catch (err) { next(err); }
}

export async function meUser(req, res, _next) {

  return res.json({ me: req.user });
}

export async function logoutUser(_req, res, _next) {
  res.status(204).end();
}

