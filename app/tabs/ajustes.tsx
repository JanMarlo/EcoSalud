import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { db } from "../../firebase";

const { width } = Dimensions.get("window");

// Notificaciones de demostración para la interfaz
const MOSTRAR_DEMOS = true;

const notificacionesDemo = [
  {
    id: "demo-clinica",
    tipo: "clinica",
    titulo: "Cambio relevante en el peso",
    mensaje:
      "Ejemplo de una alerta que requiere revisión del personal médico.",
    paciente: "Paciente de ejemplo",
    fecha: "Hoy · 10:45 a. m.",
    prioridad: "Media",
    estado: "Pendiente",
    leido: false,
    demo: true,
  },
  {
    id: "demo-cita",
    tipo: "cita",
    titulo: "Consulta programada",
    mensaje:
      "Consulta de ejemplo programada para mañana a las 11:00 a. m.",
    paciente: "Paciente de ejemplo",
    fecha: "Mañana · 11:00 a. m.",
    estado: "Programada",
    leido: false,
    demo: true,
  },
  {
    id: "demo-actividad",
    tipo: "actividad",
    titulo: "Evaluación revisada",
    mensaje:
      "Se registró la revisión de una evaluación clínica de ejemplo.",
    paciente: "Paciente de ejemplo",
    fecha: "Ayer · 4:30 p. m.",
    estado: "Completada",
    leido: true,
    demo: true,
  },
];

export default function Notificaciones() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [filtroAlertas, setFiltroAlertas] = useState<
  "todas" | "clinica" | "cita" | "actividad"
  >("todas");

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(
      collection(db, "citas"),
      where("uid", "==", user.uid),
      where("estado", "==", "pendiente")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ahora = new Date();
      const data: any[] = [];

      snapshot.docs.forEach((docSnap) => {
        const cita = docSnap.data();

        // ✅ Usar fechaCita (ISO string) en lugar de cita.fecha (solo fecha)
        const fechaCita = new Date(cita.fechaCita);
        const diffMs = fechaCita.getTime() - ahora.getTime();
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin <= 1440 && diffMin > 0 && !cita.recordatorioMostrado) {
          const horas = Math.floor(diffMin / 60);
          const minutos = diffMin % 60;
          const tiempoTexto =
            horas > 0
              ? `${horas} hora(s) y ${minutos} min`
              : `${minutos} min`;

          data.push({
            id: docSnap.id,
            titulo: "⏰ Recordatorio de cita",
            mensaje: `Faltan ${tiempoTexto} para la cita con ${cita.nombrePaciente}`,
            fecha: cita.fecha,
            leido: false,
            tipo: "cita",
          });
        }
      });

      setNotificaciones(data);
    });

    return () => unsubscribe();
  }, []);

  const marcarComoLeido = (id: string) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leido: true } : n))
    );
  };

  const getIcon = (tipo: string) => {
    if (tipo === "cita") return "calendar-outline";
    if (tipo === "seguimiento") return "time-outline";
    return "alert-circle-outline";
  };

  const getColor = (tipo: string) => {
    if (tipo === "cita") return "#1E88E5";
    if (tipo === "seguimiento") return "#f59e0b";
    return "#ef4444";
  };

  // Filtrar notificaciones según la categoría seleccionada
  const todasLasNotificaciones = [
  ...notificaciones,
  ...(MOSTRAR_DEMOS ? notificacionesDemo : []),
];

