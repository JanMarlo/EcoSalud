import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebase";

// Logo para el PDF
const logoImage = require("../assets/images/logo2.png");

type Paciente = {
  id?: string;
  pacienteId?: string;
  nombre: string;
  edad: number;
  unidadEdad?: string;
  altura: number;
  peso: number;
  temperatura: number;
  presion: string;
  foto?: string;
  sintomas?: string[];
  diagnostico?: string;
  recomendaciones?: string;
  createdAt?: any;
};

// ─── Helper: detecta qué campos cambiaron entre dos consultas ───────────────
type CamposCambiados = {
  campo: string;
  label: string;
  antes: string;
  despues: string;
};

function getChanges(anterior: Paciente, actual: Paciente): CamposCambiados[] {
  const cambios: CamposCambiados[] = [];

  const comparar = (
    campo: keyof Paciente,
    label: string,
    format?: (v: any) => string,
  ) => {
    const fmt = format ?? ((v: any) => String(v ?? ""));
    const antes = fmt(anterior[campo]);
    const despues = fmt(actual[campo]);
    if (antes !== despues) {
      cambios.push({ campo: campo as string, label, antes, despues });
    }
  };

  comparar("peso", "Peso", (v) => `${v} kg`);
  comparar("altura", "Altura", (v) => `${v} cm`);
  comparar("temperatura", "Temperatura", (v) => `${v} °C`);
  comparar("presion", "Presión arterial");
  comparar("diagnostico", "Diagnóstico");
  comparar("recomendaciones", "Recomendaciones");
  comparar(
    "sintomas",
    "Síntomas",
    (v: string[]) => (v ?? []).slice().sort().join(", "),
  );

  return cambios;
}

type Compartido = {
  id: string;
  sharedWithUid: string;
  sharedWithEmail: string;
  ownerUid: string;
  ownerNombre: string;
};

