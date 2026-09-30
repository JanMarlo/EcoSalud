import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

export default function ForgotPassword() {
  const handleContactSupport = () => {
    Alert.alert(
      'Restablecer Contraseña',
      'Para brindarle una nueva contraseña, por favor, contacte con el área de tecnología del hospital.',
      [{ text: 'Entendido' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="lock-closed-outline" size={80} color="#333" />
        <Text style={styles.title}>¿Olvidaste tu Contraseña?</Text>
        <Text style={styles.instructions}>
          Para proteger la seguridad de los datos, el restablecimiento de contraseña se gestiona en el departamento de tecnologia del hospital.
        </Text>

        <TouchableOpacity style={styles.button} onPress={handleContactSupport}>
           <LinearGradient
              colors={['#2FA4D6', '#1E5FA8']}
              style={styles.gradient}
            >
              <Text style={styles.textButton}>Contactar a Soporte ############</Text>
           </LinearGradient>
        </TouchableOpacity>

        <Link href="/" asChild>
          <TouchableOpacity>
            <Text style={styles.backToLogin}>Volver a Iniciar Sesión</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fb',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 15,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    marginBottom: 20,
  },
  gradient: {
    flex: 1,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backToLogin: {
    fontSize: 15,
    color: '#1E5FA8',
    fontWeight: '600',
    marginTop: 10,
  },
});
