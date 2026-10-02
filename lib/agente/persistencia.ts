// Lectura y escritura de evaluaciones en Firestore (colección `evaluaciones`).
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import { evaluarConsulta } from "./motor";
import { fechaMs } from "./normalizar";
import { Alerta, ConsultaRegistro, EstadoAlerta, Evaluacion } from "./tipos";

/**
 * Evaluaciones que no se pudieron guardar (sin conexión o reglas de Firestore).
 * Se muestran igual en pantalla; su id empieza con "local-".
 */
const cacheLocal = new Map<string, Evaluacion>();

export const esLocal = (id: string) => id.startsWith("local-");
export const obtenerLocal = (id: string) => cacheLocal.get(id) ?? null;

/** Consultas anteriores del paciente (sensor del historial). */
export async function obtenerHistorial(pacienteId: string): Promise<ConsultaRegistro[]> {
  const snap = await getDocs(query(collection(db, "registros"), where("pacienteId", "==", pacienteId)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ConsultaRegistro) }));
}

/** Evalúa una consulta, guarda el resultado y devuelve el id de la evaluación. */
export async function evaluarYGuardar(params: {
  consulta: ConsultaRegistro;
  registroId: string | null;
  uid: string;
  historial?: ConsultaRegistro[];
}): Promise<{ id: string; evaluacion: Evaluacion; guardada: boolean }> {
  let historial = params.historial;
  if (!historial) {
    try {
      historial = params.consulta.pacienteId ? await obtenerHistorial(params.consulta.pacienteId) : [];
    } catch {
      historial = [];
    }
  }

  // El registro actual puede aún no tener createdAt (serverTimestamp pendiente).
  const ahoraMs = fechaMs(params.consulta.createdAt) || Date.now();

  const evaluacion = evaluarConsulta({
    consulta: params.consulta,
    historial: historial.filter((c) => fechaMs(c.createdAt) < ahoraMs || !c.createdAt),
    registroId: params.registroId,
    uid: params.uid,
    ahoraMs,
  });

  try {
    const ref = await addDoc(collection(db, "evaluaciones"), {
      ...evaluacion,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, evaluacion: { ...evaluacion, id: ref.id }, guardada: true };
  } catch (e) {
    console.warn("No se pudo guardar la evaluación", e);
    const id = `local-${ahoraMs}`;
    cacheLocal.set(id, { ...evaluacion, id });
    return { id, evaluacion: { ...evaluacion, id }, guardada: false };
  }
}

/** Evaluaciones de un paciente, de la más reciente a la más antigua. */
export async function obtenerEvaluaciones(pacienteId: string): Promise<Evaluacion[]> {
  const snap = await getDocs(query(collection(db, "evaluaciones"), where("pacienteId", "==", pacienteId)));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Evaluacion) }))
    .sort((a, b) => (b.creadaEnMs ?? 0) - (a.creadaEnMs ?? 0));
}

/** RF-10: marca una alerta como revisada o descartada. */
export async function revisarAlerta(params: {
  evaluacionId: string;
  reglaId: string;
  estado: EstadoAlerta;
  comentario: string | null;
  revisadoPor: string;
}): Promise<Alerta[] | null> {
  const aplicar = (alertas: Alerta[]) =>
    alertas.map((a) =>
      a.reglaId === params.reglaId
        ? {
            ...a,
            estado: params.estado,
            comentario: params.comentario?.trim() || null,
            revisadoPor: params.estado === "pendiente" ? null : params.revisadoPor,
            revisadoEn: params.estado === "pendiente" ? null : Date.now(),
          }
        : a,
    );

  if (esLocal(params.evaluacionId)) {
    const ev = cacheLocal.get(params.evaluacionId);
    if (!ev) return null;
    const alertas = aplicar(ev.alertas);
    cacheLocal.set(params.evaluacionId, { ...ev, alertas });
    return alertas;
  }

  const ref = doc(db, "evaluaciones", params.evaluacionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const alertas = aplicar((snap.data() as Evaluacion).alertas ?? []);
  await updateDoc(ref, { alertas });
  return alertas;
}
