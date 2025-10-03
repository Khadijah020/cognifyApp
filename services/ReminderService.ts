import * as Notifications from 'expo-notifications';

export type Reminder = {
  id: string;
  title: string;
  date: string;
  time: string;
  createdAt: string;
  status: 'pending' | 'completed' | 'missed';
  notificationId?: string;
};

class ReminderService {
  async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    return finalStatus === 'granted';
  }

  async scheduleNotification(reminder: Reminder) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return null;

    const [hours, minutes] = reminder.time.split(':')[0].split(' ')[0].split(':');
    const period = reminder.time.split(' ')[1];
    
    let hour = parseInt(hours);
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    const reminderDate = new Date(reminder.date);
    reminderDate.setHours(hour, parseInt(minutes), 0);

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder',
          body: reminder.title,
        },
        trigger: {
          type: 'date',
          date: reminderDate,
        },
      });
      
      return notificationId;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      return null;
    }
  }

  async saveReminder(reminder: Reminder) {
    try {
      // Here you would typically save to AsyncStorage or your backend
      // For now, just return true to simulate success
      return true;
    } catch (error) {
      console.error('Failed to save reminder:', error);
      return false;
    }
  }
}

export default new ReminderService();
