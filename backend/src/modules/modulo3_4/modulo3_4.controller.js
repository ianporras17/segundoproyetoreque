import { getMyUsage } from "./modulo3_4.model.js";
import ExcelJS from "exceljs";

/** GET /history/my-usage */
export async function myUsageCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, tipo } = req.query;
    const data = await getMyUsage({ userId, from, to, tipo });
    res.json(data);
  } catch (e) { next(e); }
}

/** GET /history/my-usage.xlsx */
export async function myUsageXlsxCtrl(req, res, next) {
  try {
    const userId = req.user.id;
    const { from, to, tipo } = req.query;
    const data = await getMyUsage({ userId, from, to, tipo });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Historial");

    ws.columns = [
      { header: "Solicitud", key: "solicitud_id", width: 36 },
      { header: "Evento",    key: "tipo_evento",   width: 22 },
      { header: "Fecha/Hora",key: "ts",            width: 24 },
      { header: "Estado",    key: "estado",        width: 16 },
      { header: "Laboratorio", key: "lab",         width: 28 },
      { header: "Recurso",     key: "recurso",     width: 32 }
    ];

    data.forEach(r => ws.addRow({
      solicitud_id: r.solicitud_id,
      tipo_evento : r.tipo_evento,
      ts          : r.ts,
      estado      : r.estado,
      lab         : `${r.laboratorio?.nombre ?? ""} (${r.laboratorio?.id ?? ""})`,
      recurso     : `${r.recurso?.nombre ?? ""} (${r.recurso?.id ?? ""})`,
    }));

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="historial-uso.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (e) { next(e); }
}
