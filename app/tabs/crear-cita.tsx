import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import { addDoc, collection, getDocs, onSnapshot, query, where } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { db } from "../../firebase";

const { width } = Dimensions.get("window");
const HEADER_HEIGHT = 220;

export default function CrearCita() {
  const router = useRouter();

  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState<any>(null);
  const [busqueda, setBusqueda] = useState("");

  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState(new Date());
  const [mostrarHora, setMostrarHora] = useState(false);
  const [motivo, setMotivo] = useState("");

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
        <Text style={styles.headerTitle}>Crear Cita</Text>
        <Text style={styles.headerSubtitle}>Agenda una nueva consulta</Text>
      </View>
    </>
  );

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(
      collection(db, "registros"),
      where("uid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapa = new Map();

      snapshot.docs.forEach((docItem) => {
        const data = docItem.data();

        if (!data.pacienteId) return;

        if (
          !mapa.has(data.pacienteId) ||
          (data.createdAt?.seconds || 0) >
            (mapa.get(data.pacienteId).createdAt?.seconds || 0)
        ) {
          mapa.set(data.pacienteId, {
            id: data.pacienteId,
            nombre: data.nombre,
            foto: data.foto || null,
          });
        }
      });

      setPacientes(Array.from(mapa.values()));
    });

    return () => unsubscribe();
  }, []);

  // 🔗 Pacientes compartidos conmigo
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  const [pacientesCompartidos, setPacientesCompartidos] = useState<any[]>([]);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(
      collection(db, "compartidos"),
      where("sharedWithUid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map((d) => d.data().pacienteId as string);
      setSharedIds(ids);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (sharedIds.length === 0) {
      setPacientesCompartidos([]);
      return;
    }

    const q = query(
      collection(db, "registros"),
      where("pacienteId", "in", sharedIds.slice(0, 30))
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapa = new Map();

      snapshot.docs.forEach((docItem) => {
        const data = docItem.data();
        if (!data.pacienteId) return;

        if (
          !mapa.has(data.pacienteId) ||
          (data.createdAt?.seconds || 0) >
            (mapa.get(data.pacienteId).createdAt?.seconds || 0)
        ) {
          mapa.set(data.pacienteId, {
            id: data.pacienteId,
            nombre: data.nombre,
            foto: data.foto || null,
            esCompartido: true,
          });
        }
      });

      setPacientesCompartidos(Array.from(mapa.values()));
    });

    return () => unsubscribe();
  }, [sharedIds]);

  const todosPacientes = [
    ...pacientes,
    ...pacientesCompartidos.filter(
      (pc) => !pacientes.some((p) => p.id === pc.id)
    ),
  ];

  useFocusEffect(
  useCallback(() => {
    setPacienteSeleccionado(null);
    setBusqueda("");
    setFecha("");
    setHora(new Date());
    setMotivo("");
  }, [])
  );

  const pacientesFiltrados = todosPacientes.filter((p) =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase())
  );

   const guardarCita = async () => {
    const user = getAuth().currentUser;

    // 🔹 1. Validaciones básicas
    if (!user) {
      Alert.alert("Error", "No hay usuario autenticado");
      return;
    }

    if (!pacienteSeleccionado) {
      Alert.alert("Error", "Selecciona un paciente");
      return;
    }

    if (!fecha) {
      Alert.alert("Error", "Selecciona una fecha");
      return;
    }

    try {
      // 🔹 2. Construir fecha completa
      const [year, month, day] = fecha.split("-");

      const fechaCita = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        hora.getHours(),
        hora.getMinutes()
      );

      // 🔹 3. Validar pasado
      if (fechaCita < new Date()) {
        Alert.alert("Error", "No puedes agendar en el pasado");
        return;
      }

      // 🔹 4. Validar horario
      const horaSeleccionada = fechaCita.getHours();

      if (horaSeleccionada < 8 || horaSeleccionada >= 20) {
        Alert.alert("Error", "Horario fuera de servicio (8:00 - 20:00)");
        return;
      }

      const citasRef = collection(db, "citas");

      // 🔹 5. Validar duplicado exacto
      const horaString = hora.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      const q = query(
        citasRef,
        where("uid", "==", user.uid),
        where("fecha", "==", fecha),
        where("hora", "==", horaString)
      );

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        Alert.alert("Error", "Ya tienes una cita en ese horario");
        return;
      }

      // 🔹 6. Validar intervalo (30 min)
      const q2 = query(
        citasRef,
        where("uid", "==", user.uid),
        where("fecha", "==", fecha)
      );

      const snapshot2 = await getDocs(q2);

      const nuevaFecha = fechaCita.getTime();

      for (const docSnap of snapshot2.docs) {
        const existente = new Date(docSnap.data().fechaCita).getTime();

        const diferenciaMin = Math.abs(nuevaFecha - existente) / (1000 * 60);

        if (diferenciaMin < 30) {
          Alert.alert("Error", "Debe haber al menos 30 minutos entre citas");
          return;
        }
      }

      // 🔹 7. Guardar
      const recordatorio = new Date(fechaCita);
      recordatorio.setMinutes(recordatorio.getMinutes() - 30);

      await addDoc(citasRef, {
        nombrePaciente: pacienteSeleccionado.nombre,
        pacienteId: pacienteSeleccionado.id,
        foto: pacienteSeleccionado.foto || "",
        fecha,
        hora: horaString,
        motivo: motivo.trim(),
        estado: "pendiente",
        uid: user.uid,
        createdAt: new Date(),
        recordatorio: recordatorio.toISOString(),
        fechaCita: fechaCita.toISOString(),
      });

      Alert.alert("Éxito", "Cita creada");

      // 🔥 LIMPIAR TODO EL FORMULARIO
        setPacienteSeleccionado(null);
        setBusqueda("");
        setFecha("");
        setHora(new Date());
        setMotivo("");

        // 🔙 regresar
        router.back();

    } catch (error) {
      Alert.alert("Error", "No se pudo guardar la cita");
      Alert.alert("Error", "No se pudo crear la cita");
    }
  };

  return (
    <View style={styles.mainContainer}>
      <HeaderOla />

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{
        paddingTop: HEADER_HEIGHT,
        paddingBottom: 40,
          }}
          >

          <View style={styles.content}>

          <View style={[styles.cardSection, { marginTop: 10 }]}>
            <Text style={styles.section}>SELECCIONAR PACIENTE</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={22} color="#6b7280" />
              <TextInput
                placeholder="Buscar paciente..."
                placeholderTextColor="#6b7280"
                value={busqueda}
                onChangeText={setBusqueda}
                style={styles.searchInput}
              />
            </View>


            <View style={{ maxHeight: 180 }}>
               <ScrollView
               nestedScrollEnabled={true} 
               showsVerticalScrollIndicator={false}>
              {pacientesFiltrados.map((p) => {
                const seleccionado = pacienteSeleccionado?.id === p.id;

                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.pacienteItem,
                      seleccionado && styles.selectedPaciente,
                    ]}
                    onPress={() => {
                    if (pacienteSeleccionado?.id === p.id) {
                        setPacienteSeleccionado(null); // 👈 deselecciona
                      } else {
                        setPacienteSeleccionado(p); // 👈 selecciona
                      }
                    }}
                  >

                    <View style={styles.avatar}>
                      {p.foto ? (
                     <Image source={{ uri: p.foto }} style={styles.avatarImg} />
                    ) : (
                <Ionicons
                 name="person"
                size={22}
                color={seleccionado ? "#1E88E5" : "#fff"}
                />
                 )}
                </View>
                  
                    <Text
                      style={[
                        styles.pacienteText,
                        seleccionado && styles.selectedPacienteText,
                      ]}
                    >
                      {p.nombre}
                    </Text>

                    {p.esCompartido && !seleccionado && (
                      <View style={{ backgroundColor: "#eff6ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginRight: 6 }}>
                        <Text style={{ fontSize: 10, color: "#1E88E5", fontWeight: "600" }}>🔗</Text>
                      </View>
                    )}

                    {seleccionado && (
                      <Ionicons name="checkmark-circle" size={22} color="#fff" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

          <View style={styles.cardSection}>
            <Text style={styles.section}>SELECCIONAR FECHA</Text>

            <View style={styles.calendarWrapper}>
              <Calendar
                onDayPress={(day) => setFecha(day.dateString)}
                markedDates={{
                  [fecha]: { selected: true, selectedColor: "#1E88E5" },
                }}
                theme={{
                  todayTextColor: "#1E88E5",
                  arrowColor: "#1E88E5",
                  selectedDayBackgroundColor: "#1E88E5",
                  monthTextColor: "#111827",
                  textMonthFontWeight: "bold",
                }}
              />
            </View>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.section}>HORA Y MOTIVO</Text>

            <Text style={styles.label}>Hora</Text>
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setMostrarHora(true)}
            >
              <Ionicons name="time-outline" size={22} color="#1E88E5" />
              <Text style={styles.timeText}>
                {hora.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </TouchableOpacity>
            
            {mostrarHora && (
              <DateTimePicker
                value={hora}
                mode="time"
                is24Hour={false}
                display="default"
                onChange={(event, selectedDate) => {
                  setMostrarHora(false);
                  if (event.type === "dismissed") return;
                  if (selectedDate) setHora(selectedDate);
                }}
              />
            )}

            <Text style={styles.label}>Motivo de la cita</Text>
            <TextInput
              placeholder="Ej. Consulta general, seguimiento, revisión..."
              placeholderTextColor="#6b7280"
              style={styles.textArea}
              multiline
              value={motivo}
              onChangeText={setMotivo}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={guardarCita}>
            <Text style={styles.saveText}>Guardar Cita</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },

  containerSvg: {
    position: "absolute",
    top: 0,
    width: "100%",
    zIndex: 3,
  },

  headerContent: {
   position: "absolute",
  top: 95,
  left: 0,     
  right: 0,    
  alignItems: "center",
  zIndex: 4,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },

  headerSubtitle: {
    color: "#e0f2fe",
    fontSize: 14,
    marginTop: 4,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop:35,
    marginBottom: 15,
  },

  back: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  screenTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  cardSection: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  section: {
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 12,
    color: "#111827",
    letterSpacing: 0.5,
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 12,
    height: 50,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  searchInput: {
    marginLeft: 10,
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },

  pacienteItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  selectedPaciente: {
    backgroundColor: "#1E88E5",
    borderColor: "#1E88E5",
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },

  pacienteText: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },

  selectedPacienteText: {
    color: "#fff",
  },

  calendarWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  label: {
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    marginTop: 6,
  },

  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 14,
  },

  timeText: {
    marginLeft: 10,
    color: "#111827",
    fontWeight: "700",
    fontSize: 15,
  },

  textArea: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 14,
    height: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  saveButton: {
    backgroundColor: "#1E88E5",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 30,
    elevation: 4,
  },

  saveText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },

  backContainer: {
  position: "absolute",
  top: 60,
  left: 20,
  zIndex: 10,
  },

  avatarImg: {
  width: "100%",
  height: "100%",
  },
});
