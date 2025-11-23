// services/PatientActivityService.ts

import { supabase } from '../src/lib/supabase';

export type ActivityType = 
  | 'medication_taken'
  | 'medication_missed'
  | 'fall_detected'
  | 'face_recognized'
  | 'voice_query';

export type PatientActivity = {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  timestamp: Date;
  icon: string;
  iconColor: string;
  iconBg: string;
};

class PatientActivityService {
  /**
   * Get recent activities for a patient
   */
  static async getRecentActivities(
    patientId: string,
    limit: number = 10
  ): Promise<PatientActivity[]> {
    const activities: PatientActivity[] = [];

    try {
      // 1. Get medication activities (completed/missed in last 24 hours)
      const medActivities = await this.getMedicationActivities(patientId);
      activities.push(...medActivities);

      // 2. Get fall alerts (last 24 hours)
      const fallActivities = await this.getFallActivities(patientId);
      activities.push(...fallActivities);

      // Sort by timestamp (most recent first)
      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Return limited results
      return activities.slice(0, limit);
    } catch (error) {
      console.error('❌ Error loading patient activities:', error);
      return [];
    }
  }

  /**
   * Get medication activities (completed/missed)
   */
  private static async getMedicationActivities(
    patientId: string
  ): Promise<PatientActivity[]> {
    try {
      // Get reminders from last 24 hours that are completed or missed
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .in('status', ['completed', 'missed'])
        .gte('date', yesterdayStr)
        .order('date', { ascending: false })
        .order('time', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching reminders:', error);
        return [];
      }

      if (!reminders || reminders.length === 0) return [];

      return reminders
        .filter(r => {
          // Only include reminders from last 24 hours
          const reminderTime = this.parseReminderDateTime(r.date, r.time);
          const now = new Date();
          const hoursDiff = (now.getTime() - reminderTime.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= 24 && hoursDiff >= 0;
        })
        .map(r => {
          const isTaken = r.status === 'completed';
          const reminderTime = this.parseReminderDateTime(r.date, r.time);
          const medicationName = r.medication || r.title || 'Medication';

          return {
            id: `med-${r.id}`,
            type: isTaken ? 'medication_taken' : 'medication_missed',
            title: isTaken ? `${medicationName} taken` : `${medicationName} missed`,
            subtitle: this.formatRelativeTime(reminderTime),
            timestamp: reminderTime,
            icon: isTaken ? 'check-circle' : 'cancel',
            iconColor: isTaken ? '#22c55e' : '#ef4444',
            iconBg: isTaken ? '#dcfce7' : '#fee2e2',
          };
        });
    } catch (error) {
      console.error('❌ Error in getMedicationActivities:', error);
      return [];
    }
  }

  /**
   * Get fall detection activities
   */
  private static async getFallActivities(
    patientId: string
  ): Promise<PatientActivity[]> {
    try {
      // Get falls from last 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { data: falls, error } = await supabase
        .from('fall_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching falls:', error);
        return [];
      }

      if (!falls || falls.length === 0) return [];

      return falls.map(f => ({
        id: `fall-${f.id}`,
        type: 'fall_detected',
        title: 'Fall detected',
        subtitle: this.formatRelativeTime(new Date(f.created_at)),
        timestamp: new Date(f.created_at),
        icon: 'personal-injury',
        iconColor: '#ef4444',
        iconBg: '#fee2e2',
      }));
    } catch (error) {
      console.error('❌ Error in getFallActivities:', error);
      return [];
    }
  }

  /**
   * Parse reminder date and time into Date object
   */
  private static parseReminderDateTime(dateStr: string, timeStr: string): Date {
    try {
      const [timePart, period] = timeStr.includes(' ')
        ? timeStr.split(' ')
        : [timeStr, ''];

      const [hoursStr, minutesStr] = timePart.split(':');
      let hour = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10) || 0;

      // Convert to 24-hour format
      if (period) {
        if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      const date = new Date(dateStr);
      date.setHours(hour, minutes, 0, 0);

      return date;
    } catch (error) {
      console.error('Error parsing date/time:', error);
      return new Date();
    }
  }

  /**
   * Format relative time (e.g., "5 mins ago", "2 hours ago")
   */
  private static formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
  }
}

export default PatientActivityService;