const notificacionesFiltradas = todasLasNotificaciones.filter(
  (item) => {
    if (filtroAlertas === "todas") {
      return true;
    }

    if (filtroAlertas === "actividad") {
      return (
        item.tipo === "actividad" ||
        item.tipo === "seguimiento"
      );
    }

    return item.tipo === filtroAlertas;
  }
);

  const HeaderOla = () => (
  <>
    <View style={styles.containerSvg}>
      <Svg
        width={width}
        height={220}
        viewBox={`0 0 ${width} 220`}
      >
        <Defs>
          <SvgLinearGradient
            id="gradAlertasHeader"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
          >
            <Stop offset="0" stopColor="#1E5FA8" stopOpacity="1" />
            <Stop offset="1" stopColor="#2FA4D6" stopOpacity="1" />
          </SvgLinearGradient>
        </Defs>

        <Path
          d={`M0 0 H${width} V150
              C${width} 150 ${width * 0.7} 220
              ${width * 0.5} 180
              C${width * 0.3} 140 0 200 0 200
              V0 Z`}
          fill="url(#gradAlertasHeader)"
        />
      </Svg>
    </View>

    <View style={styles.headerContent}>
      <View style={styles.headerTitleRow}>
        <Ionicons
          name="notifications-outline"
          size={27}
          color="#FFFFFF"
        />

        <Text style={styles.headerTitle}>
          Alertas
        </Text>
      </View>

      <Text style={styles.headerSubtitle}>
        Centro de recordatorios y seguimiento
      </Text>
    </View>
  </>
  );

  return (
    <View style={styles.mainContainer}>
      <HeaderOla />
      {/* Resumen de alertas */}
      <View style={styles.resumenContainer}>

        <View style={styles.resumenCard}>
          <Ionicons
            name="alert-circle-outline"
            size={25}
            color="#D97745"
          />

          <Text style={styles.resumenNumero}>
            3
          </Text>

          <Text style={styles.resumenTexto}>
            Pendientes
          </Text>
        </View>

        <View style={styles.resumenCard}>
          <Ionicons
            name="calendar-outline"
            size={25}
            color="#287DBA"
          />

          <Text style={styles.resumenNumero}>
            2
          </Text>

          <Text style={styles.resumenTexto}>
            Próximas citas
          </Text>
        </View>

        <View style={styles.resumenCard}>
          <Ionicons
            name="checkmark-circle-outline"
            size={25}
            color="#40966A"
          />

          <Text style={styles.resumenNumero}>
            1
          </Text>

          <Text style={styles.resumenTexto}>
            Revisadas
          </Text>
        </View>

      </View>


      <ScrollView>
        <View style={styles.content}>
                  {/* Filtros de alertas */}
        <View style={styles.alertasFiltrosContainer}>

          <Text style={styles.alertasFiltrosTitulo}>
            Tus notificaciones
          </Text>

          <View style={styles.alertasFiltrosRow}>

            {([
              { id: "todas", nombre: "Todas" },
              { id: "clinica", nombre: "Clínicas" },
              { id: "cita", nombre: "Citas" },
              { id: "actividad", nombre: "Actividad" },
            ] as const).map((opcion) => {

              const activo = filtroAlertas === opcion.id;

              return (
                <TouchableOpacity
                  key={opcion.id}
                  activeOpacity={0.8}
                  onPress={() => setFiltroAlertas(opcion.id)}
                  style={[
                    styles.alertasFiltroBoton,
                    activo && styles.alertasFiltroActivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.alertasFiltroTexto,
                      activo && styles.alertasFiltroTextoActivo,
                    ]}
                  >
                    {opcion.nombre}
                  </Text>
                </TouchableOpacity>
              );
            })}

          </View>

        </View>
          {notificacionesFiltradas.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>
                {filtroAlertas === "clinica"
                  ? "No hay alertas clínicas para mostrar."
                  : filtroAlertas === "cita"
                  ? "No hay recordatorios de citas."
                  : filtroAlertas === "actividad"
                  ? "No hay actividad reciente."
                  : "No tienes alertas ni recordatorios pendientes."}
              </Text>
            </View>
          ) : (
            notificacionesFiltradas.map((item) =>
    item.demo ? (

      // TARJETAS DE DEMOSTRACIÓN
      <View
        key={item.id}
        style={[
          styles.demoCard,
          {
            borderLeftColor:
              item.tipo === "clinica"
                ? "#D97745"
                : item.tipo === "cita"
                ? "#287DBA"
                : "#40966A",
          },
        ]}
      >

        {/* Encabezado de la tarjeta */}
        <View style={styles.demoHeader}>

          <View style={styles.demoTipoRow}>

            <Ionicons
              name={
                item.tipo === "clinica"
                  ? "heart-outline"
                  : item.tipo === "cita"
                  ? "calendar-outline"
                  : "checkmark-circle-outline"
              }
              size={17}
              color={
                item.tipo === "clinica"
                  ? "#D97745"
                  : item.tipo === "cita"
                  ? "#287DBA"
                  : "#40966A"
              }
            />

            <Text
              style={[
                styles.demoTipo,
                {
                  color:
                    item.tipo === "clinica"
                      ? "#D97745"
                      : item.tipo === "cita"
                      ? "#287DBA"
                      : "#40966A",
                },
              ]}
            >
              {item.tipo === "clinica"
                ? "Alerta clínica"
                : item.tipo === "cita"
                ? "Recordatorio de cita"
                : "Actividad"}
            </Text>

            <Text style={styles.demoBadge}>
              DEMO
            </Text>

          </View>

          <Text style={styles.demoFecha}>
            {item.fecha}
          </Text>

        </View>

        {/* Información principal */}
        <Text style={styles.demoTitulo}>
          {item.titulo}
        </Text>

        <Text style={styles.demoPaciente}>
          {item.paciente}
        </Text>

        <Text style={styles.demoMensaje}>
          {item.mensaje}
        </Text>

        {/* Estado y prioridad */}
        <View style={styles.demoEtiquetas}>

          <View
            style={[
              styles.demoEstado,
              {
                backgroundColor:
                  item.tipo === "clinica"
                    ? "#FFF2E1"
                    : item.tipo === "cita"
                    ? "#EAF3FD"
                    : "#E7F5EB",
              },
            ]}
          >
            <Text
              style={[
                styles.demoEstadoTexto,
                {
                  color:
                    item.tipo === "clinica"
                      ? "#B86A32"
                      : item.tipo === "cita"
                      ? "#287DBA"
                      : "#40966A",
                },
              ]}
            >
              {item.estado}
            </Text>
          </View>

          {item.prioridad && (
            <View style={styles.demoPrioridad}>
              <Text style={styles.demoPrioridadTexto}>
                Prioridad {item.prioridad}
              </Text>
            </View>
          )}

        </View>

        {/* Pie de la tarjeta */}
        <View style={styles.demoFooter}>

          <Text style={styles.demoFooterTexto}>
            {item.tipo === "clinica"
              ? "Vista previa de evaluación"
              : item.tipo === "cita"
              ? "Vista previa de cita"
              : "Registro de actividad"}
          </Text>

          <Ionicons
            name="arrow-forward"
            size={15}
            color="#216BB2"
          />

        </View>

      </View>

    ) : (

          // RECORDATORIOS REALES: CONSERVAMOS SU FUNCIONAMIENTO
          <TouchableOpacity
            key={item.id}
            style={[
              styles.cardSection,
              !item.leido && styles.noLeido,
            ]}
            onPress={() => marcarComoLeido(item.id)}
          >

            <View style={styles.optionRow}>
              <View style={styles.optionLeft}>

                <Ionicons
                  name={getIcon(item.tipo)}
                  size={22}
                  color={getColor(item.tipo)}
                />

                <View
                  style={{
                    marginLeft: 10,
                    flex: 1,
                  }}
                >

                  <Text style={styles.title}>
                    {item.titulo}
                  </Text>

                  <Text style={styles.message}>
                    {item.mensaje}
                  </Text>

                  <Text style={styles.date}>
                    {item.fecha}
                  </Text>

                </View>

              </View>

              {!item.leido && (
                <View style={styles.dot} />
              )}

            </View>

          </TouchableOpacity>

        )
      )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#f5f6fa" },

  containerSvg: {
    position: "absolute",
    top: 0,
    width: "100%",
  },

  headerContent: {
    marginTop: 95,
    alignItems: "center",
    marginBottom: 25,
    paddingHorizontal: 20,
  },

  headerTitleRow: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  headerSubtitle: {
    color: "#e0f2fe",
    fontSize: 14,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },

  cardSection: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  noLeido: {
    borderLeftWidth: 5,
    borderLeftColor: "#1E88E5",
  },

  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  optionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  title: {
    fontWeight: "bold",
    fontSize: 15,
  },

  message: {
    color: "#555",
    marginTop: 2,
  },

  date: {
    fontSize: 12,
    color: "#999",
    marginTop: 4,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1E88E5",
    marginLeft: 8,
  },

  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
    gap: 12,
  },

  emptyText: {
    color: "#6b7280",
    fontSize: 15,
    textAlign: "center",
  },

  resumenContainer: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignSelf: "center",
  width: "92%",
  maxWidth: 760,
  gap: 10,
  marginTop: 35,
  marginBottom: 25,
},