export default function PatientProfile() {
  const { id } = useLocalSearchParams();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [historial, setHistorial] = useState<Paciente[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const router = useRouter();

  // ── Compartir paciente ─────────────────────────────────────────────────
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [emailCompartir, setEmailCompartir] = useState("");
  const [compartidos, setCompartidos] = useState<Compartido[]>([]);
  const [cargandoCompartir, setCargandoCompartir] = useState(false);

 useEffect(() => {
  if (!id) return;

  const q = query(
    collection(db, "registros"),
    where("pacienteId", "==", id)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const lista = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Paciente[];

    if (lista.length === 0) return;

    // ordenar
    lista.sort(
      (a, b) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

    const listaFiltrada = lista.filter((item, index, arr) => {
    if (index === 0) return true;

    const prev = arr[index - 1];

    const mismoTimestamp =
      item.createdAt?.seconds === prev.createdAt?.seconds;

    const mismosDatos =
      item.diagnostico === prev.diagnostico &&
      item.peso === prev.peso &&
      item.altura === prev.altura &&
      item.temperatura === prev.temperatura &&
      item.presion === prev.presion;

    return !(mismoTimestamp && mismosDatos);
    });


    setPaciente(listaFiltrada[0]);
    setHistorial(listaFiltrada.slice(1));
  });

  return () => unsubscribe();
  }, [id]);

  // ── Listener de doctores con acceso compartido ──────────────────────────
  useEffect(() => {
    if (!id) return;

    const q = query(
      collection(db, "compartidos"),
      where("pacienteId", "==", id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Compartido[];

      setCompartidos(lista);
    });

    return () => unsubscribe();
  }, [id]);

  if (!paciente) return null;

  const user = getAuth().currentUser;

  // ── Compartir paciente con otro doctor ──────────────────────────────────
  const compartirPaciente = async () => {
    const emailRaw = emailCompartir.trim();

    if (!emailRaw) {
      Alert.alert("Error", "Ingresa un correo electrónico");
      return;
    }

    if (!user) {
      Alert.alert("Error", "No hay usuario autenticado");
      return;
    }

    if (emailRaw.toLowerCase() === user.email?.toLowerCase()) {
      Alert.alert("Error", "No puedes compartir contigo mismo");
      return;
    }

    // Verificar si ya está compartido con ese email
    const yaCompartido = compartidos.find(
      (c) => c.sharedWithEmail.toLowerCase() === emailRaw.toLowerCase()
    );
    if (yaCompartido) {
      Alert.alert("Error", "Este paciente ya está compartido con ese doctor");
      return;
    }

    setCargandoCompartir(true);

    try {
      // 🔍 DEBUG: Ver todos los usuarios en la colección
      const allUsersSnap = await getDocs(collection(db, "usuarios"));
      console.log("=== TODOS LOS USUARIOS EN FIREBASE ===");
      console.log("Total usuarios:", allUsersSnap.docs.length);
      allUsersSnap.docs.forEach((d, i) => {
        const data = d.data();
        console.log(`Usuario ${i}:`, JSON.stringify({
          uid: data.uid,
          email: data.email,
          correo: data.correo,
          nombre: data.nombre,
          // mostrar todas las keys del documento
          keys: Object.keys(data),
        }));
      });
      console.log("Buscando email:", emailRaw);
      console.log("======================================");

      // Buscar comparando case-insensitive contra todos los campos posibles
      const match = allUsersSnap.docs.find((d) => {
        const data = d.data();
        const emailField = data.email || data.correo || data.Email || data.Correo || "";
        return emailField.toLowerCase() === emailRaw.toLowerCase();
      });

      if (!match) {
        Alert.alert("Error", "No se encontró un doctor con ese correo. Revisa la consola de Expo para ver los usuarios disponibles.");
        setCargandoCompartir(false);
        return;
      }

      const snapDoc = { empty: false, docs: [match] } as any;

      const doctorDestino = snapDoc.docs[0].data();

      // Obtener nombre del doctor actual
      const qOwner = query(
        collection(db, "usuarios"),
        where("uid", "==", user.uid)
      );
      const snapOwner = await getDocs(qOwner);
      const ownerData = snapOwner.docs[0]?.data();

      await addDoc(collection(db, "compartidos"), {
        pacienteId: id,
        ownerUid: user.uid,
        ownerNombre: ownerData?.nombre || "Doctor",
        sharedWithUid: doctorDestino.uid,
        sharedWithEmail: doctorDestino.email || emailRaw,
        pacienteNombre: paciente.nombre,
        createdAt: serverTimestamp(),
      });

      Alert.alert("Éxito", `Paciente compartido con ${doctorDestino.nombre || emailRaw}`);
      setEmailCompartir("");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo compartir el paciente");
    } finally {
      setCargandoCompartir(false);
    }
  };

  // ── Revocar acceso ──────────────────────────────────────────────────────
  const revocarAcceso = (comp: Compartido) => {
    Alert.alert(
      "Revocar acceso",
      `¿Quitar acceso a ${comp.sharedWithEmail}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revocar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "compartidos", comp.id));
              Alert.alert("Listo", "Acceso revocado");
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo revocar el acceso");
            }
          },
        },
      ]
    );
  };

  const eliminarPaciente = () => {
    Alert.alert(
      "Eliminar expediente",
      "Se eliminarán TODAS las consultas de este paciente. ¿Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              if (!paciente?.pacienteId) {
                Alert.alert(
                  "Error",
                  "Este paciente no tiene identificador válido.",
                );
                return;
              }

              const q = query(
                collection(db, "registros"),
                where("pacienteId", "==", paciente.pacienteId),
              );

              const snapshot = await getDocs(q);

              const eliminaciones = snapshot.docs.map((docItem) =>
                deleteDoc(doc(db, "registros", docItem.id)),
              );

              await Promise.all(eliminaciones);

              Alert.alert("Eliminado", "Paciente eliminado correctamente");
              router.back();
            } catch (error) {
              console.error(error);
              Alert.alert("Error", "No se pudo eliminar el paciente");
            }
          },
        },
      ],
    );
  };

  
  const generarPDF = async () => {
  try {
    const user = getAuth().currentUser;

    // 🔥 TRAER DOCTOR
    const qUser = query(
      collection(db, "usuarios"),
      where("uid", "==", user?.uid)
    );

    const snap = await getDocs(qUser);
    const doctor = snap.docs[0]?.data();

    // 🖼️ LOGO como base64
    let logoBase64 = "";
    try {
      const asset = Asset.fromModule(logoImage);
      await asset.downloadAsync();
      if (asset.localUri) {
        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: "base64",
        });
        logoBase64 = `data:image/png;base64,${base64}`;
      }
    } catch (e) {
      console.log("No se pudo cargar el logo:", e);
    }

    // 📋 TODAS las consultas (actual + historial) de más reciente a más antigua
    const todasConsultas = [paciente, ...historial];

    // 📄 Generar HTML de cada consulta con cambios
    const consultasHTML = todasConsultas.map((consulta, index) => {
      const fecha = consulta.createdAt
        ? new Date(consulta.createdAt.seconds * 1000).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Sin fecha";

      // Calcular cambios respecto a la consulta siguiente (más reciente)
      let cambiosHTML = "";
      if (index > 0) {
        const referencia = index === 1 ? paciente : todasConsultas[index - 1];
        const cambios = getChanges(consulta, referencia);

        if (cambios.length > 0) {
          cambiosHTML = `
            <div class="cambios-section">
              <div class="cambios-title">🔄 Cambios respecto a la consulta siguiente (${cambios.length})</div>
              <table class="cambios-table">
                <tr>
                  <th>Parámetro</th>
                  <th>Esta consulta</th>
                  <th></th>
                  <th>Siguiente</th>
                </tr>
                ${cambios.map((c) => `
                  <tr>
                    <td class="cambio-label">${c.label}</td>
                    <td class="cambio-antes">${c.antes || "—"}</td>
                    <td style="text-align:center;color:#6b7280;">→</td>
                    <td class="cambio-despues">${c.despues || "—"}</td>
                  </tr>
                `).join("")}
              </table>
            </div>
          `;
        } else {
          cambiosHTML = `<div class="sin-cambios">✅ Sin cambios respecto a la consulta siguiente</div>`;
        }
      }

      return `
        <div class="consulta ${index === 0 ? 'consulta-actual' : ''}">
          <div class="consulta-header">
            <span class="consulta-numero">${index === 0 ? '📌 CONSULTA MÁS RECIENTE' : 'Consulta #' + (todasConsultas.length - index)}</span>
            <span class="consulta-fecha">${fecha}</span>
          </div>

          <div class="vitals">
            <div class="vital"><b>Peso</b><br/>${consulta.peso} kg</div>
            <div class="vital"><b>Altura</b><br/>${consulta.altura} cm</div>
            <div class="vital"><b>Temp</b><br/>${consulta.temperatura} °C</div>
            <div class="vital"><b>Presión</b><br/>${consulta.presion}</div>
          </div>

          <div class="detail-row">
            <div class="detail-label">Síntomas:</div>
            <div>${consulta.sintomas?.length ? consulta.sintomas.join(", ") : "No registrados"}</div>
          </div>

          <div class="detail-row">
            <div class="detail-label">Diagnóstico:</div>
            <div>${consulta.diagnostico || "No registrado"}</div>
          </div>

          <div class="detail-row">
            <div class="detail-label">Recomendaciones:</div>
            <div>${consulta.recomendaciones || "No registradas"}</div>
          </div>

          ${cambiosHTML}
        </div>
      `;
    }).join("");

    const html = `
<html>
<head>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 20px;
      font-size: 11px;
      color: #333;
    }
    .header {
      display: flex;
      align-items: center;
      border-bottom: 3px solid #1E5FA8;
      padding-bottom: 12px;
      margin-bottom: 15px;
    }
    .header-logo {
      width: 65px;
      height: 65px;
      object-fit: contain;
      margin-right: 15px;
      border-radius: 10px;
    }
    .header-info { flex: 1; }
    .header-title {
      font-size: 18px;
      font-weight: bold;
      color: #1E5FA8;
      margin: 0;
    }
    .header-subtitle {
      font-size: 11px;
      color: #6b7280;
      margin: 2px 0;
    }
    .patient-card {
      background: #f0f7ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
      display: flex;
      justify-content: space-between;
    }
    .patient-card b { color: #1E5FA8; }
    .section-title {
      font-size: 14px;
      font-weight: bold;
      color: #1E5FA8;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 4px;
      margin: 18px 0 10px 0;
    }
    .consulta {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .consulta-actual {
      border-color: #1E5FA8;
      border-width: 2px;
      background: #fafcff;
    }
    .consulta-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f3f4f6;
    }
    .consulta-numero {
      font-weight: bold;
      color: #1E5FA8;
      font-size: 12px;
    }
    .consulta-fecha {
      color: #6b7280;
      font-size: 11px;
    }
    .vitals {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .vital {
      text-align: center;
      border: 1px solid #e5e7eb;
      padding: 6px 4px;
      border-radius: 6px;
      width: 23%;
      font-size: 10px;
      background: #f9fafb;
    }
    .vital b {
      color: #1E5FA8;
      font-size: 9px;
      text-transform: uppercase;
    }
    .detail-row { margin-bottom: 6px; }
    .detail-label {
      font-weight: bold;
      color: #374151;
      font-size: 10px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .cambios-section {
      margin-top: 10px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 8px;
    }
    .cambios-title {
      font-weight: bold;
      font-size: 10px;
      color: #92400e;
      margin-bottom: 6px;
    }
    .cambios-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    .cambios-table th {
      background: #fef3c7;
      padding: 4px 6px;
      text-align: left;
      font-size: 9px;
      color: #92400e;
    }
    .cambios-table td {
      padding: 3px 6px;
      border-bottom: 1px solid #fde68a;
    }
    .cambio-label { font-weight: 600; color: #374151; }
    .cambio-antes { color: #dc2626; }
    .cambio-despues { color: #16a34a; }
    .sin-cambios {
      margin-top: 8px;
      color: #16a34a;
      font-size: 10px;
      font-style: italic;
    }
    .firma {
      margin-top: 25px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
    }
    .firma img {
      width: 140px;
      height: 65px;
      object-fit: contain;
    }
    .firma-label {
      font-weight: bold;
      color: #1E5FA8;
      font-size: 11px;
      margin-bottom: 5px;
    }
    .footer {
      margin-top: 15px;
      font-size: 9px;
      text-align: center;
      color: #9ca3af;
      border-top: 1px solid #f3f4f6;
      padding-top: 8px;
    }
  </style>
</head>

<body>

  <!-- HEADER CON LOGO -->
  <div class="header">
    ${logoBase64 ? '<img class="header-logo" src="' + logoBase64 + '" />' : ""}
    <div class="header-info">
      <div class="header-title">EcoSalud</div>
      <div class="header-subtitle">Expediente Médico Completo</div>
      <div class="header-subtitle">${doctor?.nombre || ""} — ${doctor?.especialidad || ""}</div>
      <div class="header-subtitle">Cédula: ${doctor?.cedula || "N/A"} | ${doctor?.clinica || ""}</div>
    </div>
  </div>

  <!-- DATOS DEL PACIENTE -->
  <div class="patient-card">
    <div>
      <b>Paciente:</b> ${paciente.nombre}<br/>
      <b>Edad:</b> ${paciente.edad} ${paciente.unidadEdad || "años"}
    </div>
    <div>
      <b>Total consultas:</b> ${todasConsultas.length}<br/>
      <b>Generado:</b> ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
    </div>
  </div>

  <!-- TODAS LAS CONSULTAS -->
  <div class="section-title">📋 HISTORIAL DE CONSULTAS (${todasConsultas.length})</div>

  ${consultasHTML}

  <!-- FIRMA -->
  <div class="firma">
    <div class="firma-label">FIRMA DEL MÉDICO</div>
    ${
      doctor?.firma
        ? '<img src="' + doctor.firma + '" />'
        : "<p>Sin firma registrada</p>"
    }
    <div style="margin-top:4px; font-size:10px; color:#6b7280;">
      ${doctor?.nombre || ""}<br/>
      ${doctor?.especialidad || ""}
    </div>
  </div>

  <div class="footer">
    Documento generado por EcoSalud — ${new Date().toLocaleString("es-MX")}
  </div>

  </body>
  </html>
  `;

    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri);

  } catch (error) {
    console.log(error);
    Alert.alert("Error", "No se pudo generar el PDF");
  }
};





  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView>
        {/* HEADER */}
        <View style={styles.header}>
          <LinearGradient
            colors={["#2FA4D6", "#1E5FA8"]}
            style={styles.headerGradient}
          />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={28} color="white" />
          </TouchableOpacity>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.shareIcon}
              onPress={() => setMostrarCompartir(true)}
            >
              <Ionicons name="share-social" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteIcon}
              onPress={eliminarPaciente}
            >
              <Ionicons name="trash" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            {paciente.foto && paciente.foto.trim() !== "" ? (
              <Image
                source={{ uri: paciente.foto }}
                style={styles.avatarImage}
              />
            ) : (
              <MaterialCommunityIcons name="account" size={60} color="#fff" />
            )}
          </View>

          <Text style={styles.name}>{paciente.nombre}</Text>
          <Text style={styles.subtitle}>
            {" "}
            {paciente.edad} {paciente.unidadEdad || "años"}
          </Text>
        </View>

        {/* SIGNOS */}
        <View style={styles.vitalsCard}>
          <View style={styles.vitalItem}>
            <MaterialCommunityIcons
              name="heart-pulse"
              size={22}
              color="#ff4b6a"
            />
            <Text style={styles.vitalValue}>{paciente.presion}</Text>
          </View>

          <View style={styles.vitalItem}>
            <Feather name="thermometer" size={22} color="#f2994a" />
            <Text style={styles.vitalValue}>{paciente.temperatura}°C</Text>
          </View>

          <View style={styles.vitalItem}>
            <MaterialCommunityIcons
              name="weight-kilogram"
              size={22}
              color="#2d9cdb"
            />
            <Text style={styles.vitalValue}>{paciente.peso} kg</Text>
          </View>

          <View style={styles.vitalItem}>
            <MaterialCommunityIcons
              name="human-male-height"
              size={22}
              color="#27ae60"
            />
            <Text style={styles.vitalValue}>{paciente.altura} cm</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Síntomas</Text>
          {paciente.sintomas?.length ? (
            paciente.sintomas.map((s, i) => <Text key={i}>• {s}</Text>)
          ) : (
            <Text>No registrados</Text>
          )}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Diagnóstico</Text>
          <Text>{paciente.diagnostico || "No registrado"}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recomendaciones</Text>
          <Text>{paciente.recomendaciones || "No registrado"}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Historial de consultas</Text>

          {historial.length > 0 ? (
            historial.map((item, index) => {
              // Consulta más reciente que ésta para comparar cambios
              // historial[0] = 2ª más reciente, compare con paciente (la más reciente)
              // historial[1] = 3ª más reciente, compare con historial[0]
              const referencia = index === 0 ? paciente! : historial[index - 1];
              const cambios = getChanges(item, referencia);
              const isOpen = expandedIndex === index;

              return (
                <View key={index} style={styles.histCard}>
                  {/* Cabecera colapsable */}
                  <TouchableOpacity
                    style={styles.histHeader}
                    onPress={() =>
                      setExpandedIndex(isOpen ? null : index)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={styles.histHeaderLeft}>
                      <View style={styles.histDot} />
                      <View>
                        <Text style={styles.histFecha}>
                          {item.createdAt
                            ? new Date(
                                item.createdAt.seconds * 1000,
                              ).toLocaleDateString("es-MX", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric",
                              })
                            : "Sin fecha"}
                        </Text>
                        <Text style={styles.histDiagSmall} numberOfLines={1}>
                          {item.diagnostico || "Sin diagnóstico"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.histHeaderRight}>
                      {cambios.length > 0 && (
                        <View style={styles.badgeCambios}>
                          <Text style={styles.badgeText}>
                            {cambios.length} cambio{cambios.length > 1 ? "s" : ""}
                          </Text>
                        </View>
                      )}
                      <Ionicons
                        name={isOpen ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#6b7280"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Contenido expandido */}
                  {isOpen && (
                    <View style={styles.histBody}>
                      {/* Signos vitales */}
                      <Text style={styles.histSectionLabel}>⚕️ Signos Vitales</Text>
                      <View style={styles.histVitalsRow}>
                        <View style={styles.histVitalBox}>
                          <Text style={styles.histVitalVal}>{item.peso} kg</Text>
                          <Text style={styles.histVitalLbl}>Peso</Text>
                        </View>
                        <View style={styles.histVitalBox}>
                          <Text style={styles.histVitalVal}>{item.altura} cm</Text>
                          <Text style={styles.histVitalLbl}>Altura</Text>
                        </View>
                        <View style={styles.histVitalBox}>
                          <Text style={styles.histVitalVal}>{item.temperatura}°C</Text>
                          <Text style={styles.histVitalLbl}>Temp</Text>
                        </View>
                        <View style={styles.histVitalBox}>
                          <Text style={styles.histVitalVal}>{item.presion}</Text>
                          <Text style={styles.histVitalLbl}>Presión</Text>
                        </View>
                      </View>

                      {/* Síntomas */}
                      <Text style={styles.histSectionLabel}>🩺 Síntomas</Text>
                      <Text style={styles.histBodyText}>
                        {item.sintomas && item.sintomas.length > 0
                          ? item.sintomas.join(", ")
                          : "No registrados"}
                      </Text>

                      {/* Diagnóstico */}
                      <Text style={styles.histSectionLabel}>📋 Diagnóstico</Text>
                      <Text style={styles.histBodyText}>
                        {item.diagnostico || "No registrado"}
                      </Text>

                      {/* Recomendaciones */}
                      <Text style={styles.histSectionLabel}>💊 Recomendaciones</Text>
                      <Text style={styles.histBodyText}>
                        {item.recomendaciones || "No registradas"}
                      </Text>

                      {/* Cambios respecto a la consulta siguiente */}
                      {cambios.length > 0 && (
                        <View style={styles.cambiosContainer}>
                          <Text style={styles.cambiosTitulo}>
                            🔄 Cambios respecto a la consulta siguiente
                          </Text>
                          {cambios.map((c, ci) => (
                            <View key={ci} style={styles.cambioItem}>
                              <Text style={styles.cambioLabel}>{c.label}</Text>
                              <View style={styles.cambioRow}>
                                <View style={styles.cambioAntes}>
                                  <Text style={styles.cambioAntesTxt} numberOfLines={2}>
                                    {c.antes || "—"}
                                  </Text>
                                </View>
                                <Ionicons name="arrow-forward" size={14} color="#6b7280" style={{ marginHorizontal: 4 }} />
                                <View style={styles.cambioDespues}>
                                  <Text style={styles.cambioDespuesTxt} numberOfLines={2}>
                                    {c.despues || "—"}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {cambios.length === 0 && (
                        <View style={styles.sinCambios}>
                          <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                          <Text style={styles.sinCambiosTxt}>
                            Sin cambios respecto a la consulta siguiente
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.sinHistorial}>
              <Ionicons name="document-outline" size={32} color="#d1d5db" />
              <Text style={styles.sinHistorialTxt}>
                Solo existe una consulta registrada
              </Text>
            </View>
          )}
        </View>

        {/* SECCIÓN COMPARTIDO */}
        {compartidos.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🔗 Compartido con</Text>
            {compartidos.map((c) => (
              <View key={c.id} style={styles.sharedDoctorRow}>
                <View style={styles.sharedDoctorInfo}>
                  <Ionicons name="person-circle" size={28} color="#1E88E5" />
                  <Text style={styles.sharedDoctorEmail}>{c.sharedWithEmail}</Text>
                </View>
                {user?.uid === c.ownerUid && (
                  <TouchableOpacity
                    onPress={() => revocarAcceso(c)}
                    style={styles.revokeButton}
                  >
                    <Ionicons name="close-circle" size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.pdfButton} onPress={generarPDF}>
          <Text style={styles.pdfText}>Descargar PDF</Text>
        </TouchableOpacity>

        {/* ── MODAL COMPARTIR ──────────────────────────────────────── */}
        <Modal
          visible={mostrarCompartir}
          transparent
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Compartir Paciente</Text>
              <Text style={styles.modalSubtitle}>
                Ingresa el correo del doctor con quien deseas compartir este
                paciente.
              </Text>

              <View style={styles.modalInputRow}>
                <Ionicons name="mail-outline" size={20} color="#6b7280" />
                <TextInput
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9ca3af"
                  value={emailCompartir}
                  onChangeText={setEmailCompartir}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.modalInput}
                />
              </View>

              <TouchableOpacity
                style={styles.modalShareButton}
                onPress={compartirPaciente}
                disabled={cargandoCompartir}
              >
                {cargandoCompartir ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalShareText}>Compartir</Text>
                )}
              </TouchableOpacity>

              {/* Lista de doctores con acceso */}
              {compartidos.length > 0 && (
                <View style={styles.modalSharedList}>
                  <Text style={styles.modalSharedTitle}>
                    Doctores con acceso ({compartidos.length})
                  </Text>
                  {compartidos.map((c) => (
                    <View key={c.id} style={styles.modalSharedItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalSharedEmail}>
                          {c.sharedWithEmail}
                        </Text>
                      </View>
                      {user?.uid === c.ownerUid && (
                        <TouchableOpacity onPress={() => revocarAcceso(c)}>
                          <Text style={styles.modalRevokeText}>Revocar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setMostrarCompartir(false);
                  setEmailCompartir("");
                }}
              >
                <Text style={styles.modalCancelText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fb" },

  header: { height: 190 },

  headerGradient: {
    flex: 1,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },

  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 1,
  },

  headerActions: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },

  shareIcon: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    padding: 8,
  },

  deleteIcon: {
  },

  avatarContainer: {
    alignItems: "center",
    marginTop: -70,
    marginBottom: 16,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#9ca3af",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#fff",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
  },

  name: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 10,
  },

  subtitle: {
    fontSize: 14,
    color: "#6b7280",
  },

  vitalsCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 3,
  },

  vitalItem: { alignItems: "center", flex: 1 },

  vitalValue: { fontWeight: "700", marginTop: 4 },

  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },

  pdfButton: {
    margin: 20,
    backgroundColor: "#1E5FA8",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  pdfText: { color: "#fff", fontWeight: "bold" },

  deleteButton: {
    marginHorizontal: 20,
    marginBottom: 40,
    backgroundColor: "#ef4444",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },

  // ── Historial ────────────────────────────────────────────────────────────
  histCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 10,
    overflow: "hidden",
    backgroundColor: "#fafafa",
  },

  histHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
  },

  histHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },

  histHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  histDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1E5FA8",
    marginRight: 8,
  },

  histFecha: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
  },

  histDiagSmall: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 1,
    maxWidth: 200,
  },

  badgeCambios: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#f59e0b",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  badgeText: {
    fontSize: 10,
    color: "#d97706",
    fontWeight: "700",
  },

  histBody: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },

  histSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E5FA8",
    marginTop: 10,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  histBodyText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },

  histVitalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  histVitalBox: {
    alignItems: "center",
    flex: 1,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingVertical: 6,
    marginHorizontal: 2,
  },

  histVitalVal: {
    fontWeight: "700",
    fontSize: 13,
    color: "#1e40af",
  },

  histVitalLbl: {
    fontSize: 10,
    color: "#60a5fa",
    marginTop: 2,
  },

  // ── Sección de cambios ───────────────────────────────────────────────────
  cambiosContainer: {
    marginTop: 12,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 10,
  },

  cambiosTitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
    marginBottom: 8,
  },

  cambioItem: {
    marginBottom: 8,
  },

  cambioLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#78350f",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },

  cambioRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  cambioAntes: {
    flex: 1,
    backgroundColor: "#fee2e2",
    borderRadius: 6,
    padding: 6,
  },

  cambioAntesTxt: {
    fontSize: 12,
    color: "#b91c1c",
  },

  cambioDespues: {
    flex: 1,
    backgroundColor: "#dcfce7",
    borderRadius: 6,
    padding: 6,
  },

  cambioDespuesTxt: {
    fontSize: 12,
    color: "#15803d",
  },

  sinCambios: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },

  sinCambiosTxt: {
    fontSize: 12,
    color: "#10b981",
  },

  sinHistorial: {
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },

  sinHistorialTxt: {
    fontSize: 13,
    color: "#9ca3af",
  },

  // ── Compartir ──────────────────────────────────────────────────────────
  sharedDoctorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },

  sharedDoctorInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },

  sharedDoctorEmail: {
    fontSize: 14,
    color: "#374151",
  },

  revokeButton: {
    padding: 4,
  },

  // ── Modal compartir ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 20,
  },

  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },

  modalSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },

  modalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    height: 50,
    marginBottom: 14,
  },

  modalInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#111827",
  },

  modalShareButton: {
    backgroundColor: "#1E88E5",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 16,
  },

  modalShareText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },

  modalSharedList: {
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },

  modalSharedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  modalSharedItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },

  modalSharedEmail: {
    fontSize: 14,
    color: "#374151",
  },

  modalRevokeText: {
    fontSize: 13,
    color: "#ef4444",
    fontWeight: "600",
  },

  modalCancelButton: {
    backgroundColor: "#f3f4f6",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  modalCancelText: {
    color: "#6b7280",
    fontWeight: "600",
    fontSize: 15,
  },
});
