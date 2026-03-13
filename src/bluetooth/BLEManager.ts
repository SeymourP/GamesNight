import { BleManager } from 'react-native-ble-plx';

// One single instance shared across the whole app
// Creating multiple instances causes crashes
export const bleManager = new BleManager();