resumenCard: {
  flex: 1,
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E4EAF1",
  paddingVertical: 16,
  paddingHorizontal: 6,
  alignItems: "center",
  justifyContent: "center",

  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
},

resumenNumero: {
  fontSize: 25,
  fontWeight: "bold",
  color: "#26364A",
  marginTop: 8,
},

resumenTexto: {
  fontSize: 11,
  color: "#758397",
  textAlign: "center",
  marginTop: 4,
},

// Filtros de alertas

alertasFiltrosContainer: {
  width: "92%",
  maxWidth: 760,
  alignSelf: "center",
  marginBottom: 24,
},

alertasFiltrosTitulo: {
  fontSize: 18,
  fontWeight: "600",
  color: "#26364A",
  marginBottom: 16,
},

alertasFiltrosRow: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
},

alertasFiltroBoton: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#DFE5EE",
  borderRadius: 20,
  paddingVertical: 9,
  paddingHorizontal: 18,
  alignItems: "center",
  justifyContent: "center",
},

alertasFiltroActivo: {
  backgroundColor: "#216BB2",
  borderColor: "#216BB2",
},

alertasFiltroTexto: {
  fontSize: 13,
  color: "#64748B",
  fontWeight: "500",
},

alertasFiltroTextoActivo: {
  color: "#FFFFFF",
  fontWeight: "600",
},

