# 🩺 EcoSalud

EcoSalud es una aplicación móvil de gestión de expedientes clínicos, desarrollada con **React Native y TypeScript**, que permite administrar pacientes, registrar consultas y mantener un historial clínico utilizando servicios en la nube.

Este repositorio corresponde a una **extensión y continuación independiente del proyecto académico original**, con el objetivo de seguir desarrollando nuevas funcionalidades, mejorar la interfaz y ampliar las capacidades de la aplicación.

---

## 📱 Funcionalidades

- Registro y autenticación de usuarios.
- Creación y administración de pacientes.
- Registro de consultas médicas.
- Historial clínico por paciente.
- Gestión y programación de citas.
- Estados de citas: pendiente, en espera, en consulta, atendida y cancelada.
- Búsqueda de pacientes y síntomas.
- Registro de signos vitales, síntomas, diagnóstico y recomendaciones.
- Carga de fotografías de pacientes.
- Generación y compartición de expedientes en PDF.
- Compartición de pacientes entre usuarios.
- Manejo de información en tiempo real mediante Firebase Firestore.

---

## 🛠️ Tecnologías utilizadas

- **React Native** — Desarrollo de la aplicación móvil.
- **TypeScript** — Lenguaje principal del proyecto.
- **Expo** — Entorno y herramientas para desarrollo, pruebas y compilación.
- **Expo Router** — Navegación entre pantallas.
- **Firebase Authentication** — Autenticación de usuarios mediante correo y contraseña.
- **Firebase Firestore** — Base de datos NoSQL en la nube y sincronización de información en tiempo real.
- **Cloudinary** — Almacenamiento de imágenes.
- **Expo Print / Sharing** — Generación y compartición de expedientes en formato PDF.
- **React Native Calendars** — Calendario para gestión y visualización de citas.
- **EAS Build** — Generación de la aplicación para Android.

---

## 📂 Arquitectura general

La aplicación utiliza una arquitectura basada en componentes y pantallas de React Native.

Firebase proporciona los servicios de autenticación y almacenamiento de información, mientras que Firestore permite mantener sincronizados los datos relacionados con usuarios, pacientes, consultas y citas.

Cloudinary se utiliza para el almacenamiento de imágenes asociadas a pacientes y perfiles de usuario.

---

## 🎓 Origen del proyecto

EcoSalud fue desarrollado originalmente en **2026** como un proyecto académico para la materia de **Dispositivos Móviles**, dentro de la carrera de **Ingeniería en Tecnología de Software** de la Facultad de Ingeniería Mecánica y Eléctrica de la Universidad Autónoma de Nuevo León.

La versión inicial del proyecto fue desarrollada de manera colaborativa por un equipo de estudiantes.

### 👥 Equipo de desarrollo original

- **Jan Carlos Márquez López**
- **Juan Pablo González Gallegos**
- **José Armando Campa Barajas**
- **Diego Armando Treviño Adame**
- **Nestor Alejandro Valencia Cantú**

> Los integrantes de esta sección corresponden al equipo que participó en el desarrollo académico original de EcoSalud.

---

## 🚀 Continuación del proyecto

Este repositorio representa una **derivación independiente del proyecto original**, mantenida actualmente por:

**Jan Carlos Márquez López**

La intención de esta versión es continuar desarrollando EcoSalud de manera individual, conservando la base funcional creada durante el proyecto académico e incorporando nuevas mejoras y funcionalidades.

Entre los objetivos de esta versión se encuentran:

- Mejorar la interfaz y experiencia de usuario.
- Corregir y optimizar funcionalidades existentes.
- Mejorar la estructura y mantenimiento del código.
- Ampliar el seguimiento e historial de los pacientes.
- Incorporar nuevas herramientas de apoyo clínico.
- Explorar la implementación de componentes de sistemas inteligentes.

---

## 🧠 Evolución hacia un sistema inteligente

Como parte de la evolución del proyecto, se contempla incorporar un módulo inteligente de apoyo clínico capaz de analizar información registrada en EcoSalud, como:

- Síntomas.
- Signos vitales.
- Edad.
- Antecedentes.
- Historial de consultas.

El objetivo es utilizar esta información para generar **alertas, niveles de prioridad y recomendaciones de apoyo**, mediante un sistema basado en conocimiento y reglas.

Este módulo está planteado como una herramienta de apoyo para el personal médico y **no busca sustituir el criterio profesional ni emitir diagnósticos médicos definitivos**.

---

## 👨‍💻 Mantenimiento actual

Actualmente el desarrollo, mantenimiento y evolución de esta versión de EcoSalud está a cargo de:

**Jan Carlos Márquez López**  
Estudiante de Ingeniería en Tecnología de Software — FIME, UANL
