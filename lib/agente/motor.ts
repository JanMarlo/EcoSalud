// Motor de inferencia: encadenamiento hacia adelante sobre la base de conocimiento.
import baseJson from "./reglas.json";
import { nombreSintoma, normalizar } from "./normalizar";
import {
  Alerta,
  BaseConocimiento,
  Condicion,
  CondicionHoja,
  ConsultaRegistro,
  Evaluacion,
  Evidencia,
  Hechos,
  NombreHecho,
  Prioridad,
  PrioridadFinal,
  Regla,
  ReglaNoEvaluada,
} from "./tipos";

export const BASE: BaseConocimiento = baseJson as BaseConocimiento;

const PESO: Record<PrioridadFinal, number> = { ninguna: 0, baja: 1, media: 2, alta: 3 };
const ORDEN_GRUPO = { signos_vitales: 0, combinacion_sintomas: 1, historial: 2 } as const;

const ETIQUETA: Record<NombreHecho, { dato: string; unidad?: string; faltante: string }> = {
  temperatura: { dato: "Temperatura", unidad: "°C", faltante: "falta la temperatura" },
  sistolica: { dato: "Presión sistólica", unidad: "mmHg", faltante: "falta la presión arterial" },
  diastolica: { dato: "Presión diastólica", unidad: "mmHg", faltante: "falta la presión arterial" },
  imc: { dato: "IMC", unidad: "kg/m²", faltante: "falta el peso o la altura" },
  edadMeses: { dato: "Edad", unidad: "meses", faltante: "falta la edad" },
  sintomas: { dato: "Síntomas", faltante: "no hay síntomas registrados" },
  sintomasRecurrentes: { dato: "Síntomas recurrentes (90 días)", faltante: "no hay consultas anteriores" },
  fiebrePersistente: { dato: "Fiebre en la consulta anterior", faltante: "no hay consultas anteriores" },
  variacionPesoPct: { dato: "Variación de peso", unidad: "%", faltante: "no hay un peso anterior en 180 días" },
  presionElevadaAnterior: { dato: "Presión elevada en la consulta anterior", faltante: "no hay presión anterior registrada" },
};

/** Resultado de tres valores: verdadero, falso o desconocido (dato faltante). */
type Tri = { valor: boolean | null; evidencia: Evidencia[]; faltantes: string[] };

const fmt = (n: number, unidad?: string) => `${n}${unidad ? ` ${unidad}` : ""}`;

function evaluarHoja(h: CondicionHoja, hechos: Hechos): Tri {
  const v = hechos[h.hecho];
  const et = ETIQUETA[h.hecho];
  if (v === null || v === undefined) {
    return { valor: null, evidencia: [], faltantes: [et.faltante] };
  }

  let ok = false;
  let evidencia: Evidencia | null = null;

  switch (h.operador) {
    case ">=": {
      ok = (v as number) >= (h.valor as number);
      evidencia = { dato: et.dato, valor: fmt(v as number, et.unidad), umbral: `≥ ${fmt(h.valor as number, et.unidad)}` };
      break;
    }
    case "<": {
      ok = (v as number) < (h.valor as number);
      evidencia = { dato: et.dato, valor: fmt(v as number, et.unidad), umbral: `< ${fmt(h.valor as number, et.unidad)}` };
      break;
    }
    case "entre": {
      const [a, b] = h.valor as [number, number];
      ok = (v as number) >= a && (v as number) < b;
      evidencia = { dato: et.dato, valor: fmt(v as number, et.unidad), umbral: `${a}–${b} ${et.unidad ?? ""}`.trim() };
      break;
    }
    case "==": {
      ok = v === h.valor;
      evidencia = { dato: et.dato, valor: v === true ? "Sí" : v === false ? "No" : String(v) };
      break;
    }
    case "contiene": {
      ok = (v as string[]).includes(h.valor as string);
      evidencia = { dato: et.dato, valor: nombreSintoma(h.valor as string) };
      break;
    }
    case "contieneAlguno": {
      const hallados = (h.valor as string[]).filter((s) => (v as string[]).includes(s));
      ok = hallados.length > 0;
      evidencia = { dato: et.dato, valor: hallados.map(nombreSintoma).join(", ") };
      break;
    }
    case "noVacio": {
      ok = Array.isArray(v) && v.length > 0;
      evidencia = { dato: et.dato, valor: (v as string[]).map(nombreSintoma).join(", ") };
      break;
    }
  }

  return { valor: ok, evidencia: ok && evidencia ? [evidencia] : [], faltantes: [] };
}

