import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export function isNative() {
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android';
}

export async function ensureLocalNotificationsReady() {
  if (!isNative()) return { ok: false, reason: 'web' };
  try {
    const check = await LocalNotifications.checkPermissions();
    if (check.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return { ok:false, reason:'denied' };
    }
    try {
      await LocalNotifications.createChannel({
        id: 'fitness',
        name: 'Fitness podsjetnici',
        importance: 5,
        visibility: 1,
        lights: true,
        vibration: true,
      });
    } catch {}
    return { ok:true };
  } catch (e) { return { ok:false, reason:String(e) }; }
}

export function strHash(s) {
  let h = 0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return Math.abs(h);
}

export async function scheduleInMinutes({ id, title, body, minutes=1 }) {
  if (!isNative()) return;
  const at = new Date(Date.now() + minutes*60*1000);
  await LocalNotifications.schedule({ notifications:[{ id, title, body, channelId:'fitness', schedule:{ at, allowWhileIdle:true } }] });
}

export async function scheduleDailyReminder({ id, title, body, hour, minute }) {
  if (!isNative()) return;
  await LocalNotifications.schedule({
    notifications:[{
      id, title, body, channelId:'fitness',
      schedule:{ repeats:true, every:'day', on:{ hour, minute }, allowWhileIdle:true }
    }]
  });
}

export async function cancelNotification(id){
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications:[{ id }] });
}
