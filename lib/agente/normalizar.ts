// Normalización de datos de entrada (sección 5 de la documentación).
import { sintomasData } from "../catalogoSintomas";
import { ConsultaRegistro, Hechos } from "./tipos";

const DIA_MS = 24 * 60 * 60 * 1000;

/** Minúsculas, sin acentos, palabras unidas con "_" . */
export const slug = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** Nombres del catálogo que se abrevian y sinónimos de texto libre → código. */
const SINONIMOS: Record<string, string> = {
  dolor_en_el_pecho: "dolor_pecho",
  dolor_de_pecho: "dolor_pecho",
  dolor_toracico: "dolor_pecho",
  dolor_irradiado_a_brazo: "dolor_irradiado_brazo",
  dificultad_para_respirar: "dificultad_respirar",
  falta_de_aire: "dificultad_respirar",
  ahogo: "dificultad_respirar",
  calentura: "fiebre",
  temperatura_alta: "fiebre",
  vomito: "vomitos",
  desmayos: "desmayo",
  mareos: "mareo",
  convulsion: "convulsiones",
  diarreas: "diarrea",
};

const codigo = (texto: string) => {
  const s = slug(texto);
  return SINONIMOS[s] ?? s;
};

/** Códigos reconocidos = todo el catálogo + destinos de sinónimos. */
const CODIGOS_CATALOGO = new Set<string>([
  ...Object.values(sintomasData).flat().map(codigo),
  ...Object.values(SINONIMOS),
]);

/** Nombre legible de cada código (para mostrar evidencia). */
const NOMBRE_POR_CODIGO: Record<string, string> = {};
Object.values(sintomasData)
  .flat()
  .forEach((nombre) => {
    NOMBRE_POR_CODIGO[codigo(nombre)] = nombre;
  });

export const nombreSintoma = (cod: string) =>
  NOMBRE_POR_CODIGO[cod] ?? cod.replace(/_/g, " ");

export type SintomasNormalizados = {
  codigos: string[];
  noReconocidos: string[];
};

