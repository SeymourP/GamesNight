import { Alert, Linking, Platform } from 'react-native';
import {
    PERMISSIONS,
    request,
    requestMultiple,
    RESULTS,
} from 'react-native-permissions';

export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const result = await request(PERMISSIONS.IOS.BLUETOOTH);
    return result === RESULTS.GRANTED;
  }

  if (Platform.OS === 'android') {
    if (Platform.Version >= 31) {
      // Android 12+
      const results = await requestMultiple([
        PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
        PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
        PERMISSIONS.ANDROID.BLUETOOTH_ADVERTISE,
      ]);
      return Object.values(results).every(r => r === RESULTS.GRANTED);
    } else {
      // Android 11 and below
      const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
      return result === RESULTS.GRANTED;
    }
  }

  return false;
}

export function showPermissionDeniedAlert() {
  Alert.alert(
    'Bluetooth Permission Required',
    'Games Night uses Bluetooth to connect with other players. Please enable it in Settings.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]
  );
}