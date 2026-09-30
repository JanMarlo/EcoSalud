import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { EmailAuthProvider, getAuth, reauthenticateWithCredential, signOut } from "firebase/auth";
import { collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SignatureScreen from "react-native-signature-canvas";
import Svg, {
  Defs,
  Path,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";
import { db } from "../../firebase";

const { width } = Dimensions.get("window");

function SvgTop() {
  return (
    <Svg width={width} height={220} viewBox={`0 0 ${width} 220`}>
      <Defs>
        <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#1E5FA8" />
          <Stop offset="1" stopColor="#2FA4D6" />
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


export default function Perfil() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [pacientesCompartidos, setPacientesCompartidos] = useState<any[]>([]);
  const [imagen, setImagen] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);

  const [form, setForm] = useState({
  especialidad: "",
  telefono: "",
  clinica: "",
  cedula: "",
  });

  const [mostrarFirma, setMostrarFirma] = useState(false);
  const [firmaGuardada, setFirmaGuardada] = useState<string | null>(null);
  const refFirma = useRef<any>(null);
  const [verFirma, setVerFirma] = useState(false);
  const [pedirPassword, setPedirPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [accionPendiente, setAccionPendiente] = useState<"firma" | "editar" | null>(null);

  useEffect(() => {
  const user = getAuth().currentUser;
  if (!user) return;

  // ────────────────
  // 👨‍⚕️ USUARIO (doctor)
  // ────────────────
  const userRef = doc(db, "usuarios", user.uid);

const unsubUser = onSnapshot(
  userRef,
  (snapUser) => {
    console.log("UID AUTH:", user.uid);
    console.log("¿EXISTE PERFIL?:", snapUser.exists());

    if (snapUser.exists()) {
      const data = snapUser.data();

      console.log("DATOS PERFIL:", data);

      setUsuario(data);

      setForm({
        especialidad: data.especialidad || "",
        telefono: data.telefono || "",
        clinica: data.clinica || "",
        cedula: data.cedula || "",
      });

      setImagen(data.foto || null);
      setFirmaGuardada(data.firma ?? null);
      setVerFirma(false);
    } else {
      console.log("❌ No existe documento para:", user.uid);
    }
  },
  (error) => {
    console.log(
      "🔥 ERROR FIRESTORE PERFIL:",
      error.code,
      error.message
    );
  }
);

  // ────────────────
  // 🧑‍🤝‍🧑 PACIENTES
  // ────────────────
  const qPacientes = query(
    collection(db, "registros"),
    where("uid", "==", user.uid)
  );

  const unsubPacientes = onSnapshot(qPacientes, (snapPacientes) => {
    const mapa = new Map();

    snapPacientes.docs.forEach((docSnap) => {
      const data = docSnap.data();

      if (!data.pacienteId) return;

     const key = data.pacienteId;

  const existente = mapa.get(key);

  const fechaActual = data.createdAt?.seconds || 0;
  const fechaExistente = existente?.createdAt?.seconds || 0;

    if (!existente || fechaActual > fechaExistente) {
    mapa.set(key, {
    id: docSnap.id,
    ...data,
    });
    }
    });

    const listaFinal = Array.from(mapa.values()).sort(
      (a: any, b: any) =>
        (b.createdAt?.seconds || 0) -
        (a.createdAt?.seconds || 0)
    );

    setPacientes(listaFinal);
  });

  // ─────────────────────────
  // 🔗 PACIENTES COMPARTIDOS
  // ─────────────────────────
  const qShared = query(
    collection(db, "compartidos"),
    where("sharedWithUid", "==", user.uid)
  );

  const unsubShared = onSnapshot(qShared, async (snapShared) => {
    const sharedPacienteIds = snapShared.docs.map((d) => d.data().pacienteId as string);

    if (sharedPacienteIds.length === 0) {
      setPacientesCompartidos([]);
      return;
    }

    const qRegs = query(
      collection(db, "registros"),
      where("pacienteId", "in", sharedPacienteIds.slice(0, 30))
    );

    const snapRegs = await getDocs(qRegs);
    const mapaShared = new Map();

    snapRegs.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (!data.pacienteId) return;
      const key = data.pacienteId;
      const existente = mapaShared.get(key);
      if (!existente || (data.createdAt?.seconds || 0) > (existente?.createdAt?.seconds || 0)) {
        mapaShared.set(key, { id: docSnap.id, ...data });
      }
    });

    setPacientesCompartidos(Array.from(mapaShared.values()));
  });

  // cleanup
  return () => {
    unsubUser();
    unsubPacientes();
    unsubShared();
  };
}, []);

  if (!usuario) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Cargando perfil...</Text>
      </View>
    );
  }

    const Firma = () => {
    const handleOK = async (firmaBase64: string) => {
    const url = await guardarFirma(firmaBase64);

    if (url) {
     setFirmaGuardada(url);
      setMostrarFirma(false);
    }
    };
    
  return (
    <SignatureScreen
      ref={refFirma}
      onOK={handleOK}
      descriptionText="Firma del doctor"
      clearText="Limpiar"
      confirmText="Guardar"
      webStyle={`
        .m-signature-pad--footer {display: flex; justify-content: space-between;}
      `}
    />
  );
  };

  const borrarFirma = async () => {
  try {
    const user = getAuth().currentUser;

    const qUser = query(
      collection(db, "usuarios"),
      where("uid", "==", user?.uid)
    );

    const snap = await getDocs(qUser);

    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        firma: null,
      });
    }

    setFirmaGuardada(null);
    setVerFirma(false);

    Alert.alert("Éxito", "Firma eliminada");
  } catch (error) {
    
    Alert.alert("Error", "No se pudo borrar la firma");
  }
  };

  const elegirImagen = async () => {
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permiso.granted) {
    Alert.alert("Permiso requerido", "Se necesita acceso a la galería");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    quality: 0.7,
  });

  if (result.canceled) return;

  const uri = result.assets[0].uri;

  try {
    const data = new FormData();

    data.append("file", {
      uri,
      type: "image/jpeg",
      name: "perfil.jpg",
    } as any);

    data.append("upload_preset", "ecosalud");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/qhxxplvk/image/upload",
      {
        method: "POST",
        body: data,
      }
    );

    const json = await res.json();

    if (json.secure_url) {

      // 🔥 guardar en firestore
      const user = getAuth().currentUser;

      const qUser = query(
        collection(db, "usuarios"),
        where("uid", "==", user?.uid)
      );

      const snap = await getDocs(qUser);

      if (!snap.empty) {
        const ref = snap.docs[0].ref;
        await updateDoc(ref, {
          foto: json.secure_url,
        });
        setImagen(json.secure_url);
      }
    }
  } catch (error) {
    
    Alert.alert("Error", "No se pudo subir la imagen");
  }
  };

  const guardarFirma = async (firmaBase64: string) => {
  try {
    const data = new FormData();

    data.append("file", `data:image/png;base64,${firmaBase64}`);
    data.append("upload_preset", "ecosalud");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/qhxxplvk/image/upload",
      {
        method: "POST",
        body: data,
      }
    );

    const json = await res.json();

    if (json.secure_url) {
      const user = getAuth().currentUser;

      const qUser = query(
        collection(db, "usuarios"),
        where("uid", "==", user?.uid)
      );

      const snap = await getDocs(qUser);

      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          firma: json.secure_url, // 🔥 siempre reemplaza
        });
      }
      

      return json.secure_url;
    }
  } catch (error) {
    
    Alert.alert("Error", "No se pudo guardar la firma");
  }

  return null;
  };

  const guardarInfo = async () => {
  try {
    const user = getAuth().currentUser;

    const qUser = query(
      collection(db, "usuarios"),
      where("uid", "==", user?.uid)
    );

    const snap = await getDocs(qUser);

    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        especialidad: form.especialidad,
        telefono: form.telefono,
        clinica: form.clinica,
        cedula: form.cedula,
      });
    }

    setUsuario((prev: any) => ({
      ...prev,
      ...form,
    }));

    setEditando(false);

    Alert.alert("Éxito", "Información actualizada");
  } catch (error) {
    
    Alert.alert("Error", "No se pudo guardar");
  }
  };

  const cerrarSesion = async () => {
    try {
      await signOut(getAuth());
      router.replace("/");
    } catch (error) {
      
    }
  };

  const tieneFirma =
  firmaGuardada && typeof firmaGuardada === "string" && firmaGuardada.trim() !== "";

  return (
    <View style={styles.mainContainer}>
      <View style={styles.containerSvg}>
        <SvgTop />
      </View>

        {/* HEADER */}
        <View style={styles.header}>

          {/* AVATAR */}
          <TouchableOpacity onPress={elegirImagen}>
            <View style={styles.avatar}>
              {imagen ? (
                <Image source={{ uri: imagen }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="person" size={40} color="#fff" />
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.nombre}>{usuario.nombre}</Text>
          <Text style={styles.email}>{usuario.email}</Text>
        </View>

          <SafeAreaView style={styles.container}>

            <Modal
            visible={mostrarFirma}
            animationType="slide"
            transparent={true}
            >
            <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>

              <Text style={styles.modalTitle}>
             Firma del Doctor
            </Text>

           <View style={{ height: 320, marginTop: 10 }}>
                <Firma />
            </View>

            <View style={styles.firmaActions}>
                <TouchableOpacity
                   style={styles.cancelButton}
                    onPress={() => setMostrarFirma(false)}
                  >
              <Text style={styles.cancelText}>Cancelar</Text>
             </TouchableOpacity>

              <TouchableOpacity
                 style={styles.saveButton}
               onPress={() => refFirma.current?.readSignature()}
               >
             <Text style={styles.saveText}>Guardar</Text>
           </TouchableOpacity>
           </View>

            </View>
            </View>
            </Modal>

    <Modal visible={pedirPassword} transparent animationType="fade">

    <View style={styles.modalOverlay}>
    <View style={styles.modalContent}>

      <Text style={styles.modalTitle}>
        Verificar identidad
      </Text>

      <View style={{ position: "relative" }}>
      <TextInput
        placeholder="Ingresa tu contraseña"
        placeholderTextColor="#9ca3af"
        secureTextEntry={!verPassword}
        value={passwordInput}
        onChangeText={setPasswordInput}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 10,
          paddingRight: 40, // espacio para el ojo
          color: "#111827",
          backgroundColor: "#fff",
        }}
      />

      <TouchableOpacity
        onPress={() => setVerPassword(!verPassword)}
        style={{
          position: "absolute",
          right: 10,
          top: 12,
        }}
      >
        <Ionicons
          name={verPassword ? "eye-off" : "eye"}
          size={20}
          color="#6b7280"
        />
      </TouchableOpacity>
    </View>

      <TouchableOpacity
        style={styles.saveButton}
        onPress={async () => {
          const user = getAuth().currentUser;

          try {
            const cred = EmailAuthProvider.credential(
              user?.email || "",
              passwordInput
            );

            await reauthenticateWithCredential(user!, cred);
            setPasswordInput("");   // 👈 limpiar
            setVerPassword(false);  // 👈 reset ojito

            // ✅ acceso concedido
            setPedirPassword(false);

             if (accionPendiente === "firma") {
              Alert.alert(
                "Firma",
                "¿Qué deseas hacer?",
                [
                  { text: "Ver", onPress: () => setVerFirma(true) },
                  { text: "Editar", onPress: () => setMostrarFirma(true) },
                  { text: "Borrar", style: "destructive", onPress: borrarFirma },
                  { text: "Cancelar", style: "cancel" },
                ]
              );
            }

            if (accionPendiente === "editar") {
              setEditando(true);
            }

            setAccionPendiente(null);

          } catch (error) {
            setPasswordInput("");   // 👈 limpiar
            setVerPassword(false);  // 👈 reset ojito
            Alert.alert("Error", "Contraseña incorrecta");
            }
          }}
      >
        <Text style={styles.saveText}>Confirmar</Text>
      </TouchableOpacity>

     <TouchableOpacity
       onPress={() => {
        setPedirPassword(false);
        setPasswordInput("");   // 👈 limpiar
        setVerPassword(false);  // 👈 reset ojito
        }}
        style={styles.cancelButton}
        >
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>

    </View>
    </View>
    </Modal>
        
        <FlatList
        data={pacientes}
            keyExtractor={(item) => item.pacienteId || item.id}
            showsVerticalScrollIndicator={false}

            renderItem={() => null}

            ListHeaderComponent={
              <>
                {/* INFO */}
              <View style={styles.card}>
            <Text style={styles.cardTitle}>INFORMACIÓN</Text>

            <Text>📧 Correo: {usuario.email}</Text>

            {editando ? (
              <>
                <TextInput
                  placeholder="Especialidad"
                  placeholderTextColor="#9ca3af"
                  value={form.especialidad}
                  onChangeText={(text) =>
                    setForm({ ...form, especialidad: text })
                  }
                  style={styles.input}
                />

                <TextInput
                  placeholder="Teléfono"
                  placeholderTextColor="#9ca3af"
                  value={form.telefono}
                  onChangeText={(text) =>
                    setForm({ ...form, telefono: text })
                  }
                  style={styles.input}
                />

                <TextInput
                  placeholder="Clínica / Consultorio"
                  placeholderTextColor="#9ca3af"
                  value={form.clinica}
                  onChangeText={(text) =>
                    setForm({ ...form, clinica: text })
                  }
                  style={styles.input}
                />

                <TextInput
                  placeholder="Cédula profesional"
                  placeholderTextColor="#9ca3af"
                  value={form.cedula}
                  onChangeText={(text) =>
                    setForm({ ...form, cedula: text })
                  }
                  style={styles.input}
                />

                <TouchableOpacity style={styles.saveButton} onPress={guardarInfo}>
                  <Text style={styles.saveText}>Guardar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setEditando(false)}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text>🩺 Especialidad: {usuario.especialidad || "No registrada"}</Text>
                <Text>📞 Teléfono: {usuario.telefono || "No registrado"}</Text>
                <Text>🏥 Clínica: {usuario.clinica || "No registrada"}</Text>
                <Text>🆔 Cédula: {usuario.cedula || "No registrada"}</Text>

                <TouchableOpacity
                  style={styles.firmaButton}
                  onPress={() => {
                    setAccionPendiente("editar");
                    setPedirPassword(true);
                  }}
                >
                  <Text style={styles.firmaButtonText}>Editar información</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.supportButton}
              onPress={() => {
                Alert.alert(
                  "Cambiar contraseña",
                  "Para cambiar tu contraseña, contacta a soporte:\n\nsoporte@ecosalud.com"
                );
              }}
            >
              <Text style={styles.supportText}>Solicitar cambio de contraseña</Text>
            </TouchableOpacity>

            <Text>🔒 Contraseña: ********</Text>
            </View>

      {/* FIRMA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>FIRMA</Text>

        {!tieneFirma ? (
          <Text>No has registrado firma</Text>
        ) : verFirma ? (
          <Image
            source={{ uri: firmaGuardada }}
            style={styles.firmaImg}
            resizeMode="contain"
          />
        ) : (
          <Text>Firma registrada (oculta)</Text>
        )}

          <TouchableOpacity
            style={styles.firmaButton}
            onPress={() => {
              setPasswordInput("");
              setVerPassword(false);

              const tieneFirma =
                firmaGuardada &&
                typeof firmaGuardada === "string" &&
                firmaGuardada.trim() !== "";

              if (!tieneFirma) {
                setMostrarFirma(true);
                return;
              }

              if (verFirma) {
                setVerFirma(false);
                return;
              }

              // 🔐 AQUÍ ESTABA EL ERROR
              setAccionPendiente("firma");
              setPedirPassword(true);
            }}
          >
          <Text style={styles.firmaButtonText}>
            {!tieneFirma
              ? "Agregar firma"
              : verFirma
              ? "Ocultar firma"
              : "Administrar firma"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 👇 CARD DE PACIENTES (TODO AQUÍ) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          PACIENTES ({(pacientes?.length || 0) + (pacientesCompartidos?.length || 0)})
        </Text>
        {pacientes.length === 0 && pacientesCompartidos.length === 0 ? (
      <Text>No hay pacientes registrados</Text>
      ) : (
      <>
      {pacientes.map((item) => (
      <View
        key={item.pacienteId || item.id}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <Ionicons name="person-circle" size={20} color="#1E88E5" />
        <Text style={{ marginLeft: 6 }}>{item.nombre}</Text>
      </View>
    ))}

    {pacientesCompartidos.length > 0 && (
      <>
        <View style={{ borderTopWidth: 1, borderTopColor: "#f3f4f6", marginTop: 12, paddingTop: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>🔗 Compartidos conmigo</Text>
        </View>
        {pacientesCompartidos.map((item) => (
          <View
            key={item.pacienteId || item.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Ionicons name="link" size={18} color="#1E88E5" />
            <Text style={{ marginLeft: 6 }}>{item.nombre}</Text>
          </View>
        ))}
      </>
    )}
    </>
  )}
</View>
     
    </>
  }

  ListFooterComponent={
    <TouchableOpacity
      style={styles.logoutButton}
      onPress={cerrarSesion}
    >
      <Text style={styles.logoutText}>Cerrar sesión</Text>
    </TouchableOpacity>
  }

  contentContainerStyle={{
    paddingBottom: 40,
    paddingHorizontal: 20,
  }}
  />
    </SafeAreaView>    
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
  },

  container: {
    flex: 1,
  },

  header: {
    alignItems: "center",
    marginTop: 100,
    marginBottom: 20,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#1E88E5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
  },

  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },

  nombre: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
  },

  email: {
    color: "#000",
  },

  card: {
    backgroundColor: "white",
    padding: 20, //18
    borderRadius: 20, //16
    marginBottom: 18, //15
    elevation: 4,
  },

  cardTitle: {
    fontWeight: "bold",
    marginBottom: 8,
    fontSize: 16,
  },

  pacienteItem: {
    marginBottom: 5,
    paddingLeft: 5,
  },

  logoutButton: {
    backgroundColor: "#ef4444",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },

  logoutText: {
    color: "#fff",
    fontWeight: "bold",
  },

  warningText: {
  fontSize: 13,
  color: "#ef4444",
  marginBottom: 10,
},

firmaButton: {
  backgroundColor: "#1E88E5",
  padding: 12,
  borderRadius: 10,
  alignItems: "center",
  marginTop: 10,
},

firmaButtonText: {
  color: "#fff",
  fontWeight: "bold",
},

firmaContainer: {
  height: 250,
  marginTop: 10,
  borderRadius: 10,
  overflow: "hidden",
},

firmaActions: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginTop: 10,
},

cancelButton: {
  backgroundColor: "#9ca3af",
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
  alignItems: "center",
  marginTop: 8,
},

cancelText: {
  color: "#fff",
  fontWeight: "bold",
},

firmaImg: {
  width: 220,
  height: 100,
  marginVertical: 10,
},

lockText: {
  color: "#16a34a",
  fontWeight: "bold",
},

saveButton: {
  backgroundColor: "#1E88E5",
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 10,
  marginTop: 8,
  alignItems: "center",
},

saveText: {
  color: "#fff",
  fontWeight: "bold",
},

modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.6)",
  justifyContent: "center",
  padding: 20,
},

modalContent: {
  width: "100%",
  maxHeight: "85%",
  backgroundColor: "#fff",
  borderRadius: 16,
  padding: 20,
  overflow: "hidden",
},

modalTitle: {
  fontSize: 18,
  fontWeight: "bold",
  marginBottom: 10,
  textAlign: "center",
},

supportButton: {
  marginTop: 10,
},

supportText: {
  color: "#1E88E5",
  fontWeight: "600",
},

input: {
  borderWidth: 1,
  borderColor: "#ccc",
  borderRadius: 10,
  padding: 10,
  marginTop: 8,
},
});
