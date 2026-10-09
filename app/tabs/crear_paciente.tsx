import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
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
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { db } from "../../firebase";
import { evaluarYGuardar } from "../../lib/agente/persistencia";
import { sintomasData } from "../../lib/catalogoSintomas";

const { width } = Dimensions.get("window");
const HEADER_HEIGHT = 200;
const TIEMPO_MAX_CONSULTA_MS = 30 * 60 * 1000;

const obtenerFechaMs = (valor: any) => {
  if (!valor) return 0;
  if (typeof valor.toDate === "function") return valor.toDate().getTime();
  if (typeof valor.seconds === "number") return valor.seconds * 1000;
  if (valor instanceof Date) return valor.getTime();

  const fecha = new Date(valor).getTime();
  return Number.isFinite(fecha) ? fecha : 0;
};

export default function NuevoRegistro() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const pacienteIdParam =
    typeof params.pacienteId === "string" ? params.pacienteId : undefined;
  const citaId = typeof params.citaId === "string" ? params.citaId : undefined;
  const enConsulta = params.enConsulta === "true" && !!citaId;

  const [modoSeleccion, setModoSeleccion] = useState(true);
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacientesExistentes, setPacientesExistentes] = useState<any[]>([]);
  const [imagen, setImagen] = useState<string | null>(null);
  const navigation = useNavigation();
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [citaEstado, setCitaEstado] = useState<string | null>(null);
  const [citaStartAt, setCitaStartAt] = useState<any>(null);

  useEffect(() => {
    if (citaEstado === "atendido" || citaEstado === "cancelado") {
      setPacienteId(null);
      setModoSeleccion(true);

      limpiarFormulario();
      setCitaStartAt(null);
    }
  }, [citaEstado]);
  const finalPacienteId = pacienteIdParam ?? pacienteId;
  const [nombre, setNombre] = useState("");
  const [edad, setEdad] = useState("");
  const [unidadEdad, setUnidadEdad] = useState<"años" | "meses">("años");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [presion, setPresion] = useState("");

  const [sintomasSeleccionados, setSintomasSeleccionados] = useState<string[]>(
    [],
  );
  const [otrosSintomas, setOtrosSintomas] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [busquedaSintoma, setBusquedaSintoma] = useState("");
  const guardandoRef = useRef(false);

  // Catálogo movido a lib/catalogoSintomas.ts (lo comparte el agente de IA)

  const HeaderOla = ({
    titulo,
    subtitulo,
  }: {
    titulo: string;
    subtitulo: string;
  }) => (
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
        <Text style={styles.headerTitle}>{titulo}</Text>
        <Text style={styles.headerSubtitle}>{subtitulo}</Text>
      </View>
    </>
  );

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(collection(db, "registros"), where("uid", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapa = new Map();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();

        if (!data.pacienteId) return;

        if (
          !mapa.has(data.pacienteId) ||
          (data.createdAt?.seconds || 0) >
            (mapa.get(data.pacienteId).createdAt?.seconds || 0)
        ) {
          mapa.set(data.pacienteId, {
            id: docSnap.id,
            ...data,
          });
        }
      });

      setPacientesExistentes(Array.from(mapa.values()));
    });

    return () => unsubscribe();
  }, []);

  // 🔗 Listener pacientes compartidos conmigo
  const [sharedIds, setSharedIds] = useState<string[]>([]);
  const [pacientesCompartidos, setPacientesCompartidos] = useState<any[]>([]);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    const q = query(
      collection(db, "compartidos"),
      where("sharedWithUid", "==", user.uid),
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
      where("pacienteId", "in", sharedIds.slice(0, 30)),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mapa = new Map();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.pacienteId) return;

        if (
          !mapa.has(data.pacienteId) ||
          (data.createdAt?.seconds || 0) >
            (mapa.get(data.pacienteId).createdAt?.seconds || 0)
        ) {
          mapa.set(data.pacienteId, {
            id: docSnap.id,
            ...data,
            esCompartido: true,
          });
        }
      });

      setPacientesCompartidos(Array.from(mapa.values()));
    });

    return () => unsubscribe();
  }, [sharedIds]);

  // Combinar propios + compartidos
  const todosPacientes = [
    ...pacientesExistentes,
    ...pacientesCompartidos.filter(
      (pc) => !pacientesExistentes.some((p) => p.pacienteId === pc.pacienteId),
    ),
  ];

  useEffect(() => {
    if (!pacienteIdParam || citaEstado === "atendido" || citaEstado === "cancelado") return;

    setPacienteId(pacienteIdParam);
    setModoSeleccion(false);
  }, [pacienteIdParam, citaEstado]);

  useFocusEffect(
    useCallback(() => {
      // 🔥 Si NO hay pacienteId en params, limpiar TODO
      if (!pacienteIdParam) {
        // Limpiar estados del formulario
        setPacienteId(null);
        setNombre("");
        setEdad("");
        setUnidadEdad("años");
        setAltura("");
        setPeso("");
        setTemperatura("");
        setPresion("");
        setSintomasSeleccionados([]);
        setOtrosSintomas("");
        setDiagnostico("");
        setRecomendaciones("");
        setImagen(null);

        // Limpiar UI
        limpiarFormulario();
        setModoSeleccion(true);
        setBusquedaPaciente("");
        setErrores({});
      }
    }, [pacienteIdParam]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (citaEstado !== "en consulta") return;
      e.preventDefault();

      Alert.alert(
        "Consulta en curso",
        "Debes finalizar la consulta antes de salir",
        [
          {
            text: "Volver",
            onPress: () => {
              router.replace({
                pathname: "/tabs/crear_paciente",
                params: {
                  pacienteId: pacienteIdParam,
                  citaId,
                  enConsulta: "false",
                },
              });
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation, enConsulta, pacienteIdParam, citaId, citaEstado]);

  useEffect(() => {
    if (
      !pacienteIdParam ||
      citaEstado === "atendido" ||
      citaEstado === "cancelado" ||
      citaEstado === null
    ) {
      return;
    }

    if (pacientesExistentes.length > 0) {
      const paciente = pacientesExistentes.find(
        (p) => p.pacienteId === pacienteIdParam,
      );

      if (paciente) {
        seleccionarPaciente(paciente);
      }
    }
  }, [pacienteIdParam, pacientesExistentes, citaEstado]);

  useEffect(() => {
    if (!enConsulta) return;

    if (pacienteIdParam) {
      setModoSeleccion(false);
    }
  }, [enConsulta, pacienteIdParam]);

  useEffect(() => {
    if (!citaId) return;

    const unsub = onSnapshot(doc(db, "citas", citaId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCitaEstado((data.estado || "").toLowerCase().trim());
        setCitaStartAt(data.startAt || null);
      }
    });

    return () => unsub();
  }, [citaId]);

  useEffect(() => {
    if (!citaId || citaEstado !== "en consulta") return;

    const inicio = obtenerFechaMs(citaStartAt);
    if (!inicio) return;

    const cancelarConsultaVencida = async () => {
      if (Date.now() - inicio < TIEMPO_MAX_CONSULTA_MS) return;

      try {
        await updateDoc(doc(db, "citas", citaId), {
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
  }, [citaId, citaEstado, citaStartAt]);

  const pacientesFiltrados = todosPacientes.filter((p) =>
    p.nombre?.toLowerCase().includes(busquedaPaciente.toLowerCase()),
  );

  const normalizarTexto = (texto: string) => {
    return texto
      .toLowerCase()
      .normalize("NFD") // separa acentos
      .replace(/[\u0300-\u036f]/g, ""); // elimina acentos
  };

  const seleccionarPaciente = (p: any) => {
    // 🚫 BLOQUEO CRÍTICO
    if (
      citaEstado === "en consulta" &&
      pacienteIdParam &&
      p.pacienteId !== pacienteIdParam
    ) {
      Alert.alert(
        "Consulta en curso",
        "Debes finalizar la consulta actual antes de cambiar de paciente",
      );
      return;
    }

    setPacienteId(p.pacienteId);

    setNombre(p.nombre || "");
    setEdad(p.edad?.toString() || "");
    setAltura(p.altura?.toString() || "");
    setImagen(p.foto || null);
    setUnidadEdad(p.unidadEdad || "años");

    setPeso("");
    setTemperatura("");
    setPresion("");
    setSintomasSeleccionados([]);
    setOtrosSintomas("");
    setDiagnostico("");
    setRecomendaciones("");

    setModoSeleccion(false);
  };

  useEffect(() => {
    if (citaEstado === "atendido") {
      router.replace("/tabs/citas");
      return;
    }

    if (citaEstado === "cancelado") {
      Alert.alert(
        "Consulta cancelada",
        "Pasaron 30 minutos sin guardar la consulta. La cita fue cancelada automáticamente."
      );
      router.replace("/tabs/citas");
    }
  }, [citaEstado]);

  const crearNuevoPaciente = () => {
    if (citaEstado === "en consulta") {
      Alert.alert(
        "Consulta en curso",
        "Debes finalizar la consulta actual antes de crear un nuevo paciente",
      );
      return;
    }

    // reset limpio
    setPacienteId(null);
    setImagen(null);
    setNombre("");
    setEdad("");
    setUnidadEdad("años");
    setAltura("");
    setPeso("");
    setTemperatura("");
    setPresion("");
    setSintomasSeleccionados([]);
    setOtrosSintomas("");
    setDiagnostico("");
    setRecomendaciones("");
    setErrores({});

    setModoSeleccion(false);
  };

  const validarFormulario = () => {
    const nuevosErrores: Record<string, string> = {};

    if (!nombre.trim()) nuevosErrores.nombre = "El nombre es obligatorio.";

    const edadNum = Number(edad);
    if (!edad.trim()) {
      nuevosErrores.edad = "La edad es obligatoria.";
    } else if (isNaN(edadNum) || edadNum <= 0) {
      nuevosErrores.edad = "Edad inválida.";
    } else if (unidadEdad === "años" && edadNum > 120) {
      nuevosErrores.edad = "Máximo 120 años.";
    } else if (unidadEdad === "meses" && edadNum > 24) {
      nuevosErrores.edad = "Máximo 24 meses.";
    }

    const alturaNum = Number(altura);
    if (!altura.trim()) {
      nuevosErrores.altura = "La altura es obligatoria.";
    } else if (isNaN(alturaNum) || alturaNum < 30 || alturaNum > 250) {
      nuevosErrores.altura = "Ingresa una altura válida en cm.";
    }

    const pesoNum = Number(peso);
    if (!peso.trim()) {
      nuevosErrores.peso = "El peso es obligatorio.";
    } else if (isNaN(pesoNum) || pesoNum <= 0 || pesoNum > 400) {
      nuevosErrores.peso = "Ingresa un peso válido.";
    }

    const temperaturaNum = Number(temperatura);
    if (!temperatura.trim()) {
      nuevosErrores.temperatura = "La temperatura es obligatoria.";
    } else if (
      isNaN(temperaturaNum) ||
      temperaturaNum < 30 ||
      temperaturaNum > 45
    ) {
      nuevosErrores.temperatura = "Ingresa una temperatura válida.";
    }

    if (!presion.trim()) {
      nuevosErrores.presion = "La presión es obligatoria.";
    } else if (!/^\d{2,3}\/\d{2,3}$/.test(presion.trim())) {
      nuevosErrores.presion = "Usa el formato 120/80.";
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const guardarRegistro = async () => {
    if (guardandoRef.current) return;
    guardandoRef.current = true;

    let finalPacienteId = pacienteId ?? pacienteIdParam;

    // 🔥 SI ES PACIENTE NUEVO → GENERAR ID
    if (!finalPacienteId) {
      finalPacienteId = doc(collection(db, "pacientes")).id;
    }
    const user = getAuth().currentUser;

    if (!user) {
      Alert.alert("Error", "No hay usuario autenticado");
      guardandoRef.current = false; // 🔥 FALTA ESTO
      return;
    }

    if (citaId && citaEstado === "cancelado") {
      Alert.alert(
        "Consulta cancelada",
        "Esta consulta ya fue cancelada por exceder el tiempo permitido."
      );
      guardandoRef.current = false;
      return;
    }

    if (!validarFormulario()) {
      Alert.alert("Error", "Corrige los campos marcados");
      guardandoRef.current = false; // 🔥 liberar bloqueo
      return;
    }

    // 🚫 VALIDACIÓN CRÍTICA
    if (
      citaEstado === "en consulta" &&
      pacienteIdParam &&
      finalPacienteId !== pacienteIdParam
    ) {
      Alert.alert(
        "Error",
        "No puedes guardar una consulta en un paciente diferente al de la cita",
      );
      guardandoRef.current = false;
      return;
    }

    try {
      let urlFoto = imagen || "";

      if (imagen && !imagen.startsWith("http")) {
        const data = new FormData();

        data.append("file", {
          uri: imagen,
          type: "image/jpeg",
          name: "foto.jpg",
        } as any);

        data.append("upload_preset", "ecosalud");

        const res = await fetch(
          "https://api.cloudinary.com/v1_1/qhxxplvk/image/upload",
          {
            method: "POST",
            body: data,
          },
        );

        const json = await res.json();

        if (json.secure_url) {
          urlFoto = json.secure_url;
        }
      }

      const batch = writeBatch(db);
      const refRegistro = doc(collection(db, "registros"));

      const safeNumber = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        nombre: nombre.trim(),
        edad: safeNumber(edad),
        unidadEdad: unidadEdad ?? "años",
        altura: safeNumber(altura),
        peso: safeNumber(peso),
        temperatura: safeNumber(temperatura),
        presion: presion?.trim() ?? "",
        sintomas: [
          ...sintomasSeleccionados,
          ...(otrosSintomas?.trim() ? [otrosSintomas.trim()] : []),
        ],
        diagnostico: diagnostico?.trim() ?? "",
        recomendaciones: recomendaciones?.trim() ?? "",
        foto: urlFoto ?? "",
        pacienteId: finalPacienteId ?? null,
        citaId: citaId ?? null,
        uid: user.uid,
        createdAt: serverTimestamp(),
      };

      batch.set(refRegistro, payload);

      if (citaId) {
        batch.update(doc(db, "citas", citaId), {
          estado: "atendido",
        });
      }

      await batch.commit();

      // 🤖 Agente de IA: evaluar la consulta recién guardada
      let evaluacionId: string | null = null;
      try {
        const resultado = await evaluarYGuardar({
          consulta: { ...payload, id: refRegistro.id, createdAt: null },
          registroId: refRegistro.id,
          uid: user.uid,
        });
        evaluacionId = resultado.id;
      } catch (e) {
        console.warn("El agente no pudo evaluar la consulta", e);
      }

      if (!evaluacionId) {
        Alert.alert("Éxito", "Registro guardado correctamente");
      }

      // 🔥 limpiar TODO
      setPacienteId(null);
      setModoSeleccion(true);
      setBusquedaPaciente("");
      setImagen(null);

      setNombre("");
      setEdad("");
      setUnidadEdad("años");
      setAltura("");
      setPeso("");
      setTemperatura("");
      setPresion("");

      setSintomasSeleccionados([]);
      setOtrosSintomas("");
      setDiagnostico("");
      setRecomendaciones("");

      setErrores({});

      setCitaEstado(null);

      setTimeout(() => {
        if (evaluacionId) {
          router.replace({
            pathname: "/evaluacion",
            params: { id: evaluacionId, origen: "consulta", deCita: citaId ? "true" : "false" },
          });
        } else {
          router.replace("/tabs/citas");
        }
      }, 300);
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar el registro");
    } finally {
      guardandoRef.current = false;
    }
  };

  const toggleSintoma = (sintoma: string) => {
    if (sintomasSeleccionados.includes(sintoma)) {
      setSintomasSeleccionados(
        sintomasSeleccionados.filter((s) => s !== sintoma),
      );
    } else {
      setSintomasSeleccionados([...sintomasSeleccionados, sintoma]);
    }
  };

  const seleccionarImagen = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permiso.granted) {
      Alert.alert("Permiso requerido", "Debes permitir acceso a fotos");
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!resultado.canceled) {
      setImagen(resultado.assets[0].uri);
    }
  };

  const actualizarEstado = async (citaId: string, estado: string) => {
    try {
      await updateDoc(doc(db, "citas", citaId), {
        estado,
      });
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el estado");
    }
  };

  const limpiarFormulario = useCallback(() => {
    setImagen(null);
    setNombre("");
    setEdad("");
    setUnidadEdad("años");
    setAltura("");
    setPeso("");
    setTemperatura("");
    setPresion("");
    setSintomasSeleccionados([]);
    setOtrosSintomas("");
    setDiagnostico("");
    setRecomendaciones("");
    setErrores({});
  }, []);

  if (modoSeleccion) {
    return (
      <View style={styles.mainContainer}>
        <HeaderOla
          titulo="Nueva Consulta"
          subtitulo="Selecciona o crea un paciente"
        />

        <View style={[styles.content, { paddingTop: HEADER_HEIGHT }]}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={24} color="#6b7280" />
            <TextInput
              placeholder="Buscar paciente..."
              placeholderTextColor="#6b7280"
              value={busquedaPaciente}
              onChangeText={setBusquedaPaciente}
              style={styles.searchInput}
            />
          </View>

          <View style={{ flex: 1 }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 20 }}
            >
              {pacientesFiltrados.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.cardPaciente}
                  onPress={() => seleccionarPaciente(p)}
                >
                  <View style={styles.patientRow}>
                    <View style={styles.avatar}>
                      {p.foto ? (
                        <Image
                          source={{ uri: p.foto }}
                          style={styles.avatarImg}
                        />
                      ) : (
                        <Ionicons name="person" size={28} color="#fff" />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.nombre}>{p.nombre}</Text>
                      <Text style={styles.edadTexto}>
                        {p.edad} {p.unidadEdad || "años"}
                      </Text>

                      {p.esCompartido && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#eff6ff",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 8,
                            marginTop: 4,
                            alignSelf: "flex-start",
                            gap: 4,
                          }}
                        >
                          <Ionicons name="link" size={12} color="#1E88E5" />
                          <Text
                            style={{
                              fontSize: 11,
                              color: "#1E88E5",
                              fontWeight: "600",
                            }}
                          >
                            Compartido
                          </Text>
                        </View>
                      )}

                      {citaEstado === "en consulta" &&
                        p.pacienteId === pacienteIdParam && (
                          <Text
                            style={{
                              color: "#ef4444",
                              fontWeight: "bold",
                              marginTop: 4,
                            }}
                          >
                            EN CONSULTA
                          </Text>
                        )}
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={22}
                      color="#9ca3af"
                    />
                  </View>
                </TouchableOpacity>
              ))}
              {pacientesFiltrados.length === 0 && (
                <Text
                  style={{
                    textAlign: "center",
                    color: "#6b7280",
                    marginTop: 20,
                  }}
                >
                  No hay pacientes registrados
                </Text>
              )}
            </ScrollView>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { marginTop: 10 }]}
            onPress={crearNuevoPaciente}
          >
            <Text style={styles.saveText}>Nuevo Paciente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <HeaderOla
        titulo={pacienteId ? "Nueva Consulta" : "Nuevo Registro"}
        subtitulo="Completa los datos del paciente"
      />

      {!modoSeleccion && (
        <View style={styles.backContainer}>
          <TouchableOpacity
            onPress={() => {
              if (citaEstado !== "en consulta") {
                limpiarFormulario();
                setPacienteId(null);
              }

              setModoSeleccion(true);
            }}
          >
            <Text style={styles.back}>Atrás</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: HEADER_HEIGHT, paddingBottom: 40 }}
      >
        <View style={styles.content}>
          <View style={styles.photoSection}>
            <View style={styles.photoWrapper}>
              <View style={styles.photoCircle}>
                {imagen ? (
                  <Image source={{ uri: imagen }} style={styles.photo} />
                ) : (
                  <Ionicons name="image-outline" size={50} color="#d0d0d0" />
                )}
              </View>

              <TouchableOpacity
                style={styles.cameraButton}
                onPress={seleccionarImagen}
              >
                <Ionicons name="camera" size={22} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.photoLabel}>Foto del Paciente</Text>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.section}>DATOS DEL PACIENTE</Text>

            <View style={styles.row}>
              <View style={styles.fieldWrapper}>
                <TextInput
                  placeholder="Nombre completo"
                  placeholderTextColor="#6b7280"
                  style={[
                    styles.inputHalf,
                    errores.nombre && styles.inputError,
                  ]}
                  value={nombre}
                  onChangeText={setNombre}
                />
                {errores.nombre && (
                  <Text style={styles.errorText}>{errores.nombre}</Text>
                )}
              </View>

              <View style={styles.fieldWrapper}>
                <View style={{ position: "relative" }}>
                  <TextInput
                    placeholder="Edad"
                    placeholderTextColor="#6b7280"
                    style={[
                      styles.inputHalf,
                      { paddingRight: 75 },
                      errores.edad && styles.inputError,
                    ]}
                    value={edad}
                    onChangeText={setEdad}
                    keyboardType="numeric"
                  />

                  <TouchableOpacity
                    style={styles.unitSelector}
                    onPress={() =>
                      setUnidadEdad(unidadEdad === "años" ? "meses" : "años")
                    }
                  >
                    <Text style={styles.unitText}>{unidadEdad}</Text>
                  </TouchableOpacity>
                </View>

                {errores.edad && (
                  <Text style={styles.errorText}>{errores.edad}</Text>
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.fieldWrapper}>
                <View style={{ position: "relative" }}>
                  <TextInput
                    placeholder="Altura"
                    placeholderTextColor="#6b7280"
                    style={[
                      styles.inputHalf,
                      { paddingRight: 45 },
                      errores.altura && styles.inputError,
                    ]}
                    value={altura}
                    onChangeText={setAltura}
                    keyboardType="numeric"
                  />
                  <Text style={styles.unit}>cm</Text>
                </View>

                {errores.altura && (
                  <Text style={styles.errorText}>{errores.altura}</Text>
                )}
              </View>

              <View style={styles.fieldWrapper}>
                <View style={{ position: "relative" }}>
                  <TextInput
                    placeholder="Peso"
                    placeholderTextColor="#6b7280"
                    style={[
                      styles.inputHalf,
                      { paddingRight: 40 },
                      errores.peso && styles.inputError,
                    ]}
                    value={peso}
                    onChangeText={setPeso}
                    keyboardType="numeric"
                  />
                  <Text style={styles.unit}>kg</Text>
                </View>

                {errores.peso && (
                  <Text style={styles.errorText}>{errores.peso}</Text>
                )}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.fieldWrapper}>
                <View style={{ position: "relative" }}>
                  <TextInput
                    placeholder="Temp"
                    placeholderTextColor="#6b7280"
                    style={[
                      styles.inputHalf,
                      { paddingRight: 40 },
                      errores.temperatura && styles.inputError,
                    ]}
                    value={temperatura}
                    onChangeText={setTemperatura}
                    keyboardType="numeric"
                  />
                  <Text style={styles.unit}>°C</Text>
                </View>

                {errores.temperatura && (
                  <Text style={styles.errorText}>{errores.temperatura}</Text>
                )}
              </View>

              <View style={styles.fieldWrapper}>
                <View style={{ position: "relative" }}>
                  <TextInput
                    placeholder="P. Arterial"
                    placeholderTextColor="#6b7280"
                    style={[
                      styles.inputHalf,
                      { paddingRight: 55 },
                      errores.presion && styles.inputError,
                    ]}
                    value={presion}
                    onChangeText={setPresion}
                  />
                  <Text style={styles.unit}>mmHg</Text>
                </View>

                {errores.presion && (
                  <Text style={styles.errorText}>{errores.presion}</Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.section}>SÍNTOMAS</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#6b7280" />
              <TextInput
                placeholder="Buscar síntoma/categoría..."
                placeholderTextColor="#6b7280"
                value={busquedaSintoma}
                onChangeText={setBusquedaSintoma}
                style={styles.searchInput}
              />
            </View>

            {busquedaSintoma !== "" && (
              <Text
                style={{
                  textAlign: "center",
                  marginBottom: 10,
                  color: "#6b7280",
                }}
              >
                Resultados para: "{busquedaSintoma}"
              </Text>
            )}
            {Object.entries(sintomasData).map(([categoria, lista]) => {
              const busqueda = normalizarTexto(busquedaSintoma);

              const categoriaMatch =
                normalizarTexto(categoria).includes(busqueda);

              const sintomasFiltrados = lista.filter((s) =>
                normalizarTexto(s).includes(busqueda),
              );

              // 🔥 mostrar categoría si:
              // - coincide la categoría
              // - o tiene síntomas filtrados
              if (!categoriaMatch && sintomasFiltrados.length === 0)
                return null;

              return (
                <View key={categoria} style={styles.symptomGroup}>
                  <Text style={styles.categoryTitle}>{categoria}</Text>

                  {(categoriaMatch ? lista : sintomasFiltrados).map(
                    (sintoma) => (
                      <TouchableOpacity
                        key={sintoma}
                        style={styles.symptomItem}
                        onPress={() => toggleSintoma(sintoma)}
                      >
                        <Ionicons
                          name={
                            sintomasSeleccionados.includes(sintoma)
                              ? "checkbox"
                              : "square-outline"
                          }
                          size={22}
                          color="#1E88E5"
                        />
                        <Text style={styles.symptomText}>{sintoma}</Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              );
            })}

            <TextInput
              placeholder="Otros síntomas..."
              placeholderTextColor="#6b7280"
              style={styles.textArea}
              multiline
              value={otrosSintomas}
              onChangeText={setOtrosSintomas}
            />
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.section}>DIAGNÓSTICO</Text>

            <TextInput
              placeholder="Diagnóstico clínico..."
              placeholderTextColor="#6b7280"
              style={styles.textArea}
              multiline
              value={diagnostico}
              onChangeText={setDiagnostico}
            />

            <Text style={styles.subTitle}>Recomendaciones</Text>

            <TextInput
              placeholder="Indicaciones médicas..."
              placeholderTextColor="#6b7280"
              style={styles.textArea}
              multiline
              value={recomendaciones}
              onChangeText={setRecomendaciones}
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={guardarRegistro}>
            <Text style={styles.saveText}>Guardar</Text>
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
    zIndex: 1,
  },

  headerContent: {
    position: "absolute",
    top: 100,
    width: "100%",
    alignItems: "center",
    zIndex: 2,
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
    flex: 1,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },

  back: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111827",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    borderRadius: 18,
    marginBottom: 16,
    height: 58,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  searchInput: {
    marginLeft: 10,
    flex: 1,
    fontSize: 16,
    color: "#111827",
  },

  cardPaciente: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 18,
    marginBottom: 14,
    marginHorizontal: 2,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  patientRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 14,
  },

  avatarImg: {
    width: "100%",
    height: "100%",
  },

  nombre: {
    fontWeight: "bold",
    fontSize: 18,
    color: "#111827",
  },

  edadTexto: {
    color: "#6b7280",
    fontSize: 15,
    marginTop: 3,
  },

  photoSection: {
    alignItems: "center",
    marginVertical: 22,
  },

  photoWrapper: {
    position: "relative",
    width: 125,
    height: 125,
  },

  photoCircle: {
    width: 125,
    height: 125,
    borderRadius: 62.5,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#fff",
    elevation: 4,
  },

  photo: {
    width: "100%",
    height: "100%",
  },

  cameraButton: {
    position: "absolute",
    bottom: 2,
    right: -6,
    backgroundColor: "#1E88E5",
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#f5f6fa",
  },

  photoLabel: {
    marginTop: 10,
    fontSize: 14,
    color: "#6b7280",
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

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  fieldWrapper: {
    width: "48%",
    marginBottom: 10,
  },

  inputHalf: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  inputError: {
    borderWidth: 1.5,
    borderColor: "#ef4444",
  },

  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
    marginLeft: 4,
  },

  unit: {
    position: "absolute",
    right: 12,
    top: 18,
    color: "#6b7280",
    fontSize: 12,
  },

  unitSelector: {
    position: "absolute",
    right: 8,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
  },

  unitText: {
    fontSize: 12,
    color: "#1E5FA8",
    fontWeight: "700",
  },

  symptomGroup: {
    marginBottom: 12,
  },

  categoryTitle: {
    fontWeight: "700",
    marginBottom: 8,
    color: "#374151",
    fontSize: 14,
  },

  symptomItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "#f9fafb",
    padding: 9,
    borderRadius: 12,
  },

  symptomText: {
    marginLeft: 8,
    color: "#374151",
    fontSize: 14,
  },

  textArea: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 14,
    height: 100,
    marginBottom: 15,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  subTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 6,
  },

  saveButton: {
    backgroundColor: "#1E88E5",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 18,
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
    top: 70,
    left: 20,
    zIndex: 10,
  },
});
