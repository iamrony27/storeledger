import React, { createContext, useContext, useRef, useState, useCallback } from 'react';
import { Animated, NativeSyntheticEvent, NativeScrollEvent, Easing } from 'react-native';

export interface TabBarVisibilityContextType {
  tabBarTranslateY: Animated.Value | Animated.AnimatedInterpolation<number>;
  isTabBarVisible: boolean;
  topBarCollapseAnim: Animated.Value;
  isTopBarCollapsed: boolean;
  scrollY: Animated.Value;
  diffClampedScrollY: Animated.AnimatedDiffClamp<number>;
  showTabBar: () => void;
  hideTabBar: () => void;
  expandTopBar: () => void;
  collapseTopBar: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextType | undefined>(undefined);

export const TabBarVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [animatedNodes] = useState(() => {
    const scrollY = new Animated.Value(0);

    // 1. Prevent negative overscroll rubber-banding on iOS/Android from jittering diffClamp
    const safeScrollY = scrollY.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolateLeft: 'clamp',
    });

    // 2. Native continuous diffClamp for drawer (96dp)
    const diffClampedScrollY = Animated.diffClamp(safeScrollY, 0, 96);

    // 3. Native dock tab bar translation (slides down smoothly with scroll)
    const nativeTabBarTranslateY = diffClampedScrollY.interpolate({
      inputRange: [0, 96],
      outputRange: [0, 120],
      extrapolate: 'clamp',
    });

    return {
      scrollY,
      diffClampedScrollY,
      nativeTabBarTranslateY,
    };
  });

  const { scrollY, diffClampedScrollY, nativeTabBarTranslateY } = animatedNodes;

  const [tabBarTranslateY] = useState(() => new Animated.Value(0));
  const isTabBarVisibleRef = useRef(true);
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const [topBarCollapseAnim] = useState(() => new Animated.Value(0));
  const isTopBarCollapsedRef = useRef(false);
  const [isTopBarCollapsed, setIsTopBarCollapsed] = useState(false);

  const prevOffsetY = useRef(0);

  const showTabBar = useCallback(() => {
    if (!isTabBarVisibleRef.current) {
      isTabBarVisibleRef.current = true;
      setIsTabBarVisible(true);
      Animated.timing(tabBarTranslateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [tabBarTranslateY]);

  const hideTabBar = useCallback(() => {
    if (isTabBarVisibleRef.current) {
      isTabBarVisibleRef.current = false;
      setIsTabBarVisible(false);
      Animated.timing(tabBarTranslateY, {
        toValue: 120,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [tabBarTranslateY]);

  const expandTopBar = useCallback(() => {
    if (isTopBarCollapsedRef.current) {
      isTopBarCollapsedRef.current = false;
      setIsTopBarCollapsed(false);
      Animated.timing(topBarCollapseAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [topBarCollapseAnim]);

  const collapseTopBar = useCallback(() => {
    if (!isTopBarCollapsedRef.current) {
      isTopBarCollapsedRef.current = true;
      setIsTopBarCollapsed(true);
      Animated.timing(topBarCollapseAnim, {
        toValue: 1,
        duration: 340,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }).start();
    }
  }, [topBarCollapseAnim]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentOffsetY = event.nativeEvent.contentOffset.y;
      const diff = currentOffsetY - prevOffsetY.current;

      // 1. If at or near top of the list, always open drawer
      if (currentOffsetY <= 20) {
        showTabBar();
        expandTopBar();
      } else if (diff > 5 && currentOffsetY > 30) {
        // 2. Scrolling downwards past top zone -> smoothly slide drawer closed
        hideTabBar();
        collapseTopBar();
      } else if (diff < -8) {
        // 3. Scrolling upwards -> smoothly slide drawer open
        showTabBar();
        expandTopBar();
      }

      prevOffsetY.current = currentOffsetY;
    },
    [showTabBar, hideTabBar, expandTopBar, collapseTopBar]
  );

  return (
    <TabBarVisibilityContext.Provider
      value={{
        tabBarTranslateY: nativeTabBarTranslateY,
        isTabBarVisible,
        topBarCollapseAnim,
        isTopBarCollapsed,
        scrollY,
        diffClampedScrollY,
        showTabBar,
        hideTabBar,
        expandTopBar,
        collapseTopBar,
        handleScroll,
      }}
    >
      {children}
    </TabBarVisibilityContext.Provider>
  );
};

export const useTabBarVisibility = (): TabBarVisibilityContextType => {
  const context = useContext(TabBarVisibilityContext);
  if (!context) {
    const fallbackAnim = new Animated.Value(0);
    const fallbackCollapse = new Animated.Value(0);
    const fallbackScrollY = new Animated.Value(0);
    const fallbackClamped = Animated.diffClamp(fallbackScrollY, 0, 96);
    return {
      tabBarTranslateY: fallbackAnim,
      isTabBarVisible: true,
      topBarCollapseAnim: fallbackCollapse,
      isTopBarCollapsed: false,
      scrollY: fallbackScrollY,
      diffClampedScrollY: fallbackClamped,
      showTabBar: () => {},
      hideTabBar: () => {},
      expandTopBar: () => {},
      collapseTopBar: () => {},
      handleScroll: () => {},
    };
  }
  return context;
};
