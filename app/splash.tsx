import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";

import logo from "../assets/images/logo2.png";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/login");
    }, 2500);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <LinearGradient
      colors={["#1E5FA8", "#2FA4D6"]}
      style={styles.container}
    >
      <View style={styles.logoContainer}>
        <Image source={logo} style={styles.logo} />
      </View>

      <Text style={styles.title}>EcoSalud</Text>
      <Text style={styles.subtitle}>
        Gestión Inteligente de Pacientes
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  logoContainer: {
    width: 150,
    height: 150,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
  },

  logo: {
    width: 120,
    height: 120,
    resizeMode: "contain",
  },

  title: {
    marginTop: 25,
    fontSize: 38,
    fontWeight: "bold",
    color: "#fff",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#e0f2fe",
  },
});