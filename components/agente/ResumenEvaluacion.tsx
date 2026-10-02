// Tarjeta del expediente con la última evaluación del agente (RF-09).
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../../firebase";
import { evaluarYGuardar } from "../../lib/agente/persistencia";
import { ConsultaRegistro, Evaluacion } from "../../lib/agente/tipos";
import { BadgePrioridad, COLORES, TEMA_PRIORIDAD } from "./AgenteUI";

export default function ResumenEvaluacion({
  pacienteId,
  consultaActual,
  historial,
}: {
  pacienteId: string;
  consultaActual: ConsultaRegistro;
  historial: ConsultaRegistro[];
}) {
  const router = useRouter();
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [evaluando, setEvaluando] = useState(false);

  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, "evaluaciones"), where("pacienteId", "==", pacienteId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Evaluacion) }))
          .sort((a, b) => (b.creadaEnMs ?? 0) - (a.creadaEnMs ?? 0));
        setEvaluaciones(lista);
      },
      () => setEvaluaciones([]),
    );
    return () => unsub();
  }, [pacienteId]);

  // La evaluación vigente es la de la consulta más reciente.
  const vigente = evaluaciones.find((e) => e.registroId === consultaActual.id) ?? null;

  const evaluarAhora = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    setEvaluando(true);
    try {
      const { id } = await evaluarYGuardar({
        consulta: { ...consultaActual, pacienteId },
        registroId: consultaActual.id ?? null,
        uid: user.uid,
        historial,
      });
      router.push({ pathname: "/evaluacion", params: { id, origen: "expediente" } });
    } catch {
      Alert.alert("Error", "El agente no pudo evaluar la consulta");
    } finally {
      setEvaluando(false);
    }
  };

  const pendientes = vigente?.alertas.filter((a) => a.estado === "pendiente") ?? [];
  const tema = vigente ? TEMA_PRIORIDAD[vigente.prioridad] : null;

  return (
    <View style={st.card}>
      <View style={st.fila}>
        <View style={st.iconoAgente}>
          <Ionicons name="sparkles" size={18} color={COLORES.marca} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.titulo}>Evaluación del agente</Text>
          <Text style={st.sub}>
            {vigente
              ? `Última consulta · ${evaluaciones.length} ${evaluaciones.length === 1 ? "evaluación" : "evaluaciones"} en total`
              : "La consulta más reciente aún no se ha evaluado"}
          </Text>
        </View>
        {vigente ? <BadgePrioridad prioridad={vigente.prioridad} compacto /> : null}
      </View>

      {vigente && tema ? (
        <>
          {vigente.alertas.length > 0 ? (
            <View style={[st.lista, { borderColor: tema.borde }]}>
              {vigente.alertas.slice(0, 3).map((a, i) => (
                <View key={a.reglaId} style={[st.item, i > 0 && st.itemSep]}>
                  <Ionicons
                    name={TEMA_PRIORIDAD[a.prioridad].icono}
                    size={16}
                    color={TEMA_PRIORIDAD[a.prioridad].color}
                  />
                  <Text style={[st.itemTexto, a.estado !== "pendiente" && st.itemCerrado]} numberOfLines={1}>
                    {a.nombre}
                  </Text>
                  {a.estado !== "pendiente" ? (
                    <Ionicons name="checkmark-done" size={16} color="#067647" accessibilityLabel="Revisada" />
                  ) : null}
                </View>
              ))}
              {vigente.alertas.length > 3 ? (
                <Text style={st.mas}>+{vigente.alertas.length - 3} más</Text>
              ) : null}
            </View>
          ) : (
            <Text style={st.ok}>Sin alertas en la consulta más reciente.</Text>
          )}

          <View style={st.acciones}>
            <TouchableOpacity
              style={st.botonPrimario}
              onPress={() =>
                router.push({ pathname: "/evaluacion", params: { id: vigente.id!, origen: "expediente" } })
              }
            >
              <Text style={st.botonPrimarioTexto}>
                {pendientes.length ? `Revisar ${pendientes.length} pendientes` : "Ver evaluación"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.botonSecundario} onPress={evaluarAhora} disabled={evaluando}>
              {evaluando ? (
                <ActivityIndicator color={COLORES.marca} />
              ) : (
                <Text style={st.botonSecundarioTexto}>Reevaluar</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity style={[st.botonPrimario, { marginTop: 12 }]} onPress={evaluarAhora} disabled={evaluando}>
          {evaluando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={st.botonPrimarioTexto}>Evaluar con el agente</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff",
    shadowColor: "#0B1B33",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  fila: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconoAgente: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF4FB",
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { fontSize: 16, fontWeight: "700", color: COLORES.texto },
  sub: { fontSize: 12, color: COLORES.textoSuave, marginTop: 2 },
  lista: { marginTop: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  itemSep: { borderTopWidth: 1, borderTopColor: COLORES.borde },
  itemTexto: { flex: 1, fontSize: 14, color: COLORES.texto },
  itemCerrado: { color: COLORES.textoSuave, textDecorationLine: "line-through" },
  mas: { fontSize: 13, color: COLORES.textoSuave, paddingBottom: 10 },
  ok: { marginTop: 12, fontSize: 14, color: "#067647" },
  acciones: { flexDirection: "row", gap: 10, marginTop: 12 },
  botonPrimario: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: COLORES.marca,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  botonPrimarioTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
  botonSecundario: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFD3EC",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  botonSecundarioTexto: { color: COLORES.marca, fontWeight: "700", fontSize: 14 },
});
