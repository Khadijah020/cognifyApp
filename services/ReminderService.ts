// ReminderService.ts - Uses caregiver_id and patient_id
import * as Notifications from 'expo-notifications';
import { supabase } from '../src/lib/supabase';

export type Reminder = {
  id?: string;
  caregiver_id: string;
  patient_id?: string;
  title: string;
  type: string;
  date: string;
  time: string;
  status?: 'pending' | 'completed' | 'missed';
  medication?: string;
  instructions?: string;
  caregiver_note?: string;
  created_at?: string;
  notificationId?: string;
};

class ReminderService {
  // ✅ Get current caregiver ID from auth session
  async getCurrentCaregiversId(): Promise<string | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('❌ Auth error:', error.message);
        return null;
      }
      
      if (!user) {
        console.error('❌ No authenticated user found');
        return null;
      }

      console.log('✅ Using auth user ID as caregiver_id:', user.id);
      return user.id;
      
    } catch (error: any) {
      console.error('❌ Error getting current caregiver ID:', error.message);
      return null;
    }
  }

  // ✅ Get patient ID for the current caregiver
  async getPatientIdForCaregiver(caregiverId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id')
        .eq('caregiver_id', caregiverId)
        .limit(1)
        .single();

      if (error) {
        console.error('❌ Error fetching patient for caregiver:', error.message);
        return null;
      }

      if (!data) {
        console.warn('⚠️ No patient found for caregiver:', caregiverId);
        return null;
      }

      console.log('✅ Found patient ID:', data.id, 'for caregiver:', caregiverId);
      return data.id;
    } catch (error: any) {
      console.error('❌ Error in getPatientIdForCaregiver:', error.message);
      return null;
    }
  }

  // ✅ Request notification permission
  async requestPermissions() {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  }

  // ✅ Schedule notification
  async scheduleNotification(reminder: Reminder) {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('⚠️ Notification permission not granted');
      return null;
    }

    try {
      const [timePart, period] = reminder.time.includes(' ')
        ? reminder.time.split(' ')
        : [reminder.time, ''];

      const [hoursStr, minutesStr] = timePart.split(':');
      let hour = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;

      // Parse date as LOCAL time, not UTC
      let year: number, month: number, day: number;
      const dateStr = reminder.date;
      
      if (dateStr.includes('T')) {
        const datePart = dateStr.split('T')[0];
        [year, month, day] = datePart.split('-').map(Number);
      } else {
        [year, month, day] = dateStr.split('-').map(Number);
      }
      
      // Create date with LOCAL timezone (month is 0-indexed)
      const reminderDate = new Date(year, month - 1, day, hour, minutes, 0, 0);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Reminder',
          body: reminder.title || 'You have a reminder!',
        },
        trigger: { date: reminderDate },
      });

      console.log('✅ Notification scheduled:', notificationId);
      return notificationId;
    } catch (error: any) {
      console.error('❌ Failed to schedule notification:', error.message);
      return null;
    }
  }

  // ✅ Save reminder in Supabase (uses caregiver_id and patient_id)
  async saveReminder(reminderData: Omit<Reminder, 'caregiver_id' | 'patient_id'>) {
    try {
      console.log('🚀 Starting save reminder process...');
      
      // Get caregiver ID from auth
      const caregiverId = await this.getCurrentCaregiversId();
      
      if (!caregiverId) {
        throw new Error('Unable to create reminder: Please ensure you are logged in as a caregiver.');
      }

      // Get patient ID for this caregiver
      const patientId = await this.getPatientIdForCaregiver(caregiverId);

      if (!patientId) {
        throw new Error('No patient found for this caregiver. Please add a patient first.');
      }

      const reminder: Reminder = {
        ...reminderData,
        caregiver_id: caregiverId,
        patient_id: patientId,
      };

      console.log('📋 Creating reminder for:');
      console.log('  Caregiver ID:', caregiverId);
      console.log('  Patient ID:', patientId);

      // Schedule notification
      const notificationId = await this.scheduleNotification(reminder);

      // Prepare data for Supabase
      const dbData = {
        caregiver_id: reminder.caregiver_id,
        patient_id: reminder.patient_id,
        title: reminder.title,
        type: reminder.type,
        date: reminder.date,
        time: reminder.time,
        status: reminder.status ?? 'pending',
        medication: reminder.medication ?? null,
        instructions: reminder.instructions ?? null,
        caregiver_note: reminder.caregiver_note ?? null,
        created_at: new Date().toISOString(),
      };

      console.log('📍 Inserting reminder into database...');

      const { data, error } = await supabase
        .from('reminders')
        .insert([dbData])
        .select()
        .single();

      if (error) {
        console.error('❌ Database error:', error.message);
        throw error;
      }

      console.log('✅ Reminder saved successfully!');
      return { ...data, notificationId };
    } catch (error: any) {
      console.error('❌ Failed to save reminder:', error.message);
      throw error;
    }
  }

  // ✅ Update existing reminder
  async updateReminder(reminderId: string, reminderData: Partial<Omit<Reminder, 'id' | 'caregiver_id' | 'patient_id'>>) {
    try {
      console.log('🔄 Updating reminder:', reminderId);

      const updateData: any = {};
      
      if (reminderData.title !== undefined) updateData.title = reminderData.title;
      if (reminderData.type !== undefined) updateData.type = reminderData.type;
      if (reminderData.date !== undefined) updateData.date = reminderData.date;
      if (reminderData.time !== undefined) updateData.time = reminderData.time;
      if (reminderData.status !== undefined) updateData.status = reminderData.status;
      if (reminderData.medication !== undefined) updateData.medication = reminderData.medication;
      if (reminderData.instructions !== undefined) updateData.instructions = reminderData.instructions;
      if (reminderData.caregiver_note !== undefined) updateData.caregiver_note = reminderData.caregiver_note;

      const { data, error } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', reminderId)
        .select()
        .single();

      if (error) {
        console.error('❌ Database error updating reminder:', error.message);
        throw error;
      }

      console.log('✅ Reminder updated successfully!');
      return data;
    } catch (error: any) {
      console.error('❌ Failed to update reminder:', error.message);
      throw error;
    }
  }

  // ✅ Fetch reminders for current caregiver
  async getReminders() {
    try {
      const caregiverId = await this.getCurrentCaregiversId();
      
      if (!caregiverId) {
        console.warn('⚠️ No caregiver ID found');
        return [];
      }

      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('caregiver_id', caregiverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('✅ Fetched', data?.length || 0, 'reminders for caregiver:', caregiverId);
      return data;
    } catch (error: any) {
      console.error('❌ Failed to fetch reminders:', error.message);
      return [];
    }
  }

  // ✅ Update reminder status
  async updateReminderStatus(reminderId: string, status: 'pending' | 'completed' | 'missed') {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .update({ status })
        .eq('id', reminderId)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Reminder status updated');
      return data;
    } catch (error: any) {
      console.error('❌ Failed to update reminder status:', error.message);
      throw error;
    }
  }

  // ✅ Delete reminder
  async deleteReminder(reminderId: string) {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
      
      console.log('✅ Reminder deleted');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to delete reminder:', error.message);
      throw error;
    }
  }
}

export default new ReminderService();