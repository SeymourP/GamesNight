import { decode, encode } from 'base-64';
import { Characteristic, Device } from 'react-native-ble-plx';
import { bleManager } from './BLEManager';
import { MESSAGE_UUID, MTU_SIZE, SERVICE_UUID } from './constants';

type OnMessageCallback = (deviceId: string, message: string) => void;
type OnGuestCallback = (deviceId: string) => void;

let connectedGuests: Device[] = [];

export async function startHosting(
  roomName: string,
  onMessage: OnMessageCallback,
  onGuestConnected: OnGuestCallback,
  onGuestDisconnected: OnGuestCallback,
) {
  connectedGuests = [];

  // Scan for guests trying to connect to us
  bleManager.startDeviceScan(
    [SERVICE_UUID],
    null,
    async (error, device: Device | null) => {
      if (error || !device) return;

      try {
        const connected = await device.connect();
        await connected.requestMTU(MTU_SIZE);
        await connected.discoverAllServicesAndCharacteristics();

        connectedGuests = [...connectedGuests, connected];
        onGuestConnected(connected.id);

        connected.onDisconnected(() => {
          connectedGuests = connectedGuests.filter(g => g.id !== connected.id);
          onGuestDisconnected(connected.id);
        });

        connected.monitorCharacteristicForService(
          SERVICE_UUID,
          MESSAGE_UUID,
          (err: Error | null, characteristic: Characteristic | null) => {
            if (err || !characteristic?.value) return;
            const message = decode(characteristic.value);
            onMessage(connected.id, message);
          }
        );
      } catch (e) {
        console.warn('Failed to connect to guest:', e);
      }
    }
  );
}

export async function sendToGuest(
  deviceId: string,
  message: string,
): Promise<void> {
  try {
    const encoded = encode(message);
    await bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      SERVICE_UUID,
      MESSAGE_UUID,
      encoded,
    );
  } catch (e) {
    console.warn('Failed to send to guest:', e);
  }
}

export async function sendToAllGuests(message: string): Promise<void> {
  for (const guest of connectedGuests) {
    await sendToGuest(guest.id, message);
  }
}

export function stopHosting() {
  bleManager.stopDeviceScan();
  connectedGuests = [];
}