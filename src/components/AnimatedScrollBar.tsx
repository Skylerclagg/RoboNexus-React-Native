/**
 * AnimatedScrollBar Component
 *
 * A simple, interactive scroll indicator for FlatList components.
 *
 * Features:
 * - Draggable grip tab for quick navigation
 * - Auto-hides after 2 seconds of inactivity
 * - Theme-aware styling
 * - Visual grip indicator with dots
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('AnimatedScrollBar');
import { View, Animated, StyleSheet, PanResponder } from 'react-native';

interface AnimatedScrollBarProps {
  scrollY: number;
  contentHeight: number;
  viewportHeight: number;
  color?: string;
  enabled?: boolean;
  scrollViewRef?: React.RefObject<any>;
}

const AnimatedScrollBar: React.FC<AnimatedScrollBarProps> = ({
  scrollY,
  contentHeight,
  viewportHeight,
  color = '#888',
  enabled = true,
  scrollViewRef,
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const thumbPosition = useRef(new Animated.Value(0)).current;
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Don't show scroll bar if content fits in viewport
  const shouldShow = enabled && contentHeight > viewportHeight && viewportHeight > 0;

  // Calculate thumb size - proportional to visible content
  const scrollRatio = Math.min(1, viewportHeight / contentHeight);
  const thumbHeight = Math.max(viewportHeight * scrollRatio, 50);

  // Calculate max scroll positions
  // Add a small buffer to ensure we can reach the very bottom (FlatList sometimes has extra padding)
  const maxScrollY = Math.max(0, contentHeight - viewportHeight + 10);
  const maxThumbY = Math.max(0, viewportHeight - thumbHeight);

  // Calculate current thumb position based on scroll
  const currentScrollPercentage = maxScrollY > 0 ? scrollY / maxScrollY : 0;
  const calculatedThumbTop = currentScrollPercentage * maxThumbY;

  // Store current values in ref for PanResponder
  const valuesRef = useRef({
    calculatedThumbTop,
    maxThumbY,
    maxScrollY,
    scrollY,
  });

  useEffect(() => {
    valuesRef.current = {
      calculatedThumbTop,
      maxThumbY,
      maxScrollY,
      scrollY,
    };
  }, [calculatedThumbTop, maxThumbY, maxScrollY, scrollY]);

  // Update thumb position when not dragging
  useEffect(() => {
    if (!isDragging && shouldShow) {
      thumbPosition.setValue(calculatedThumbTop);
    }
  }, [calculatedThumbTop, isDragging, shouldShow]);

  // Show/hide animation
  const resetHideTimer = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }

    hideTimeoutRef.current = setTimeout(() => {
      if (!isDragging) {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    }, 2000);
  };

  useEffect(() => {
    if (!shouldShow) return;

    if (!isDragging) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      resetHideTimer();
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [scrollY, shouldShow, isDragging]);

  // Store drag start position
  const dragStartY = useRef(0);

  // Pan responder for dragging - use useMemo to recreate when dependencies change
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setIsDragging(true);
          dragStartY.current = valuesRef.current.calculatedThumbTop;

          Animated.timing(opacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderMove: (evt, gestureState) => {
          if (!scrollViewRef?.current) return;

          const { maxThumbY, maxScrollY } = valuesRef.current;

          if (maxThumbY <= 0 || maxScrollY <= 0) return;

          // Calculate new thumb position from drag start
          const newThumbY = Math.max(0, Math.min(maxThumbY, dragStartY.current + gestureState.dy));
          thumbPosition.setValue(newThumbY);

          // Calculate corresponding scroll position
          const scrollPercentage = maxThumbY > 0 ? newThumbY / maxThumbY : 0;
          const newScrollY = scrollPercentage * maxScrollY;

          // Scroll the list with slight animation to prevent triggering skeleton loaders
          try {
            if (scrollViewRef.current.scrollToOffset) {
              scrollViewRef.current.scrollToOffset({ offset: newScrollY, animated: true });
            } else if (scrollViewRef.current.scrollTo) {
              scrollViewRef.current.scrollTo({ y: newScrollY, animated: true });
            }
          } catch (error) {
            logger.error('Scroll error:', error);
          }
        },
        onPanResponderRelease: () => {
          setIsDragging(false);
          resetHideTimer();
        },
        onPanResponderTerminate: () => {
          setIsDragging(false);
          resetHideTimer();
        },
      }),
    [scrollViewRef, opacity, thumbPosition]
  );

  if (!shouldShow) {
    return null;
  }

  // Number of dots based on thumb height
  const dotCount = thumbHeight < 60 ? 3 : 6;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.gripContainer,
          {
            height: thumbHeight,
            backgroundColor: color,
            opacity: opacity,
            transform: [{ translateY: thumbPosition }],
            width: isDragging ? 28 : 24,
          },
        ]}
      >
        {[...Array(dotCount)].map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor: isDragging ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)',
              },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  gripContainer: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});

export default AnimatedScrollBar;
