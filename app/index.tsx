import { useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import {
  joinRoom,
  sendToHost,
  startScanning,
  stopScanning,
} from '../src/bluetooth/guest';
import {
  sendToAllGuests,
  startHosting,
  stopHosting,
} from '../src/bluetooth/host';
import {
  requestBluetoothPermissions,
  showPermissionDeniedAlert,
} from '../src/bluetooth/permissions';

type Message = { id: string; from: string; text: string };
type Mode = 'idle' | 'hosting' | 'scanning' | 'connected';

export default function Index() {
  const [mode, setMode] = useState<Mode>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [nearbyRooms, setNearbyRooms] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [connectedGuests, setConnectedGuests] = useState<string[]>([]);
  const [status, setStatus] = useState('Choose a role');

  const addMessage = (from: string, text: string) => {
    setMessages(prev => [
      { id: Date.now().toString(), from, text },
      ...prev,
    ]);
  };

  // ── HOST ──────────────────────────────────────────────────────────────────

  const handleHost = async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      showPermissionDeniedAlert();
      return;
    }

    setMode('hosting');
    setStatus('Advertising... waiting for guests');

    await startHosting(
      'GamesNight Room',
      (deviceId, message) => {
        addMessage(`Guest ${deviceId.slice(0, 6)}`, message);
      },
      (deviceId) => {
        setConnectedGuests(prev => [...prev, deviceId]);
        setStatus(`Guest connected!`);
        addMessage('System', `Guest ${deviceId.slice(0, 6)} joined ✓`);
      },
      (deviceId) => {
        setConnectedGuests(prev => prev.filter(id => id !== deviceId));
        setStatus('Guest disconnected');
        addMessage('System', `Guest ${deviceId.slice(0, 6)} left`);
      },
    );
  };

  const handleHostSend = async () => {
    if (!input.trim() || connectedGuests.length === 0) return;
    const text = input.trim();
    setInput('');
    addMessage('You (host)', text);
    await sendToAllGuests(text);
  };

  // ── GUEST ─────────────────────────────────────────────────────────────────

  const handleScan = async () => {
    const granted = await requestBluetoothPermissions();
    if (!granted) {
      showPermissionDeniedAlert();
      return;
    }

    setMode('scanning');
    setStatus('Scanning for nearby rooms...');
    setNearbyRooms([]);

    startScanning((device) => {
      setNearbyRooms(prev => {
        if (prev.find(d => d.id === device.id)) return prev;
        return [...prev, device];
      });
    });
  };

  const handleJoin = async (device: Device) => {
    setStatus(`Connecting to ${device.localName}...`);
    try {
      const connected = await joinRoom(
        device,
        (message) => addMessage('Host', message),
        () => {
          setMode('idle');
          setConnectedDevice(null);
          setStatus('Disconnected from host');
          Alert.alert('Disconnected', 'Lost connection to the host.');
        },
      );
      setConnectedDevice(connected);
      setMode('connected');
      setStatus(`Connected to ${device.localName} ✓`);
      addMessage('System', `Connected to ${device.localName} ✓`);
    } catch (e) {
      setStatus('Connection failed — try again');
      Alert.alert('Failed', 'Could not connect. Make sure the other phone is hosting.');
      setMode('scanning');
    }
  };

  const handleGuestSend = async () => {
    if (!input.trim() || !connectedDevice) return;
    const text = input.trim();
    setInput('');
    addMessage('You (guest)', text);
    await sendToHost(connectedDevice, text);
  };

  // ── RESET ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    stopHosting();
    stopScanning();
    setMode('idle');
    setMessages([]);
    setNearbyRooms([]);
    setConnectedDevice(null);
    setConnectedGuests([]);
    setStatus('Choose a role');
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  const isHost = mode === 'hosting';
  const isGuest = mode === 'connected';
  const canSend = isHost ? connectedGuests.length > 0 : isGuest;

  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.dot,
            { backgroundColor: mode === 'idle' ? '#666' : mode === 'scanning' ? '#f0c040' : '#2ecc71' }
          ]} />
          <Text style={styles.status}>{status}</Text>
        </View>
        {mode !== 'idle' && (
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetBtn}>Reset</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Idle — pick a role */}
      {mode === 'idle' && (
        <View style={styles.center}>
          <Text style={styles.title}>🃏 Games Night</Text>
          <Text style={styles.subtitle}>BLE Connection Test</Text>
          <Text style={styles.instructions}>
            On one phone tap Host, on the other tap Find.
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={handleHost}>
            <Text style={styles.btnPrimaryText}>📡  Host a Room</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleScan}>
            <Text style={styles.btnSecondaryText}>🔍  Find a Room</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Guest scanning — show found rooms */}
      {mode === 'scanning' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby Rooms</Text>
          {nearbyRooms.length === 0 ? (
            <Text style={styles.empty}>
              Searching... make sure the other phone has tapped "Host a Room"
            </Text>
          ) : (
            <FlatList
              data={nearbyRooms}
              keyExtractor={d => d.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.roomItem}
                  onPress={() => handleJoin(item)}
                >
                  <View>
                    <Text style={styles.roomName}>
                      {item.localName ?? 'GamesNight Room'}
                    </Text>
                    <Text style={styles.roomId}>{item.id.slice(0, 20)}...</Text>
                  </View>
                  <Text style={styles.joinBtn}>Join →</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      {/* Message log — shown when hosting or connected */}
      {(isHost || isGuest) && (
        <>
          <FlatList
            data={messages}
            keyExtractor={m => m.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageContent}
            renderItem={({ item }) => (
              <View style={styles.message}>
                <Text style={styles.messageFrom}>{item.from}</Text>
                <Text style={styles.messageText}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {isHost
                  ? 'Waiting for a guest to join...'
                  : 'Connected! Say hello 👋'}
              </Text>
            }
          />

          {/* Input row */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Type a message..."
              placeholderTextColor="#555"
              onSubmitEditing={isHost ? handleHostSend : handleGuestSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={isHost ? handleHostSend : handleGuestSend}
              disabled={!canSend}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    color: '#aaa',
    fontSize: 13,
  },
  resetBtn: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: {
    color: '#f0c040',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 16,
    marginBottom: 4,
  },
  instructions: {
    color: '#555',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  btnPrimary: {
    width: '100%',
    padding: 18,
    backgroundColor: '#f0c040',
    borderRadius: 14,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#1a1200',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    width: '100%',
    padding: 18,
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  btnSecondaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  roomItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  roomName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 4,
  },
  roomId: {
    color: '#555',
    fontSize: 11,
  },
  joinBtn: {
    color: '#f0c040',
    fontWeight: '700',
    fontSize: 15,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: 16,
  },
  message: {
    marginBottom: 16,
  },
  messageFrom: {
    color: '#f0c040',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  empty: {
    color: '#444',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    lineHeight: 22,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  sendBtn: {
    backgroundColor: '#f0c040',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#2a2a2a',
  },
  sendBtnText: {
    color: '#1a1200',
    fontWeight: '700',
  },
});