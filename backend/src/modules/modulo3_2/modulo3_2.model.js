// IMPORT: tu db/index.js NO exporta default. Debe exportar algo como { query } o { pool }.
// Aquí asumo que exporta { query }. Si exporta { pool }, ver nota al final.
import { pool } from "../../db/index.js";
const query = (text, params) => pool.query(text, params);


/** Tablas según tu SQL */
const TB = {
  LABS: "laboratorios",
  EQUIP: "equipos_fijos",
  HOR: "laboratorio_horarios",
  BLOQ: "laboratorio_bloqueos",
  POL: "requisitos",
  MANT: "mantenimientos",
  MANT_REC: "mantenimiento_recursos",
};

function like(term) { return `%${(term || "").trim().toLowerCase()}%`; }
function toTime(ts) { return ts; }          // "HH:mm"
function toDate(d) { return d; }            // "YYYY-MM-DD"

/** 3.2.1 — Búsqueda por criterios (lab, tipo recurso, ubicación, texto) */
export async function searchLabs({ q, tipo_recurso, ubicacion }) {
  const params = [];
  const where = [];

  if (q) {
    const p1 = params.push(like(q)); // retorna nueva length
    const p2 = params.push(like(q));
    // p1 es índice del primer push, p2 el segundo
    where.push(`(LOWER(l.nombre) LIKE $${p1} OR LOWER(l.descripcion) LIKE $${p2})`);
  }

  if (ubicacion) {
    const p = params.push(ubicacion);
    where.push(`l.ubicacion = $${p}`);
  }

  let joinEquip = "";
  let havingTipo = "";
  if (tipo_recurso) {
    const p = params.push(tipo_recurso);
    joinEquip = `JOIN equipos_fijos e ON e.laboratorio_id = l.id`;
    havingTipo = ` AND e.tipo = $${p}`;
  }

  const sql = `
    SELECT DISTINCT l.id, l.nombre, l.ubicacion, l.descripcion, l.codigo_interno
    FROM laboratorios l
    ${joinEquip}
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ${havingTipo}
    ORDER BY l.nombre ASC
    LIMIT 100
  `;
  const { rows } = await query(sql, params);
  return rows;
}


/** Verifica si el lab está abierto y sin bloqueo en el rango date+start..end */
export async function labIsOpenAndUnblocked({ labId, date, start, end }) {
  if (!date || !start || !end) return { open: true, blocked: false };

  const params1 = [];
  const pLab1 = params1.push(labId);
  const pDate1 = params1.push(date);
  const pStart1 = params1.push(start);
  const pEnd1 = params1.push(end);

  const sqlOpen = `
    SELECT 1
    FROM ${TB.HOR} h
    WHERE h.laboratorio_id = $${pLab1}
      AND EXTRACT(DOW FROM $${pDate1}::date) = h.dow
      AND $${pStart1}::time >= h.hora_inicio
      AND $${pEnd1}::time   <= h.hora_fin
    LIMIT 1
  `;
  const openQ = await query(sqlOpen, params1);
  const open = openQ.rowCount > 0;

  const params2 = [];
  const pLab2 = params2.push(labId);
  const pDate2 = params2.push(date);
  const pStart2 = params2.push(start);
  const pEnd2 = params2.push(end);

  const sqlBlock = `
    SELECT 1
    FROM ${TB.BLOQ} b
    WHERE b.laboratorio_id = $${pLab2}
      AND tstzrange(b.ts_inicio, b.ts_fin, '[)') &&
          tstzrange(($${pDate2}::date + $${pStart2}::time),
                    ($${pDate2}::date + $${pEnd2}::time), '[)')
    LIMIT 1
  `;
  const blockQ = await query(sqlBlock, params2);
  const blocked = blockQ.rowCount > 0;

  return { open, blocked };
}

/** 3.2.1 + 3.2.2 — Recursos del lab (filtros; solo disponibles) */
export async function listLabResources({ labId, date, start, end, tipo, onlyAvailable }) {
  const params = [];
  const where = [];

  const pLab = params.push(labId);
  where.push(`e.laboratorio_id = $${pLab}`);

  if (tipo && tipo.trim() !== "") {
    const pTipo = params.push(tipo.trim());
    where.push(`e.tipo = $${pTipo}`);
  }

  if (String(onlyAvailable) === "1" || onlyAvailable === true) {
    where.push(`e.estado_disp = 'disponible'`);
  }

  // Exclusión por choque de mantenimiento (solo si viene rango)
  let excludeMant = "";
  if (date && start && end) {
    const pDate = params.push(date);
    const pStart = params.push(start);
    const pEnd = params.push(end);

    excludeMant = `
      AND NOT EXISTS (
        SELECT 1
        FROM ${TB.MANT_REC} mr
        JOIN ${TB.MANT} m ON m.id = mr.mantenimiento_id
        WHERE mr.equipo_id = e.id
          AND tstzrange(m.programado_para, m.programado_para + INTERVAL '1 hour', '[)')
              && tstzrange(($${pDate}::date + $${pStart}::time),
                           ($${pDate}::date + $${pEnd}::time), '[)')
      )
    `;
  }

  const sql = `
    SELECT e.id, e.nombre, e.tipo, e.estado_disp, e.estado_operativo,
           e.cantidad_total, e.cantidad_disponible
    FROM ${TB.EQUIP} e
    WHERE ${where.join(" AND ")}
    ${excludeMant}
    ORDER BY e.nombre ASC
  `;

  const [{ open, blocked }, rowsQ] = await Promise.all([
    labIsOpenAndUnblocked({ labId, date, start, end }),
    query(sql, params),
  ]);

  return { labStatus: { open, blocked }, resources: rowsQ.rows };
}

/** 3.2.3 — Vista de disponibilidad (horarios + bloqueos) */
export async function getLabScheduleRange({ labId, from, to }) {
  const sqlH = `
    SELECT h.id, h.dow, h.hora_inicio, h.hora_fin, h.capacidad_maxima
    FROM ${TB.HOR} h
    WHERE h.laboratorio_id = $1
    ORDER BY h.dow, h.hora_inicio
  `;
  const sqlB = `
    SELECT b.id, b.ts_inicio, b.ts_fin, b.titulo, b.tipo, b.descripcion
    FROM ${TB.BLOQ} b
    WHERE b.laboratorio_id = $1
      AND tstzrange(b.ts_inicio, b.ts_fin, '[)') && tstzrange($2::date, $3::date + INTERVAL '1 day', '[)')
    ORDER BY b.ts_inicio
  `;
  const [H, B] = await Promise.all([
    query(sqlH, [labId]),
    query(sqlB, [labId, from, to]),
  ]);
  return { horarios: H.rows, bloqueos: B.rows };
}

/** 3.2.4 — Políticas/requisitos del laboratorio */
export async function getLabPolicies({ labId }) {
  const sql = `
    SELECT r.id, r.nombre, r.descripcion, r.tipo, r.obligatorio, r.vigente_desde, r.vigente_hasta
    FROM ${TB.POL} r
    WHERE r.laboratorio_id = $1
    ORDER BY r.obligatorio DESC, r.nombre
  `;
  const { rows } = await query(sql, [labId]);
  return rows;
}
