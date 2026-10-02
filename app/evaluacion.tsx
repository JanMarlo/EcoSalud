// Pantalla de alertas y resultados del agente de IA.
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORES, TarjetaAlerta, TEMA_PRIORIDAD } from "../components/agente/AgenteUI";
import { db } from "../firebase";
import { esLocal, obtenerLocal, revisarAlerta } from "../lib/agente/persistencia";
import { Alerta, EstadoAlerta, Evaluacion } from "../lib/agente/tipos";

type Filtro = "todas" | "pendientes" | "cerradas";

const fechaCorta = (ms: number) =>
  new Date(ms).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const sumarDias = (dias: number) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export default function EvaluacionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const origen = params.origen === "consulta" ? "consulta" : "expediente";
  const deCita = params.deCita === "true";

  const [ev, setEv] = useState<Evaluacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [verNoEvaluadas, setVerNoEvaluadas] = useState(false);
  const [modal, setModal] = useState<{ alerta: Alerta; estado: EstadoAlerta } | null>(null);
  const [comentario, setComentario] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (esLocal(id)) {
      setEv(obtenerLocal(id));
      setCargando(false);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "evaluaciones", id),
      (snap) => {
        setEv(snap.exists() ? ({ id: snap.id, ...snap.data() } as Evaluacion) : null);
        setCargando(false);
      },
      () => setCargando(false),
    );
    return () => unsub();
  }, [id]);

  const conteo = useMemo(() => {
    const alertas = ev?.alertas ?? [];
    const pendientes = alertas.filter((a) => a.estado === "pendiente").length;
    return { total: alertas.length, pendientes, cerradas: alertas.length - pendientes };
  }, [ev]);

  const visibles = useMemo(() => {
    const alertas = ev?.alertas ?? [];
    if (filtro === "pendientes") return alertas.filter((a) => a.estado === "pendiente");
    if (filtro === "cerradas") return alertas.filter((a) => a.estado !== "pendiente");
    return alertas;
  }, [ev, filtro]);

  const cambiarEstado = async (alerta: Alerta, estado: EstadoAlerta, texto: string | null) => {
    const user = getAuth().currentUser;
    if (!ev?.id) return;
    setGuardando(true);
    try {
      const alertas = await revisarAlerta({
        evaluacionId: ev.id,
        reglaId: alerta.reglaId,
        estado,
        comentario: texto,
        revisadoPor: user?.email ?? user?.uid ?? "usuario",
      });
      if (alertas && esLocal(ev.id)) setEv({ ...ev, alertas });
    } catch {
      Alert.alert("Error", "No se pudo actualizar la alerta");
    } finally {
      setGuardando(false);
      setModal(null);
      setComentario("");
    }
  };

  const agendar = (dias: number) => {
    router.push({
      pathname: "/tabs/crear-cita",
      params: {
        pacienteId: ev?.pacienteId ?? "",
        fecha: sumarDias(dias),
        motivo: `Seguimiento sugerido por el agente`,
      },
    });
  };

  const continuar = () => {
    if (origen === "consulta") {
      if (deCita || !ev?.pacienteId) router.replace("/tabs/citas");
      else router.replace(`/patient-profile?id=${ev.pacienteId}`);
    } else {
      router.back();
    }
  };

  if (cargando) {
    return (
      <View style={st.centro}>
        <ActivityIndicator size="large" color={COLORES.marca} />
        <Text style={st.centroTexto}>Analizando la consulta…</Text>
      </View>
    );
  }

  if (!ev) {
    return (
      <View style={st.centro}>
        <Ionicons name="cloud-offline-outline" size={40} color={COLORES.textoSuave} />
        <Text style={st.centroTexto}>No se encontró la evaluación.</Text>
        <TouchableOpacity style={st.botonContinuar} onPress={() => router.back()}>
          <Text style={st.botonContinuarTexto}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tema = TEMA_PRIORIDAD[ev.prioridad];
  const resumen =
    conteo.total === 0
      ? "Ninguna regla se activó con los datos de esta consulta."
      : `${conteo.total} ${conteo.total === 1 ? "alerta" : "alertas"} · ${conteo.pendientes} ${
          conteo.pendientes === 1 ? "pendiente" : "pendientes"
        } de revisión`;

  return (
    <SafeAreaView style={st.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Encabezado */}
        <View style={st.header}>
          <LinearGradient colors={["#2FA4D6", "#1E5FA8"]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]}>
            <View style={st.headerFila}>
              <TouchableOpacity style={st.iconoHeader} onPress={() => router.back()} accessibilityLabel="Volver">
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={st.headerTitulo}>Evaluación del agente</Text>
                <Text style={st.headerSub} numberOfLines={1}>
                  {ev.nombrePaciente || "Paciente"} · {fechaCorta(ev.creadaEnMs)}
                </Text>
              </View>
              <Ionicons name="sparkles-outline" size={22} color="rgba(255,255,255,0.85)" />
            </View>
          </SafeAreaView>
        </View>

        {/* Prioridad sugerida */}
        <View style={[st.hero, { backgroundColor: tema.fondo, borderColor: tema.borde }]}>
          {origen === "consulta" ? (
            <View style={st.guardada}>
              <Ionicons name="checkmark-circle" size={14} color="#067647" />
              <Text style={st.guardadaTexto}>Consulta guardada</Text>
            </View>
          ) : null}
          <View style={st.heroFila}>
            <View style={[st.heroIcono, { backgroundColor: "#fff", borderColor: tema.borde }]}>
              <Ionicons name={tema.icono} size={30} color={tema.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.heroEtiqueta}>Atención sugerida</Text>
              <Text style={[st.heroTitulo, { color: tema.color }]}>{tema.titulo}</Text>
            </View>
          </View>
          <Text style={st.heroResumen}>{resumen}</Text>

          <View style={st.metricas}>
            <Metrica valor={conteo.total} etiqueta="Alertas" />
            <Metrica valor={ev.reglasEvaluadas} etiqueta="Reglas evaluadas" />
            <Metrica valor={ev.noEvaluadas.length} etiqueta="Sin datos" />
          </View>
        </View>

        {/* Aviso de alcance (RNF-03) */}
        <View style={st.aviso}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORES.textoSuave} />
          <Text style={st.avisoTexto}>
            Apoyo a la decisión, no sustituye el juicio clínico. El agente no emite diagnósticos ni
            recomienda medicamentos.
          </Text>
        </View>

        {/* Avisos de normalización */}
        {ev.avisos?.length ? (
          <View style={st.avisosDatos}>
            {ev.avisos.map((a, i) => (
              <View key={i} style={st.avisoDatoFila}>
                <Ionicons name="information-circle-outline" size={16} color="#B54708" />
                <Text style={st.avisoDatoTexto}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Alertas */}
        <View style={st.seccion}>
          {conteo.total > 0 ? (
            <>
              <View style={st.segmento} accessibilityRole="tablist">
                {(
                  [
                    ["todas", `Todas (${conteo.total})`],
                    ["pendientes", `Pendientes (${conteo.pendientes})`],
                    ["cerradas", `Cerradas (${conteo.cerradas})`],
                  ] as [Filtro, string][]
                ).map(([clave, texto]) => (
                  <TouchableOpacity
                    key={clave}
                    style={[st.segmentoItem, filtro === clave && st.segmentoActivo]}
                    onPress={() => setFiltro(clave)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: filtro === clave }}
                  >
                    <Text style={[st.segmentoTexto, filtro === clave && st.segmentoTextoActivo]}>{texto}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {visibles.map((a) => (
                <TarjetaAlerta
                  key={a.reglaId}
                  alerta={a}
                  onRevisar={() => setModal({ alerta: a, estado: "revisada" })}
                  onDescartar={() => setModal({ alerta: a, estado: "descartada" })}
                  onReabrir={() => cambiarEstado(a, "pendiente", null)}
                  onAgendar={a.seguimientoDias ? () => agendar(a.seguimientoDias!) : undefined}
                />
              ))}

              {visibles.length === 0 ? (
                <Text style={st.vacioFiltro}>No hay alertas en este filtro.</Text>
              ) : null}
            </>
          ) : (
            <View style={st.sinAlertas}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color="#067647" />
              <Text style={st.sinAlertasTitulo}>No se detectaron combinaciones de riesgo</Text>
              <Text style={st.sinAlertasTexto}>
                Se revisaron {ev.reglasEvaluadas} reglas de signos vitales, síntomas e historial. Continúa con la
                valoración habitual.
              </Text>
            </View>
          )}
        </View>

        {/* Reglas no evaluadas (RNF-08) */}
        {ev.noEvaluadas.length > 0 ? (
          <View style={st.seccion}>
            <TouchableOpacity
              style={st.plegable}
              onPress={() => setVerNoEvaluadas(!verNoEvaluadas)}
              accessibilityRole="button"
              accessibilityState={{ expanded: verNoEvaluadas }}
            >
              <Ionicons name="help-circle-outline" size={20} color={COLORES.textoSuave} />
              <Text style={st.plegableTexto}>Reglas no evaluadas por falta de datos ({ev.noEvaluadas.length})</Text>
              <Ionicons name={verNoEvaluadas ? "chevron-up" : "chevron-down"} size={18} color={COLORES.textoSuave} />
            </TouchableOpacity>
            {verNoEvaluadas ? (
              <View style={st.listaNoEval}>
                {ev.noEvaluadas.map((n, i) => (
                  <View key={n.reglaId} style={[st.noEvalFila, i > 0 && st.noEvalSep]}>
                    <Text style={st.noEvalId}>{n.reglaId}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={st.noEvalNombre}>{n.nombre}</Text>
                      <Text style={st.noEvalMotivo}>{n.motivo}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <Text style={st.version}>
          Base de conocimiento v{ev.versionBase}
          {esLocal(ev.id ?? "") ? " · no se pudo guardar en la nube" : ""}
        </Text>
      </ScrollView>

      {/* Pie fijo */}
      <View style={st.pie}>
        <TouchableOpacity style={st.botonContinuar} onPress={continuar} accessibilityRole="button">
          <Text style={st.botonContinuarTexto}>
            {origen === "consulta" ? (deCita ? "Volver a citas" : "Ir al expediente") : "Volver al expediente"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Modal de revisión (RF-10) */}
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.modalFondo}>
          <View style={st.modalHoja}>
            <View style={st.modalAsa} />
            <Text style={st.modalTitulo}>
              {modal?.estado === "revisada" ? "Marcar alerta como revisada" : "Descartar alerta"}
            </Text>
            <Text style={st.modalSub}>
              {modal?.alerta.reglaId} · {modal?.alerta.nombre}
            </Text>
            <Text style={st.modalLabel}>Comentario (opcional)</Text>
            <TextInput
              style={st.modalInput}
              value={comentario}
              onChangeText={setComentario}
              placeholder={
                modal?.estado === "revisada"
                  ? "Ej. Se repitió la medición: 150/95"
                  : "Ej. Medición tomada después de ejercicio"
              }
              placeholderTextColor="#8A93A3"
              multiline
            />
            <View style={st.modalAcciones}>
              <TouchableOpacity style={st.modalCancelar} onPress={() => setModal(null)}>
                <Text style={st.modalCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.modalConfirmar, modal?.estado === "descartada" && { backgroundColor: "#475467" }]}
                disabled={guardando}
                onPress={() => modal && cambiarEstado(modal.alerta, modal.estado, comentario)}
              >
                {guardando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={st.modalConfirmarTexto}>
                    {modal?.estado === "revisada" ? "Confirmar revisión" : "Descartar"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Metrica({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <View style={st.metrica}>
      <Text style={st.metricaValor}>{valor}</Text>
      <Text style={st.metricaEtiqueta}>{etiqueta}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORES.fondo },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: COLORES.fondo, padding: 24 },
  centroTexto: { color: COLORES.textoSuave, fontSize: 15 },
  header: { paddingBottom: 64, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" },
  headerFila: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  iconoHeader: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerTitulo: { color: "#fff", fontSize: 20, fontWeight: "800" },
  headerSub: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 2 },
  hero: {
    marginHorizontal: 16,
    marginTop: -44,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  guardada: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  guardadaTexto: { color: "#067647", fontSize: 12, fontWeight: "700" },
  heroFila: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroIcono: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  heroEtiqueta: { fontSize: 13, color: COLORES.textoSuave, fontWeight: "600" },
  heroTitulo: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  heroResumen: { fontSize: 15, color: COLORES.texto, marginTop: 12, lineHeight: 21 },
  metricas: { flexDirection: "row", marginTop: 14, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 10 },
  metrica: { flex: 1, alignItems: "center" },
  metricaValor: { fontSize: 20, fontWeight: "800", color: COLORES.texto },
  metricaEtiqueta: { fontSize: 12, color: COLORES.textoSuave, marginTop: 2 },
  aviso: { flexDirection: "row", gap: 8, marginHorizontal: 20, marginTop: 14, alignItems: "flex-start" },
  avisoTexto: { flex: 1, fontSize: 13, color: COLORES.textoSuave, lineHeight: 18 },
  avisosDatos: {
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFAEB",
    gap: 6,
  },
  avisoDatoFila: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  avisoDatoTexto: { flex: 1, fontSize: 13, color: "#7A2E0E", lineHeight: 18 },
  seccion: { marginHorizontal: 16, marginTop: 18 },
  segmento: { flexDirection: "row", backgroundColor: "#E7ECF3", borderRadius: 12, padding: 4, marginBottom: 14 },
  segmentoItem: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 9 },
  segmentoActivo: { backgroundColor: "#fff" },
  segmentoTexto: { fontSize: 13, color: COLORES.textoSuave, fontWeight: "600" },
  segmentoTextoActivo: { color: COLORES.texto },
  vacioFiltro: { textAlign: "center", color: COLORES.textoSuave, paddingVertical: 20 },
  sinAlertas: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORES.borde,
    gap: 8,
  },
  sinAlertasTitulo: { fontSize: 17, fontWeight: "700", color: COLORES.texto, textAlign: "center" },
  sinAlertasTexto: { fontSize: 14, color: COLORES.textoSuave, textAlign: "center", lineHeight: 20 },
  plegable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORES.borde,
  },
  plegableTexto: { flex: 1, fontSize: 14, color: COLORES.texto, fontWeight: "600" },
  listaNoEval: { backgroundColor: "#fff", borderRadius: 14, marginTop: 8, paddingHorizontal: 14 },
  noEvalFila: { flexDirection: "row", gap: 12, paddingVertical: 10 },
  noEvalSep: { borderTopWidth: 1, borderTopColor: COLORES.borde },
  noEvalId: { width: 48, fontSize: 12, fontWeight: "700", color: COLORES.textoSuave, paddingTop: 2 },
  noEvalNombre: { fontSize: 14, color: COLORES.texto, fontWeight: "600" },
  noEvalMotivo: { fontSize: 13, color: COLORES.textoSuave, marginTop: 2 },
  version: { textAlign: "center", fontSize: 12, color: "#8A93A3", marginTop: 20 },
  pie: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "rgba(245,247,251,0.96)",
    borderTopWidth: 1,
    borderTopColor: COLORES.borde,
  },
  botonContinuar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: COLORES.marca,
    paddingHorizontal: 20,
  },
  botonContinuarTexto: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalFondo: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(11,27,51,0.45)" },
  modalHoja: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalAsa: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#D0D5DD", marginBottom: 16 },
  modalTitulo: { fontSize: 18, fontWeight: "800", color: COLORES.texto },
  modalSub: { fontSize: 14, color: COLORES.textoSuave, marginTop: 4 },
  modalLabel: { fontSize: 13, fontWeight: "600", color: COLORES.texto, marginTop: 16, marginBottom: 6 },
  modalInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORES.texto,
    textAlignVertical: "top",
  },
  modalAcciones: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancelar: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: COLORES.fondo },
  modalCancelarTexto: { color: COLORES.texto, fontWeight: "700", fontSize: 15 },
  modalConfirmar: { flex: 1.4, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: COLORES.marca },
  modalConfirmarTexto: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
