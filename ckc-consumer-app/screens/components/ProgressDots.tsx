// Small progress indicator — shows which step of onboarding you're on
import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/theme';

type Props = {
  total: number;    // total number of steps
  current: number;  // which step (0-indexed)
};

export default function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current   && styles.dotActive,
            i < current     && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 18,
    backgroundColor: Colors.textPrimary,
  },
  dotDone: {
    backgroundColor: Colors.textMuted,
  },
});
