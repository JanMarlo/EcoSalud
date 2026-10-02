// Componentes visuales del agente: badge de prioridad, banner y tarjeta de alerta.
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Alerta, PrioridadFinal } from "../../lib/agente/tipos";

export const COLORES = {
  marca: "#1E5FA8",
  marcaClaro: "#2FA4D6",
  fondo: "#F5F7FB",
  tarjeta: "#FFFFFF",
  texto: "#14213D",
  textoSuave: "#5B6472",
  borde: "#E4E8EF",
};

type Tema = {
  etiqueta: string;
  titulo: string;
  icono: keyof typeof Ionicons.glyphMap;
  color: string;
  fondo: string;
  borde: string;
};

// Cada nivel se distingue por color, ícono y texto (RNF-07).
export const TEMA_PRIORIDAD: Record<PrioridadFinal, Tema> = {
  alta: {
    etiqueta: "Alta",
    titulo: "Prioridad alta",
    icono: "alert-circle",
    color: "#B42318",
    fondo: "#FEF3F2",
    borde: "#FECDCA",
  },
  media: {
    etiqueta: "Media",
    titulo: "Prioridad media",
    icono: "warning",
    color: "#B54708",
    fondo: "#FFFAEB",
    borde: "#FEDF89",
  },
  baja: {
    etiqueta: "Baja",
    titulo: "Prioridad baja",
    icono: "information-circle",
    color: "#175CD3",
    fondo: "#EFF8FF",
    borde: "#B2DDFF",
  },
  ninguna: {
    etiqueta: "Sin alertas",
    titulo: "Sin alertas",
    icono: "checkmark-circle",
    color: "#067647",
    fondo: "#ECFDF3",
    borde: "#ABEFC6",
  },
};

export function BadgePrioridad({ prioridad, compacto }: { prioridad: PrioridadFinal; compacto?: boolean }) {
  const t = TEMA_PRIORIDAD[prioridad];
  return (
    <View
      style={[s.badge, { backgroundColor: t.fondo, borderColor: t.borde }]}
      accessibilityLabel={`Prioridad ${t.etiqueta}`}
    >
      <Ionicons name={t.icono} size={compacto ? 13 : 15} color={t.color} />
      <Text style={[s.badgeTexto, { color: t.color, fontSize: compacto ? 12 : 13 }]}>{t.etiqueta}</Text>
    </View>
  );
}

const ESTADO = {
  pendiente: { texto: "Pendiente", icono: "time-outline" as const, color: "#5B6472" },
  revisada: { texto: "Revisada", icono: "checkmark-done" as const, color: "#067647" },
  descartada: { texto: "Descartada", icono: "close-circle-outline" as const, color: "#5B6472" },
};