function evaluar(c: Condicion, hechos: Hechos, activas: Map<string, Alerta>): Tri {
  if ("regla" in c) {
    const a = activas.get(c.regla);
    return {
      valor: !!a,
      evidencia: a ? [{ dato: "Regla relacionada", valor: `${a.reglaId} ${a.nombre}` }] : [],
      faltantes: [],
    };
  }
  if ("hecho" in c) return evaluarHoja(c, hechos);

  const hijos = ("todas" in c ? c.todas : "cualquiera" in c ? c.cualquiera : c.ninguna).map((h) =>
    evaluar(h, hechos, activas),
  );
  const evidencia = hijos.flatMap((h) => (h.valor ? h.evidencia : []));
  const faltantes = hijos.flatMap((h) => h.faltantes);

  if ("todas" in c) {
    if (hijos.some((h) => h.valor === false)) return { valor: false, evidencia: [], faltantes: [] };
    if (hijos.some((h) => h.valor === null)) return { valor: null, evidencia: [], faltantes };
    return { valor: true, evidencia, faltantes: [] };
  }
  if ("cualquiera" in c) {
    if (hijos.some((h) => h.valor === true)) return { valor: true, evidencia, faltantes: [] };
    if (hijos.some((h) => h.valor === null)) return { valor: null, evidencia: [], faltantes };
    return { valor: false, evidencia: [], faltantes: [] };
  }
  // ninguna
  if (hijos.some((h) => h.valor === true)) return { valor: false, evidencia: [], faltantes: [] };
  if (hijos.some((h) => h.valor === null)) return { valor: null, evidencia: [], faltantes };
  return { valor: true, evidencia: [], faltantes: [] };
}

function aplicaPorEdad(r: Regla, edadMeses: number | null): boolean | null {
  if (!r.aplicaA) return true;
  if (edadMeses === null) return null;
  const { edadMinimaMeses, edadMaximaMeses } = r.aplicaA;
  if (edadMinimaMeses !== undefined && edadMeses < edadMinimaMeses) return false;
  if (edadMaximaMeses !== undefined && edadMeses > edadMaximaMeses) return false;
  return true;
}

export type ParametrosEvaluacion = {
  consulta: ConsultaRegistro;
  historial: ConsultaRegistro[];
  registroId: string | null;
  uid: string;
  ahoraMs?: number;
  base?: BaseConocimiento;
};

/** Ciclo de inferencia completo (sección 6 de la documentación). */
export function evaluarConsulta(p: ParametrosEvaluacion): Evaluacion {
  const base = p.base ?? BASE;
  const ahoraMs = p.ahoraMs ?? Date.now();
  const historial = p.historial.filter((c) => !c.id || c.id !== p.registroId);

  // 1. Normalizar y construir hechos.
  const { hechos, avisos } = normalizar(p.consulta, historial, ahoraMs);

  const activas = new Map<string, Alerta>();
  const noEvaluadas: ReglaNoEvaluada[] = [];
  let reglasEvaluadas = 0;

  // 3. Orden SV → CS → HS (las de historial pueden usar resultados previos).
  const reglas = [...base.reglas].sort((a, b) => ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo]);

  for (const r of reglas) {
    // 2. Filtrar por edad.
    const aplica = aplicaPorEdad(r, hechos.edadMeses);
    if (aplica === false) continue;
    if (aplica === null) {
      noEvaluadas.push({ reglaId: r.id, nombre: r.nombre, motivo: "falta la edad" });
      continue;
    }

    const res = evaluar(r.condicion, hechos, activas);
    if (res.valor === null) {
      noEvaluadas.push({
        reglaId: r.id,
        nombre: r.nombre,
        motivo: Array.from(new Set(res.faltantes)).join("; "),
      });
      continue;
    }
    reglasEvaluadas++;
    if (!res.valor) continue;

    activas.set(r.id, {
      reglaId: r.id,
      nombre: r.nombre,
      grupo: r.grupo,
      prioridad: r.prioridad,
      mensaje: r.mensaje,
      evidencia: res.evidencia,
      recomendacion: r.recomendacion,
      seguimientoDias: r.seguimientoDias ?? null,
      estado: "pendiente",
      revisadoPor: null,
      revisadoEn: null,
      comentario: null,
    });
  }

  // 4. Supresión de alertas redundantes.
  const suprimidas = new Set<string>();
  for (const r of base.reglas) {
    if (activas.has(r.id)) (r.suprime ?? []).forEach((id) => suprimidas.add(id));
  }
  const alertas = Array.from(activas.values())
    .filter((a) => !suprimidas.has(a.reglaId))
    .sort((a, b) => PESO[b.prioridad] - PESO[a.prioridad] || ORDEN_GRUPO[a.grupo] - ORDEN_GRUPO[b.grupo]);

  // 5. Prioridad final = la más alta de las reglas activadas.
  const prioridad: PrioridadFinal = alertas.reduce<PrioridadFinal>(
    (max, a) => (PESO[a.prioridad] > PESO[max] ? a.prioridad : max),
    "ninguna",
  );

  return {
    registroId: p.registroId,
    pacienteId: p.consulta.pacienteId ?? null,
    nombrePaciente: p.consulta.nombre ?? "",
    uid: p.uid,
    prioridad,
    alertas,
    noEvaluadas,
    avisos,
    reglasEvaluadas,
    versionBase: base.version,
    creadaEnMs: ahoraMs,
  };
}

export const pesoPrioridad = (p: PrioridadFinal | Prioridad) => PESO[p];
