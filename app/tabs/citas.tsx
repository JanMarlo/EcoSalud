import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { Swipeable } from "react-native-gesture-handler";
import Svg, { Defs, Path, Stop, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { db } from "../../firebase";

const TIEMPO_MAX_CONSULTA_MS = 30 * 60 * 1000;

const obtenerFechaMs = (valor: any) => {
  if (!valor) return 0;
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  if (typeof valor.seconds === "number") return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();

  const fecha = new Date(valor).getTime();
  return Number.isFinite(fecha) ? fecha : 0;
};

const consultaVencida = (cita: any) => {
  if (cita?.estado !== "en consulta") return false;

  const inicio = obtenerFechaMs(cita.startAt);
  if (!inicio) return false;

  return Date.now() - inicio >= TIEMPO_MAX_CONSULTA_MS;
};

export default function Citas() {
  const { width } = Dimensions.get("window");

  function SvgTop() {
    return (
      <Svg width={width} height={220} viewBox={`0 0 ${width} 220`}>
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1E5FA8" stopOpacity="1" />
            <Stop offset="1" stopColor="#2FA4D6" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d={`M0 0 H${width} V150 C${width} 150 ${width * 0.7} 220 ${
            width * 0.5
          } 180 C${width * 0.3} 140 0 200 0 200 V0 Z`}
          fill="url(#grad)"
        />
      </Svg>
    );
  }

  const [citas, setCitas] = useState<any[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [expandido, setExpandido] = useState(false);
  const router = useRouter();
  // ✅ Usar ref para evitar redirecciones múltiples al remontar el componente
  const yaRedirigioRef = useRef(false);

  const hayConsultaActiva = citas.some(
    (c) => c.estado === "en consulta" && !consultaVencida(c)
  );

  useEffect(() => {
    const citaActiva = citas.find(
      (c) => c.estado === "en consulta" && !consultaVencida(c)
    );

    if (!citaActiva) {
      yaRedirigioRef.current = false;
      return;
    }

    if (yaRedirigioRef.current) return;

    yaRedirigioRef.current = true;
    router.replace({
      pathname: "/tabs/crear_paciente",
      params: {
        pacienteId: citaActiva.pacienteId,
        citaId: citaActiva.id,
        enConsulta: "true",
      },
    });
  }, [citas]);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(collection(db, "citas"), where("uid", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          estado: (data.estado || "pendiente").toLowerCase().trim(),
        };
      });

      lista.sort((a: any, b: any) => {
        const prioridad = (estado: string) => {
          if (estado === "en consulta") return 1;
          if (estado === "en espera") return 2;
          if (estado === "pendiente") return 3;
          if (estado === "atendido") return 4;
          if (estado === "cancelado") return 5;
          return 6;
        };
        const diff = prioridad(a.estado) - prioridad(b.estado);
        if (diff !== 0) return diff;
        const fechaA = new Date(`${a.fecha}T${a.hora}`);
        const fechaB = new Date(`${b.fecha}T${b.hora}`);
        return fechaA.getTime() - fechaB.getTime();
      });

      setCitas(lista);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const citaActiva = citas.find((c) => c.estado === "en consulta");
    if (!citaActiva) return;

    const inicio = obtenerFechaMs(citaActiva.startAt);
    if (!inicio) return;

    const cancelarConsultaVencida = async () => {
      if (!consultaVencida(citaActiva)) return;

      try {
        await updateDoc(doc(db, "citas", citaActiva.id), {
          estado: "cancelado",
          cancelacionAutomatica: true,
          canceladoAt: new Date(),
        });
      } catch (error) {
        console.log("No se pudo cancelar la consulta vencida", error);
      }
    };

    const restante = TIEMPO_MAX_CONSULTA_MS - (Date.now() - inicio);

    if (restante <= 0) {
      cancelarConsultaVencida();
      return;
    }

    const timer = setTimeout(cancelarConsultaVencida, restante + 500);
    return () => clearTimeout(timer);
  }, [citas]);

  const eliminarCita = (item: any) => {
    // ✅ No permitir eliminar citas en curso
    if (item.estado === "en consulta") {
      Alert.alert("No permitido", "No puedes eliminar una cita en curso.");
      return;
    }
    Alert.alert("Eliminar cita", "¿Seguro que deseas eliminar esta cita?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "citas", item.id));
          } catch (error) {
            Alert.alert("Error", "No se pudo eliminar la cita");
          }
        },
      },
    ]);
  };

  const renderRightActions = (item: any) => (
    <TouchableOpacity
      style={styles.deleteSwipe}
      onPress={() => eliminarCita(item)}
    >
      <Ionicons name="trash" size={24} color="#fff" />
    </TouchableOpacity>
  );

  const cambiarEstado = (cita: any) => {
    if (cita.estado === "atendido") {
      Alert.alert("Consulta finalizada", "Esta cita ya no se puede modificar");
      return;
    }
    if (hayConsultaActiva && cita.estado !== "en consulta") {
      Alert.alert("Consulta en curso", "Debes finalizar la consulta desde el formulario clínico");
      return;
    }

    const opciones: any[] = [
      { text: "Pendiente", onPress: () => actualizarEstado(cita.id, "pendiente") },
      { text: "En espera", onPress: () => actualizarEstado(cita.id, "en espera") },
    ];

    if (cita.estado === "en consulta") {
      opciones.push({
        text: "Finalizar consulta",
        onPress: () => actualizarEstado(cita.id, "atendido"),
      });
    }

    opciones.push({
      text: "Cancelar cita",
      style: "destructive",
      onPress: () => actualizarEstado(cita.id, "cancelado"),
    });
    opciones.push({ text: "Cerrar", style: "cancel" });

    Alert.alert("Cambiar estado", "Selecciona un estado", opciones);
  };

  const actualizarEstado = async (id: string, estado: string) => {
    try {
      await updateDoc(doc(db, "citas", id), {
        estado,
        ...(estado === "en espera" && { checkInAt: new Date() }),
        ...(estado === "en consulta" && { startAt: new Date() }),
      });
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el estado");
    }
  };

  const getColorEstado = (estado: string) => {
    if (estado === "pendiente") return "#f59e0b";
    if (estado === "en espera") return "#3b82f6";
    if (estado === "en consulta") return "#8b5cf6";
    if (estado === "atendido") return "#10b981";
    if (estado === "cancelado") return "#ef4444";
    return "#6b7280";
  };

  const markedDates = useMemo(() => {
    const marks: any = {};
    citas.forEach((c) => {
      if (!marks[c.fecha]) {
        marks[c.fecha] = { marked: true, dotColor: "#1E88E5" };
      }
    });
    if (fechaSeleccionada) {
      marks[fechaSeleccionada] = {
        ...(marks[fechaSeleccionada] || {}),
        selected: true,
        selectedColor: "#1E88E5",
      };
    }
    return marks;
  }, [citas, fechaSeleccionada]);

  const citasFiltradas = citas.filter((c) => {
    const coincideNombre = busqueda
      ? c.nombrePaciente?.toLowerCase().includes(busqueda.toLowerCase())
      : true;
    const coincideFecha = fechaSeleccionada ? c.fecha === fechaSeleccionada : true;
    return coincideNombre && coincideFecha;
  });

  const iniciarConsulta = async (cita: any) => {
    if (cita.estado === "cancelado") {
      Alert.alert("Error", "No puedes iniciar una consulta cancelada");
      return;
    }
    if (hayConsultaActiva) {
      Alert.alert("Consulta en curso", "Ya tienes un paciente en consulta");
      return;
    }
    try {
      await updateDoc(doc(db, "citas", cita.id), {
        estado: "en consulta",
        startAt: new Date(),
      });
      router.replace({
        pathname: "/tabs/crear_paciente",
        params: { pacienteId: cita.pacienteId, citaId: cita.id, enConsulta: "true" },
      });
    } catch (error) {
      Alert.alert("Error", "No se pudo iniciar la consulta");
    }
  };

  return (
    <View style={styles.mainContainer}>
      <View style={styles.containerSvg}>
        <SvgTop />
      </View>

      <SafeAreaView style={styles.container}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Citas</Text>
          <Text style={styles.subtitle}>Agenda de pacientes</Text>
        </View>

        {!expandido && (
          <View style={styles.calendarShadow}>
            <View style={styles.calendarContainer}>
              <Text style={styles.calendarTitle}>SELECCIONAR FECHA</Text>
              <View style={styles.calendarWrapper}>
                <Calendar
                  style={{ paddingBottom: 0, height: 344 }}
                  hideExtraDays={true}
                  onDayPress={(day) => {
                    setFechaSeleccionada(
                      fechaSeleccionada === day.dateString ? "" : day.dateString
                    );
                  }}
                  markedDates={markedDates}
                  theme={{
                    textDayFontSize: 14,
                    textMonthFontSize: 16,
                    textDayHeaderFontSize: 12,
                    todayTextColor: "#1E88E5",
                    arrowColor: "#1E88E5",
                    selectedDayBackgroundColor: "#1E88E5",
                    monthTextColor: "#111827",
                    textMonthFontWeight: "bold",
                  }}
                />
              </View>
            </View>
          </View>
        )}

        <View style={[styles.listContainer, expandido && { marginTop: 0 }]}>
          <View style={styles.expandHeader}>
            <Text style={styles.expandTitle}>PACIENTES</Text>
            <TouchableOpacity onPress={() => setExpandido(!expandido)}>
              <Ionicons name={expandido ? "contract" : "expand"} size={22} color="#1E88E5" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#6b7280" />
            <TextInput
              placeholder="Buscar paciente..."
              placeholderTextColor="#6b7280"
              value={busqueda}
              onChangeText={setBusqueda}
              style={styles.searchInput}
            />
            {/* ✅ Botón para limpiar filtro de fecha activo */}
            {fechaSeleccionada ? (
              <TouchableOpacity onPress={() => setFechaSeleccionada("")}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            showsVerticalScrollIndicator={false}
            data={citasFiltradas}
            contentContainerStyle={{ paddingBottom: 40 }}
            style={{ flex: 1 }}
            keyExtractor={(item: any) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="calendar-outline" size={40} color="#9ca3af" />
                <Text style={styles.emptyText}>
                  {fechaSeleccionada ? "No hay citas en esta fecha" : "No hay citas registradas"}
                </Text>
              </View>
            }
            renderItem={({ item }: any) => (
              <Swipeable renderRightActions={() => renderRightActions(item)}>
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => {
                    if (item.estado === "en consulta" || item.estado === "atendido") return;
                    cambiarEstado(item);
                  }}
                >
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      {item.foto ? (
                        <Image source={{ uri: item.foto }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={22} color="#fff" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{item.nombrePaciente}</Text>
                      <Text style={styles.fecha}>🕒 {item.hora}</Text>
                      <Text style={styles.fecha}>📅 {item.fecha}</Text>
                      <Text style={styles.fecha}>📌 {item.motivo}</Text>
                    </View>

                    <View
                      style={[styles.estado, { backgroundColor: getColorEstado(item.estado) }]}
                    >
                      <Text style={styles.estadoText}>{item.estado}</Text>
                    </View>
                  </View>

                  {(() => {
                    const estado = item.estado;
                    if (estado === "atendido" || estado === "cancelado") return null;
                    if (estado === "pendiente") {
                      return (
                        <TouchableOpacity
                          style={styles.btnEspera}
                          onPress={() => actualizarEstado(item.id, "en espera")}
                        >
                          <Text style={styles.btnText}>Confirmar llegada</Text>
                        </TouchableOpacity>
                      );
                    }
                    if (estado === "en espera") {
                      return (
                        <TouchableOpacity
                          style={styles.btnConsulta}
                          onPress={() => iniciarConsulta(item)}
                        >
                          <Text style={styles.btnText}>Iniciar consulta</Text>
                        </TouchableOpacity>
                      );
                    }
                    if (estado === "en consulta") {
                      return (
                        <TouchableOpacity
                          style={[styles.btnFinalizar, { opacity: 0.6 }]}
                          onPress={() =>
                            Alert.alert(
                              "Consulta en proceso",
                              "Debes finalizar la consulta desde el formulario clínico"
                            )
                          }
                        >
                          <Text style={styles.btnText}>En consulta</Text>
                        </TouchableOpacity>
                      );
                    }
                    return null;
                  })()}
                </TouchableOpacity>
              </Swipeable>
            )}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 0 },
  title: { fontSize: 28, fontWeight: "bold", marginTop: 80, color: "#fff" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nombre: { fontWeight: "bold", fontSize: 15 },
  fecha: { color: "#6b7280", fontSize: 12, marginTop: 2 },
  estado: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14 },
  estadoText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  mainContainer: { flex: 1, backgroundColor: "#f5f6fa" },
  containerSvg: { position: "absolute", top: 0, width: "100%" },
  headerContent: { marginTop: 20, alignItems: "center", marginBottom: 10 },
  subtitle: { color: "#e0f2fe", fontSize: 13, marginTop: 2, letterSpacing: 0.3 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    overflow: "hidden",
  },
  deleteSwipe: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
    marginBottom: 10,
  },
  calendarContainer: {
    backgroundColor: "#fff",
    borderRadius: 22,
    paddingTop: 14,
    marginTop: -60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  calendarWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  emptyContainer: { alignItems: "center", marginTop: 30, gap: 10 },
  emptyText: { textAlign: "center", color: "#6b7280", fontSize: 14 },
  calendarTitle: {
    fontWeight: "bold",
    marginTop: 0,
    fontSize: 14,
    marginBottom: 8,
    color: "#111827",
    letterSpacing: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    marginBottom: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    height: 50,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginTop: 12,
  },
  searchInput: { marginLeft: 10, flex: 1, fontSize: 14, color: "#111827" },
  avatarImg: { width: "100%", height: "100%" },
  listContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    marginTop: 0,
    marginBottom: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  calendarShadow: {
    borderRadius: 22,
    marginTop: 60,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  expandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  expandTitle: { fontWeight: "bold", fontSize: 14, color: "#111827", marginBottom: -10 },
  btnEspera: { marginTop: 10, backgroundColor: "#3b82f6", padding: 10, borderRadius: 10, alignItems: "center" },
  btnConsulta: { marginTop: 10, backgroundColor: "#10b981", padding: 10, borderRadius: 10, alignItems: "center" },
  btnFinalizar: { marginTop: 10, backgroundColor: "#8b5cf6", padding: 10, borderRadius: 10, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "bold" },
});