export function TarjetaAlerta({
  alerta,
  onRevisar,
  onDescartar,
  onReabrir,
  onAgendar,
}: {
  alerta: Alerta;
  onRevisar: () => void;
  onDescartar: () => void;
  onReabrir: () => void;
  onAgendar?: () => void;
}) {
  const t = TEMA_PRIORIDAD[alerta.prioridad];
  const e = ESTADO[alerta.estado];
  const cerrada = alerta.estado !== "pendiente";

  return (
    <View style={[s.card, cerrada && s.cardCerrada]}>
      <View style={[s.cardFranja, { backgroundColor: t.fondo, borderBottomColor: t.borde }]}>
        <BadgePrioridad prioridad={alerta.prioridad} compacto />
        <Text style={s.reglaId}>{alerta.reglaId}</Text>
        <View style={{ flex: 1 }} />
        <View style={s.estado}>
          <Ionicons name={e.icono} size={14} color={e.color} />
          <Text style={[s.estadoTexto, { color: e.color }]}>{e.texto}</Text>
        </View>
      </View>

      <View style={s.cardCuerpo}>
        <Text style={s.alertaTitulo}>{alerta.nombre}</Text>
        <Text style={s.alertaMensaje}>{alerta.mensaje}</Text>

        <Text style={s.subtitulo}>Por qué se activó</Text>
        <View style={s.evidencias}>
          {alerta.evidencia.map((ev, i) => (
            <View key={i} style={[s.evidenciaFila, i > 0 && s.evidenciaSeparador]}>
              <Text style={s.evidenciaDato}>{ev.dato}</Text>
              <View style={{ alignItems: "flex-end", flexShrink: 1 }}>
                <Text style={s.evidenciaValor}>{ev.valor}</Text>
                {ev.umbral ? <Text style={s.evidenciaUmbral}>Umbral {ev.umbral}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        <View style={s.recomendacion}>
          <Ionicons name="clipboard-outline" size={18} color={COLORES.marca} />
          <Text style={s.recomendacionTexto}>{alerta.recomendacion}</Text>
        </View>

        {alerta.comentario ? (
          <View style={s.comentario}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORES.textoSuave} />
            <Text style={s.comentarioTexto}>{alerta.comentario}</Text>
          </View>
        ) : null}

        {alerta.seguimientoDias && onAgendar ? (
          <TouchableOpacity style={s.botonSeguimiento} onPress={onAgendar} accessibilityRole="button">
            <Ionicons name="calendar-outline" size={18} color={COLORES.marca} />
            <Text style={s.botonSeguimientoTexto}>Agendar seguimiento en {alerta.seguimientoDias} días</Text>
          </TouchableOpacity>
        ) : null}

        <View style={s.acciones}>
          {cerrada ? (
            <TouchableOpacity style={s.botonTexto} onPress={onReabrir} accessibilityRole="button">
              <Ionicons name="arrow-undo-outline" size={16} color={COLORES.textoSuave} />
              <Text style={s.botonTextoLabel}>Reabrir</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={s.botonTexto} onPress={onDescartar} accessibilityRole="button">
                <Text style={s.botonTextoLabel}>Descartar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.botonPrimario} onPress={onRevisar} accessibilityRole="button">
                <Ionicons name="checkmark" size={18} color="#fff" />
                <Text style={s.botonPrimarioTexto}>Marcar revisada</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

export const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeTexto: { fontWeight: "700" },
  card: {
    backgroundColor: COLORES.tarjeta,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORES.borde,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#0B1B33",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardCerrada: { opacity: 0.72 },
  cardFranja: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  reglaId: { fontSize: 12, fontWeight: "700", color: COLORES.textoSuave, letterSpacing: 0.5 },
  estado: { flexDirection: "row", alignItems: "center", gap: 4 },
  estadoTexto: { fontSize: 12, fontWeight: "600" },
  cardCuerpo: { padding: 16 },
  alertaTitulo: { fontSize: 17, fontWeight: "700", color: COLORES.texto },
  alertaMensaje: { fontSize: 14, color: COLORES.textoSuave, marginTop: 4, lineHeight: 20 },
  subtitulo: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORES.textoSuave,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 6,
  },
  evidencias: { backgroundColor: COLORES.fondo, borderRadius: 12, paddingHorizontal: 12 },
  evidenciaFila: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  evidenciaSeparador: { borderTopWidth: 1, borderTopColor: COLORES.borde },
  evidenciaDato: { fontSize: 14, color: COLORES.textoSuave },
  evidenciaValor: { fontSize: 14, fontWeight: "700", color: COLORES.texto, textAlign: "right" },
  evidenciaUmbral: { fontSize: 12, color: COLORES.textoSuave, marginTop: 2 },
  recomendacion: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#EEF4FB",
  },
  recomendacionTexto: { flex: 1, fontSize: 14, color: COLORES.texto, lineHeight: 20 },
  comentario: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "flex-start" },
  comentarioTexto: { flex: 1, fontSize: 13, color: COLORES.textoSuave, fontStyle: "italic" },
  botonSeguimiento: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFD3EC",
  },
  botonSeguimientoTexto: { color: COLORES.marca, fontWeight: "600", fontSize: 14 },
  acciones: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 14 },
  botonTexto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  botonTextoLabel: { color: COLORES.textoSuave, fontWeight: "600", fontSize: 14 },
  botonPrimario: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: COLORES.marca,
  },
  botonPrimarioTexto: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
