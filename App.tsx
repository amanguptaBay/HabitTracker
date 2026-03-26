import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { User } from 'firebase/auth';
import { HabitDataProvider } from './src/context/HabitDataContext';
import { subscribeToAuth } from './src/services/auth';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ManageScreen from './src/screens/ManageScreen';
import { RootStackParamList } from './src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [user, setUser]             = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return subscribeToAuth((u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  // Splash — waiting for Firebase to restore auth state
  if (authLoading) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  // Not signed in — show login
  if (!user) {
    return (
      <>
        <StatusBar style="light" />
        <LoginScreen />
      </>
    );
  }

  // Signed in — show app
  return (
    <HabitDataProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Manage"
            component={ManageScreen}
            options={{ title: 'Manage Routines', headerBackTitle: 'Back' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </HabitDataProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
