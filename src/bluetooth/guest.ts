import { decode, encode } from 'base-64';
import { Device } from 'react-native-ble-plx';
import { bleManager } from './BLEManager';
import { MESSAGE_UUID, MTU_SIZE, SERVICE_UUID } from './constants';

type OnMessageCallback = (message: string) => void;
type OnDisconnectedCallback = () => void;
type OnRoomFoundCallback = (device: Device) => void;

export function startScanning(onRoomFound: OnRoomFoundCallback) {
  bleManager.startDeviceScan(
    [SERVICE_UUID],
    { allowDuplicates: false },
    (error, device) => {
      if (error) {
        console.warn('Scan error:', error);
        return;
      }
      if (device?.localName) {
        onRoomFound(device);
      }
    }
  );
}

export async function joinRoom(
  device: Device,
  onMessage: OnMessageCallback,
  onDisconnected: OnDisconnectedCallback,
): Promise<Device> {
  bleManager.stopDeviceScan();

  // Connect to the host
  const connected = await device.connect();

  // Request larger packet size for better performance
  await connected.requestMTU(MTU_SIZE);

  // Discover the host's services and characteristics
  await connected.discoverAllServicesAndCharacteristics();

  // Watch for disconnection
  connected.onDisconnected(() => {
    onDisconnected();
  });

  // Subscribe to messages from host
  connected.monitorCharacteristicForService(
    SERVICE_UUID,
    MESSAGE_UUID,
    (error, characteristic) => {
      if (error || !characteristic?.value) return;
      const message = decode(characteristic.value);
      onMessage(message);
    }
  );

  return connected;
}

export async function sendToHost(
  device: Device,
  message: string,
): Promise<void> {
  try {
    const encoded = encode(message);
    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      MESSAGE_UUID,
      encoded,
    );
  } catch (e) {
    console.warn('Failed to send to host:', e);
  }
}

export function stopScanning() {
  bleManager.stopDeviceScan();
}