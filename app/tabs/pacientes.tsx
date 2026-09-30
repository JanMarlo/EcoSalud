import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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
import { Swipeable } from "react-native-gesture-handler";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { db } from "../../firebase";

type Registro = {
  id: string;
  nombre: string;
  uid?: string;
  edad: number;
  unidadEdad?: "años" | "meses";
  foto?: string;
  createdAt?: any;
  pacienteId?: string;
  esCompartido?: boolean;
  compartidoPor?: string;
};

export default function Registros() {
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

  const router = useRouter();
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState<Date | null>(null);
  const [mostrarPicker, setMostrarPicker] = useState(false);

  const [sharedIds, setSharedIds] = useState<{ pacienteId: string; ownerNombre: string }[]>([]);
  const [registrosCompartidos, setRegistrosCompartidos] = useState<Registro[]>([]);

  const obtenerFechaMs = (valor: any) => {
    if (!valor) return 0;
    if (typeof valor.toDate === "function") return valor.toDate().getTime();
    if (typeof valor.seconds === "number") return valor.seconds * 1000;
    if (valor instanceof Date) return valor.getTime();

    const fecha = new Date(valor).getTime();
    return Number.isFinite(fecha) ? fecha : 0;
  };


  // 🔥 REGISTROS PROPIOS
  useEffect(() => {
    const auth = getAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const q = query(
        collection(db, "registros"),
        where("uid", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const mapa = new Map<string, Registro>();

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as Registro;
          if (!data.pacienteId) return;

          const existente = mapa.get(data.pacienteId);
          const actual = data.createdAt?.seconds || 0;
          const anterior = existente?.createdAt?.seconds || 0;

          if (!existente || actual > anterior) {
            mapa.set(data.pacienteId, {
              ...data,
              id: docSnap.id,
            });
          }
        });

        setRegistros(
          Array.from(mapa.values()).sort(
            (a, b) => obtenerFechaMs(b.createdAt) - obtenerFechaMs(a.createdAt)
          )
        );
      });

      return () => unsubscribe();
    });

    return unsubscribeAuth;
  }, []);

  // 🔗 COMPARTIDOS
  useEffect(() => {
    const auth = getAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      const q = query(
        collection(db, "compartidos"),
        where("sharedWithUid", "==", user.uid)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const lista = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            pacienteId: data.pacienteId as string,
            ownerNombre: data.ownerNombre as string,
          };
        });
        setSharedIds(lista);
      });

      return () => unsubscribe();
    });

    return unsubscribeAuth;
  }, []);

  // 🔗 REGISTROS COMPARTIDOS
  useEffect(() => {
    if (sharedIds.length === 0) {
      setRegistrosCompartidos([]);
      return;
    }

    const ids = sharedIds.map((s) => s.pacienteId);

    const q = query(
      collection(db, "registros"),
      where("pacienteId", "in", ids.slice(0, 30))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapa = new Map<string, Registro>();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Registro;
        if (!data.pacienteId) return;

        const existente = mapa.get(data.pacienteId);
        const actual = data.createdAt?.seconds || 0;
        const anterior = existente?.createdAt?.seconds || 0;

        if (!existente || actual > anterior) {
          const shared = sharedIds.find((s) => s.pacienteId === data.pacienteId);

          mapa.set(data.pacienteId, {
            ...data,
            id: docSnap.id,
            esCompartido: true,
            compartidoPor: shared?.ownerNombre || "Otro doctor",
          });
        }
      });

      setRegistrosCompartidos(
        Array.from(mapa.values()).sort(
          (a, b) => obtenerFechaMs(b.createdAt) - obtenerFechaMs(a.createdAt)
        )
      );
    });

    return () => unsubscribe();
  }, [sharedIds]);

  const todosRegistros = [
    ...registros,
    ...registrosCompartidos.filter(
      (rc) => !registros.some((r) => r.pacienteId === rc.pacienteId)
    ),
  ].sort((a, b) => obtenerFechaMs(b.createdAt) - obtenerFechaMs(a.createdAt));

  const registrosFiltrados = todosRegistros.filter((p) => {
    const texto = busqueda.toLowerCase();
    const nombre = (p.nombre || "").toLowerCase();

    let fechaMatch = true;

    if (fechaFiltro && p.createdAt) {
      const fechaRegistro = new Date(obtenerFechaMs(p.createdAt));

      fechaMatch =
        fechaRegistro.getDate() === fechaFiltro.getDate() &&
        fechaRegistro.getMonth() === fechaFiltro.getMonth() &&
        fechaRegistro.getFullYear() === fechaFiltro.getFullYear();
    }

    return (nombre.includes(texto) || texto === "") && fechaMatch;
  });

  const eliminarPaciente = (item: Registro) => {
    if (item.esCompartido) {
      Alert.alert("No permitido", "No puedes eliminar un paciente compartido.");
      return;
    }

    Alert.alert("Eliminar paciente", "¿Seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        onPress: async () => {
          const pacienteId = item.pacienteId || item.id;

          const q = query(
            collection(db, "registros"),
            where("pacienteId", "==", pacienteId)
          );

          const snapshot = await getDocs(q);

          await Promise.all(
            snapshot.docs.map((d) =>
              deleteDoc(doc(db, "registros", d.id))
            )
          );
        },
      },
    ]);
  };

  const renderRightActions = (item: Registro) => (
    <TouchableOpacity
      style={styles.deleteSwipe}
      onPress={() => eliminarPaciente(item)}
    >
      <Ionicons name="trash" size={24} color="#fff" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.mainContainer}>
      <View style={styles.containerSvg}>
        <SvgTop />
      </View>

      <SafeAreaView style={styles.container}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Lista de Pacientes</Text>
          <Text style={styles.subtitle}>Registros recientes</Text>

        </View>

        {/* Barra de búsqueda */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" />
          <TextInput
            placeholder="Buscar paciente..."
            placeholderTextColor="#6b7280"
            value={busqueda}
            onChangeText={setBusqueda}
            style={styles.searchInput}
          />
          <TouchableOpacity onPress={() => setMostrarPicker(true)}>
            <Ionicons
              name="calendar-outline"
              size={22}
              color={fechaFiltro ? "#1E88E5" : "#6b7280"}
            />
          </TouchableOpacity>
          {fechaFiltro && (
            <TouchableOpacity onPress={() => setFechaFiltro(null)} style={{ marginLeft: 8 }}>
              <Ionicons name="close-circle" size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>

        {mostrarPicker && (
          <DateTimePicker
            value={fechaFiltro || new Date()}
            mode="date"
            display="default"
            onChange={(_, date) => {
              setMostrarPicker(false);
              if (date) setFechaFiltro(date);
            }}
          />
        )}

        <FlatList
          data={registrosFiltrados}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay pacientes registrados</Text>
          }
          renderItem={({ item }) => (
            <Swipeable renderRightActions={() => renderRightActions(item)}>
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push(`/patient-profile?id=${item.pacienteId}`)
                }
              >
                <View style={styles.row}>
                  <View style={styles.avatar}>
                    {item.foto ? (
                      <Image source={{ uri: item.foto }} style={styles.avatarImg} />
                    ) : (
                      <Ionicons name="person" size={24} color="#fff" />
                    )}
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre}>{item.nombre}</Text>
                    <Text style={styles.fecha}>
                      {item.edad} {item.unidadEdad || "años"}
                    </Text>
                    {item.createdAt && (
                      <Text style={styles.fecha}>
                        📅{" "}
                        {new Date(obtenerFechaMs(item.createdAt)).toLocaleDateString("es-MX")}
                      </Text>
                    )}
                    {item.esCompartido && (
                      <View style={styles.sharedBadge}>
                        <Ionicons name="people-outline" size={11} color="#1E88E5" />
                        <Text style={styles.sharedBadgeText}>
                          Compartido por {item.compartidoPor}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            </Swipeable>
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 18,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    marginTop: 30,
  },

  searchInput: {
    marginLeft: 8,
    flex: 1,
    paddingVertical: 10,
  },

  card: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 3,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#fff",
    marginRight: 12,
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  nombre: {
    fontWeight: "bold",
    fontSize: 16,
  },

  fecha: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },

  deleteSwipe: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 12,
    marginBottom: 12,
  },

  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },

  containerSvg: {
    position: "absolute",
    top: 0,
    width: "100%",
  },

  headerContent: {
    marginTop: 80,
    alignItems: "center",
    marginBottom: 15,
  },

  subtitle: {
    color: "#e0f2fe",
    fontSize: 13,
  },

  emptyText: {
    textAlign: "center",
    marginTop: 30,
    color: "#6b7280",
    fontSize: 14,
  },

  sharedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
    alignSelf: "flex-start",
    gap: 4,
  },

  sharedBadgeText: {
    fontSize: 11,
    color: "#1E88E5",
    fontWeight: "600",
  },
});
