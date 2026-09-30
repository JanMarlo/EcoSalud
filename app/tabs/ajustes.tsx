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

export default function Notificaciones() {
  const router = useRouter();
  const [notificaciones, setNotificaciones] = useState<any[]>([]);

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

  const HeaderOla = () => (
    <>
      <View style={styles.containerSvg}>
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
      </View>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Recordatorios</Text>
        <Text style={styles.headerSubtitle}>Centro de alertas y actividad</Text>
      </View>
    </>
  );

  return (
    <View style={styles.mainContainer}>
      <HeaderOla />
      <ScrollView>
        <View style={styles.content}>
          {notificaciones.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-off-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No hay recordatorios próximos</Text>
            </View>
          ) : (
            notificaciones.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.cardSection, !item.leido && styles.noLeido]}
                onPress={() => marcarComoLeido(item.id)}
              >
                <View style={styles.optionRow}>
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name={getIcon(item.tipo)}
                      size={22}
                      color={getColor(item.tipo)}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.title}>{item.titulo}</Text>
                      <Text style={styles.message}>{item.mensaje}</Text>
                      <Text style={styles.date}>{item.fecha}</Text>
                    </View>
                  </View>
                  {!item.leido && <View style={styles.dot} />}
                </View>
              </TouchableOpacity>
            ))
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
    marginTop: 100,
    alignItems: "center",
    marginBottom: 15,
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
    paddingTop: 35,
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
});
