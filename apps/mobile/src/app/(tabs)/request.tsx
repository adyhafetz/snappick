import { router } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function RequestScreen() { return <PlaceholderScreen title="Pickup requests" description="Pickup requests are not available in this build yet." actionLabel="Scan materials" onAction={() => router.push('/(tabs)/scan')} />; }