/** Regla 4 y 5: normaliza, separa texto libre por comas y elimina duplicados. */
export function normalizarSintomas(lista: string[] | undefined): SintomasNormalizados {
  const codigos = new Set<string>();
  const noReconocidos: string[] = [];

  (lista ?? [])
    .flatMap((s) => String(s).split(/[,;\n]/))
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((texto) => {
      const c = codigo(texto);
      if (CODIGOS_CATALOGO.has(c)) codigos.add(c);
      else noReconocidos.push(texto);
    });

  return { codigos: Array.from(codigos), noReconocidos };
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const redondear = (n: number, dec = 1) => Math.round(n * 10 ** dec) / 10 ** dec;

/** Regla 1: edad en meses. */
export function edadEnMeses(c: ConsultaRegistro): number | null {
  const edad = num(c.edad);
  if (edad === null) return null;
  return c.unidadEdad === "meses" ? Math.floor(edad) : Math.floor(edad * 12);
}

export function grupoEdad(meses: number | null) {
  if (meses === null) return "desconocido";
  if (meses < 24) return "lactante";
  if (meses < 216) return "pediátrico";
  if (meses < 780) return "adulto";
  return "adulto mayor";
}

/** Regla 2: "120/80" → sistólica y diastólica. */
export function separarPresion(presion: string | null | undefined) {
  const m = String(presion ?? "").trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
  if (!m) return { sistolica: null, diastolica: null, inconsistente: false };
  const sistolica = Number(m[1]);
  const diastolica = Number(m[2]);
  if (sistolica <= diastolica) {
    return { sistolica: null, diastolica: null, inconsistente: true };
  }
  return { sistolica, diastolica, inconsistente: false };
}

/** Regla 3: temperatura en °C (corrige °F) a 1 decimal. */
export function normalizarTemperatura(valor: unknown) {
  const t = num(valor);
  if (t === null) return { temperatura: null, corregida: false };
  if (t > 50) return { temperatura: redondear((t - 32) / 1.8), corregida: true };
  return { temperatura: redondear(t), corregida: false };
}

export function calcularImc(pesoKg: unknown, alturaCm: unknown): number | null {
  const p = num(pesoKg);
  const a = num(alturaCm);
  if (!p || !a) return null;
  const m = a / 100;
  return redondear(p / (m * m));
}

/** Convierte Timestamp de Firestore, Date o número a milisegundos. */
export function fechaMs(valor: any): number {
  if (!valor) return 0;
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  if (typeof valor.seconds === "number") return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();
  const n = new Date(valor).getTime();
  return Number.isFinite(n) ? n : 0;
}

export type ResultadoNormalizacion = {
  hechos: Hechos;
  avisos: string[];
};

/**
 * Construye los hechos del modelo interno a partir de la consulta actual
 * y del historial (consultas anteriores del mismo paciente).
 */
export function normalizar(
  actual: ConsultaRegistro,
  historialSinOrden: ConsultaRegistro[],
  ahoraMs: number,
): ResultadoNormalizacion {
  const avisos: string[] = [];

  const { temperatura, corregida } = normalizarTemperatura(actual.temperatura);
  if (corregida) avisos.push("La temperatura parecía estar en °F y se convirtió a °C.");

  const presion = separarPresion(actual.presion);
  if (presion.inconsistente) {
    avisos.push(`La presión "${actual.presion}" es inconsistente (sistólica ≤ diastólica); no se evaluó.`);
  }

  const sint = normalizarSintomas(actual.sintomas);
  if (sint.noReconocidos.length) {
    avisos.push(`Síntomas no reconocidos (no activan reglas): ${sint.noReconocidos.join(", ")}.`);
  }

  const edadMeses = edadEnMeses(actual);

  // Regla 7: historial ordenado de más reciente a más antiguo, sin consultas sin fecha.
  const historial = historialSinOrden
    .filter((c) => fechaMs(c.createdAt) > 0)
    .sort((a, b) => fechaMs(b.createdAt) - fechaMs(a.createdAt))
    .slice(0, 20);

  const anterior = historial[0];

  let sintomasRecurrentes: string[] | null = null;
  let fiebrePersistente: boolean | null = null;
  let variacionPesoPct: number | null = null;
  let presionElevadaAnterior: boolean | null = null;

  if (historial.length > 0) {
    // HS-01: mismo síntoma en ≥ 3 consultas (incluida la actual) en 90 días.
    const recientes = historial.filter((c) => ahoraMs - fechaMs(c.createdAt) <= 90 * DIA_MS);
    const conteo: Record<string, number> = {};
    [sint.codigos, ...recientes.map((c) => normalizarSintomas(c.sintomas).codigos)].forEach(
      (lista) => lista.forEach((s) => (conteo[s] = (conteo[s] ?? 0) + 1)),
    );
    sintomasRecurrentes = Object.keys(conteo).filter(
      (s) => conteo[s] >= 3 && sint.codigos.includes(s),
    );

    // HS-02: fiebre en la consulta anterior, con ≤ 7 días de diferencia.
    const tAnt = normalizarTemperatura(anterior.temperatura).temperatura;
    const dias = (ahoraMs - fechaMs(anterior.createdAt)) / DIA_MS;
    fiebrePersistente = tAnt !== null && tAnt >= 38 && dias <= 7;

    // HS-03: variación de peso contra la consulta anterior en ≤ 180 días.
    const pAct = num(actual.peso);
    const pAnt = num(anterior.peso);
    if (pAct !== null && pAnt && dias <= 180) {
      variacionPesoPct = redondear((Math.abs(pAct - pAnt) / pAnt) * 100);
    }

    // HS-04: presión elevada en la consulta anterior.
    const pa = separarPresion(anterior.presion);
    presionElevadaAnterior =
      pa.sistolica !== null && pa.diastolica !== null
        ? pa.sistolica >= 140 || pa.diastolica >= 90
        : null;
  }

  return {
    avisos,
    hechos: {
      temperatura,
      sistolica: presion.sistolica,
      diastolica: presion.diastolica,
      imc: calcularImc(actual.peso, actual.altura),
      edadMeses,
      sintomas: sint.codigos,
      sintomasRecurrentes,
      fiebrePersistente,
      variacionPesoPct,
      presionElevadaAnterior,
    },
  };
}
