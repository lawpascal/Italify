import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

const { width, height } = Dimensions.get("window");
const COLORS = ["#E63946", "#FFD166", "#06D6A0", "#118AB2", "#EF476F", "#B91C1C"];

function Piece({ index }: { index: number }) {
  const x = useSharedValue(width / 2);
  const y = useSharedValue(height / 3);
  const rot = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const targetX = Math.random() * width;
    const targetY = height + 40;
    const delay = index * 20;
    x.value = withDelay(delay, withTiming(targetX, { duration: 2500, easing: Easing.out(Easing.cubic) }));
    y.value = withDelay(delay, withTiming(targetY, { duration: 2500, easing: Easing.in(Easing.quad) }));
    rot.value = withDelay(delay, withTiming(Math.random() * 720, { duration: 2500 }));
    opacity.value = withDelay(delay + 2000, withTiming(0, { duration: 500 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    position: "absolute",
    left: x.value,
    top: y.value,
    opacity: opacity.value,
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  const color = COLORS[index % COLORS.length];
  const size = 8 + Math.random() * 8;
  return (
    <Animated.View
      style={[
        style,
        { width: size, height: size * 1.6, backgroundColor: color, borderRadius: 2 },
      ]}
    />
  );
}

export default function Confetti({ count = 60 }: { count?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} />
      ))}
    </View>
  );
}
