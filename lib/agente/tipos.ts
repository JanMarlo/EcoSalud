// Tipos del agente de IA de EcoSalud (sistema experto basado en reglas).

export type Prioridad = "alta" | "media" | "baja";
export type PrioridadFinal = Prioridad | "ninguna";
export type EstadoAlerta = "pendiente" | "revisada" | "descartada";

export type GrupoRegla = "signos_vitales" | "combinacion_sintomas" | "historial";

/** Hechos que entiende el motor (salida de la normalización). */
export type NombreHecho =
  | "temperatura"
  | "sistolica"
  | "diastolica"
  | "imc"
  | "edadMeses"
  | "sintomas"
  | "sintomasRecurrentes"
  | "fiebrePersistente"
  | "variacionPesoPct"
  | "presionElevadaAnterior";

export type Operador =
  | ">="
  | "<"
  | "entre"
  | "=="
  | "contiene"
  | "contieneAlguno"
  | "noVacio";

export type CondicionHoja = {
  hecho: NombreHecho;
  operador: Operador;
  valor?: number | string | boolean | string[] | [number, number];
};

export type CondicionRegla = { regla: string };

export type Condicion =
  | CondicionHoja
  | CondicionRegla
  | { todas: Condicion[] }
  | { cualquiera: Condicion[] }
  | { ninguna: Condicion[] };

export type Regla = {
  id: string;
  nombre: string;
  grupo: GrupoRegla;
  prioridad: Prioridad;
  aplicaA?: { edadMinimaMeses?: number; edadMaximaMeses?: number };
  condicion: Condicion;
  suprime?: string[];
  mensaje: string;
  recomendacion: string;
  seguimientoDias?: number | null;
  fuente: string;
};

export type BaseConocimiento = {
  version: string;
  reglas: Regla[];
};

/** Consulta tal como se guarda en la colección `registros`. */
export type ConsultaRegistro = {
  id?: string;
  pacienteId?: string | null;
  nombre?: string;
  edad?: number | null;
  unidadEdad?: string;
  altura?: number | null;
  peso?: number | null;
  temperatura?: number | null;
  presion?: string | null;
  sintomas?: string[];
  diagnostico?: string;
  recomendaciones?: string;
  createdAt?: any;
};

export type Hechos = {
  temperatura: number | null;
  sistolica: number | null;
  diastolica: number | null;
  imc: number | null;
  edadMeses: number | null;
  sintomas: string[];
  sintomasRecurrentes: string[] | null;
  fiebrePersistente: boolean | null;
  variacionPesoPct: number | null;
  presionElevadaAnterior: boolean | null;
};

export type Evidencia = {
  dato: string;
  valor: string;
  umbral?: string;
};

export type Alerta = {
  reglaId: string;
  nombre: string;
  grupo: GrupoRegla;
  prioridad: Prioridad;
  mensaje: string;
  evidencia: Evidencia[];
  recomendacion: string;
  seguimientoDias: number | null;
  estado: EstadoAlerta;
  revisadoPor: string | null;
  revisadoEn: number | null;
  comentario: string | null;
};

export type ReglaNoEvaluada = { reglaId: string; nombre: string; motivo: string };

export type Evaluacion = {
  id?: string;
  registroId: string | null;
  pacienteId: string | null;
  nombrePaciente: string;
  uid: string;
  prioridad: PrioridadFinal;
  alertas: Alerta[];
  noEvaluadas: ReglaNoEvaluada[];
  avisos: string[];
  reglasEvaluadas: number;
  versionBase: string;
  creadaEnMs: number;
  createdAt?: any;
};