// ------------------------------------
// TARJETAS DE DEMOSTRACIÓN
// ------------------------------------

demoCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E4EAF1",
  borderLeftWidth: 4,
  padding: 16,
  marginBottom: 14,

  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 3,
  },
  shadowOpacity: 0.05,
  shadowRadius: 6,
  elevation: 2,
},

demoHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 8,
  marginBottom: 12,
},

demoTipoRow: {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
},

demoTipo: {
  fontSize: 12,
  fontWeight: "600",
},

demoBadge: {
  backgroundColor: "#F1F3F7",
  color: "#718096",
  fontSize: 9,
  fontWeight: "700",
  paddingHorizontal: 6,
  paddingVertical: 3,
  borderRadius: 5,
  overflow: "hidden",
},

demoFecha: {
  fontSize: 11,
  color: "#8A95A5",
},

demoTitulo: {
  fontSize: 16,
  fontWeight: "700",
  color: "#26364A",
  marginBottom: 5,
},

demoPaciente: {
  fontSize: 12,
  fontWeight: "600",
  color: "#718096",
  marginBottom: 8,
},

demoMensaje: {
  fontSize: 13,
  color: "#586579",
  lineHeight: 19,
},

demoEtiquetas: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 13,
},

demoEstado: {
  borderRadius: 7,
  paddingHorizontal: 9,
  paddingVertical: 5,
},

demoEstadoTexto: {
  fontSize: 11,
  fontWeight: "600",
},

demoPrioridad: {
  backgroundColor: "#FFF5E7",
  borderRadius: 7,
  paddingHorizontal: 9,
  paddingVertical: 5,
},

demoPrioridadTexto: {
  fontSize: 11,
  color: "#B86A32",
  fontWeight: "600",
},

demoFooter: {
  flexDirection: "row",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 6,
  marginTop: 15,
  paddingTop: 12,
  borderTopWidth: 1,
  borderTopColor: "#EDF0F5",
},

demoFooterTexto: {
  fontSize: 12,
  fontWeight: "600",
  color: "#216BB2",
},
});