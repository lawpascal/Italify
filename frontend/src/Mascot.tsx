import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { COLORS, TORTELLINO_URL } from "./theme";

export default function Mascot({ size = 80 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image
        source={{ uri: TORTELLINO_URL }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
});
