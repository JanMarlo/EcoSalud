import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
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
import { auth } from "../firebase";

//IMPORT DEL LOGO
import logo from "../assets/images/logo2.png";

const { width } = Dimensions.get("window");

export default function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [errorEmail, setErrorEmail] = useState("");
  const [errorPassword, setErrorPassword] = useState("");
  const [errorGeneral, setErrorGeneral] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const isValidEmail = (email: string) => {
    return /\S+@\S+\.\S+/.test(email);
  };

  const handleSignIn = async () => {
    setErrorEmail("");
    setErrorPassword("");
    setErrorGeneral("");

    if (!email) {
      setErrorEmail("El correo es obligatorio");
      return;
    }

    if (!isValidEmail(email)) {
      setErrorEmail("Correo inválido");
      return;
    }

    if (!password) {
      setErrorPassword("La contraseña es obligatoria");
      return;
    }

    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/tabs/pacientes");
    } catch (err: any) {
    console.log("🔥 ERROR FIREBASE AUTH:", err.code, err.message);

    if (err.code === "auth/invalid-credential") {
          setErrorGeneral("Correo o contraseña incorrectos");
        } else if (err.code === "auth/user-not-found") {
          setErrorEmail("El usuario no existe");
        } else if (err.code === "auth/wrong-password") {
          setErrorPassword("Contraseña incorrecta");
        } else {
          setErrorGeneral(`Error al iniciar sesión: ${err.code}`);
        }
    } finally {
      setLoading(false);
    }
  };

  function SvgTop() {
    return (
      <Svg width={width} height={250} viewBox={`0 0 ${width} 250`}>
        <Defs>
          <SvgLinearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#1E5FA8" />
            <Stop offset="1" stopColor="#2FA4D6" />
          </SvgLinearGradient>
        </Defs>
        <Path
          d={`M0 0 H${width} V180 C${width} 180 ${width * 0.7} 260 ${
            width * 0.5
          } 210 C${width * 0.3} 160 0 220 0 220 V0 Z`}
          fill="url(#grad)"
        />
      </Svg>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <View style={styles.containerSvg}>
        <SvgTop />
      </View>

      <View style={styles.container}>
        {/* LOGO BONITO */}
        <View style={styles.logoContainer}>
          <Image source={logo} style={styles.logo} />
        </View>

        <Text style={styles.titulo}>EcoSalud</Text>
        <Text style={styles.subtitulo}>Inicia Sesión en tu cuenta</Text>

        <TextInput
          style={[styles.inputs, errorEmail && styles.inputError]}
          placeholder="ejemplo@gmail.com"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
        />
        {errorEmail && <Text style={styles.errorText}>{errorEmail}</Text>}

        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.inputFull, errorPassword && styles.inputError]}
            placeholder="contraseña"
            placeholderTextColor="#9ca3af"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            textContentType="password"
            autoComplete="password"
          />

          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>

        {errorPassword && (
          <Text style={styles.errorText}>{errorPassword}</Text>
        )}
        {errorGeneral && (
          <Text style={styles.errorTextGeneral}>{errorGeneral}</Text>
        )}

        <Link href="/forgot-password" style={styles.forgotPasswordContainer}>
          <Text style={styles.forgotPasswordText}>
            ¿Olvidaste tu contraseña?
          </Text>
        </Link>

        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <LinearGradient
              colors={["#2FA4D6", "#1E5FA8"]}
              style={styles.gradient}
            >
              <Text style={styles.textButton}>INICIAR SESIÓN</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f1f1f1",
  },

  containerSvg: {
    width: width,
  },

  container: {
    flex: 1,
    alignItems: "center",
    marginTop: -60,
  },

  // 🔥 LOGO BONITO
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    overflow:"hidden",
  },

  logo: {
    width: 180,
    height: 180,
    resizeMode: "contain",
  },

  titulo: {
    fontSize: 45,
    fontWeight: "bold",
    color: "#34434D",
  },

  subtitulo: {
    fontSize: 16,
    color: "gray",
    marginBottom: 20,
  },

  inputs: {
    width: "80%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    color: "#111827",
    paddingHorizontal: 20,
    marginTop: 15,
    elevation: 3,
  },

  passwordContainer: {
    width: "80%",
    position: "relative",
  },

  inputFull: {
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    color: "#111827",
    paddingHorizontal: 20,
    paddingRight: 45,
    marginTop: 15,
    elevation: 3,
  },

  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 28,
  },

  inputError: {
    borderWidth: 1,
    borderColor: "red",
  },

  errorText: {
    color: "red",
    fontSize: 12,
    width: "80%",
  },

  errorTextGeneral: {
    color: "red",
    marginTop: 10,
  },

  forgotPasswordContainer: {
    width: "80%",
    alignItems: "flex-end",
    marginTop: 10,
  },

  forgotPasswordText: {
    color: "gray",
  },

  buttonContainer: {
    width: "60%",
    marginTop: 25,
  },

  gradient: {
    padding: 15,
    borderRadius: 30,
    alignItems: "center",
  },

  textButton: {
    color: "#fff",
    fontWeight: "bold",
  },
});