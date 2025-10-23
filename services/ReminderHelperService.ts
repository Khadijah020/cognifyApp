// services/ReminderHelperService.ts
// Helper functions for working with reminders

export type SupabaseReminder = {
  id: string;
  caregiver_id: string;
  patient_id?: string;
  title: string;
  type: string;
  date: string;
  time: string;
  status: 'pending' | 'completed' | 'missed';
  medication?: string;
  instructions?: string;
  caregiver_note?: string;
  created_at: string;
};

export type ReminderData = {
  id?: string;
  title: string;
  subtitle: string;
  icon: 'medication' | 'event';
  chipColor: string;
  chipBg: string;
  details?: {
    medication?: string;
    instructions?: string;
    note?: string;
  };
  status?: {
    time?: string;
    label?: string;
  };
  prefill?: {
    title: string;
    date: Date;
    timeText: string;
  };
};

class ReminderHelperService {
  /**
   * Parse date and time string into a Date object
   */
  parseReminderDateTime(dateStr: string, timeStr: string): Date {
    try {
      // Parse the date (expecting ISO format like "2025-01-15" or "2025-01-15T00:00:00")
      const date = new Date(dateStr);
      
      // Parse time - handle multiple formats
      const timeUpper = timeStr.toUpperCase().trim();
      let hours = 0;
      let minutes = 0;
      
      // Remove seconds if present (e.g., "21:00:00" → "21:00")
      const cleanTime = timeStr.split(':').slice(0, 2).join(':');
      
      // Check if time includes AM/PM
      if (timeUpper.includes('AM') || timeUpper.includes('PM')) {
        const [timePart, period] = timeUpper.split(/\s+/);
        const [hoursStr, minutesStr] = timePart.split(':');
        hours = parseInt(hoursStr, 10);
        minutes = parseInt(minutesStr || '0', 10);
        
        // Convert to 24-hour format
        if (period === 'PM' && hours !== 12) {
          hours += 12;
        } else if (period === 'AM' && hours === 12) {
          hours = 0;
        }
      } else {
        // 24-hour format (e.g., "14:30" or "21:00:00")
        const parts = cleanTime.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1] || '0', 10);
      }
      
      // Set the time on the date
      date.setHours(hours, minutes, 0, 0);
      
      console.log('📅 Parsed:', dateStr, timeStr, '→', date.toLocaleString(), '(', date.toISOString(), ')');
      return date;
    } catch (error) {
      console.error('❌ Error parsing date/time:', dateStr, timeStr, error);
      return new Date(); // Return current date as fallback
    }
  }

  /**
   * Filter reminders that are within the next N hours
   */
  filterUpcomingReminders(
    reminders: SupabaseReminder[], 
    hoursAhead: number = 24
  ): SupabaseReminder[] {
    const now = new Date();
    const futureTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    
    console.log('🕐 Current time:', now.toLocaleString());
    console.log(`⏰ Looking for reminders until: ${futureTime.toLocaleString()} (${hoursAhead}h ahead)`);
    console.log('📊 Total reminders to filter:', reminders.length);
    
    const filtered = reminders
      .filter((r) => {
        // Only include pending reminders
        if (r.status !== 'pending') {
          return false;
        }
        
        const reminderDateTime = this.parseReminderDateTime(r.date, r.time);
        const isAfterNow = reminderDateTime >= now;
        const isBeforeFuture = reminderDateTime <= futureTime;
        
        // Calculate hours until reminder
        const hoursUntil = (reminderDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (isAfterNow && isBeforeFuture) {
          console.log(`✅ Including: "${r.title}" - ${hoursUntil.toFixed(1)}h away (${reminderDateTime.toLocaleString()})`);
        }
        
        return isAfterNow && isBeforeFuture;
      })
      .sort((a, b) => {
        const dateA = this.parseReminderDateTime(a.date, a.time);
        const dateB = this.parseReminderDateTime(b.date, b.time);
        return dateA.getTime() - dateB.getTime();
      });
    
    console.log(`\n✅ Filtered result: ${filtered.length} reminders within ${hoursAhead} hours`);
    return filtered;
  }

  /**
   * Convert Supabase reminder to display format
   */
  convertToReminderData(r: SupabaseReminder): ReminderData {
    const reminderDate = this.parseReminderDateTime(r.date, r.time);
    
    // Format subtitle (e.g., "Today, 9:00 AM" or "Tomorrow, 2:30 PM")
    const dayLabel = this.getRelativeDayLabel(reminderDate);
    const subtitle = `${dayLabel}, ${r.time}`;
    
    // Determine icon and colors based on type
    const isMedication = this.isMedicationType(r.type);
    const icon = isMedication ? 'medication' : 'event';
    const chipColor = isMedication ? '#14b8a6' : '#3b82f6';
    const chipBg = isMedication ? '#ccfbf1' : '#dbeafe';
    
    return {
      id: r.id,
      title: r.title,
      subtitle,
      icon,
      chipColor,
      chipBg,
      details: {
        medication: r.medication || undefined,
        instructions: r.instructions || undefined,
        note: r.caregiver_note || undefined,
      },
      status: {
        time: r.status === 'completed' ? 'Completed' : 'Not yet',
        label: r.status === 'completed' ? 'Confirmed' : 'Scheduled',
      },
      prefill: {
        title: r.title,
        date: reminderDate,
        timeText: r.time,
      },
    };
  }

  /**
   * Get relative day label (Today, Tomorrow, or date)
   */
  private getRelativeDayLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffDays = Math.floor((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    
    // Return formatted date (e.g., "Jan 20")
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }

  /**
   * Check if reminder type is medication-related
   */
  private isMedicationType(type: string): boolean {
    const medKeywords = ['medication', 'medicine', 'pill', 'drug', 'prescription'];
    const typeLower = type.toLowerCase();
    return medKeywords.some(keyword => typeLower.includes(keyword));
  }

  /**
   * Get reminders expiring soon (for notifications)
   */
  getExpiringReminders(
    reminders: SupabaseReminder[], 
    minutesAhead: number = 15
  ): SupabaseReminder[] {
    const now = new Date();
    const futureTime = new Date(now.getTime() + minutesAhead * 60 * 1000);
    
    return reminders.filter((r) => {
      if (r.status !== 'pending') return false;
      
      const reminderDateTime = this.parseReminderDateTime(r.date, r.time);
      return reminderDateTime >= now && reminderDateTime <= futureTime;
    });
  }

  /**
   * Check if a reminder is overdue
   */
  isOverdue(reminder: SupabaseReminder): boolean {
    const now = new Date();
    const reminderDateTime = this.parseReminderDateTime(reminder.date, reminder.time);
    return reminderDateTime < now && reminder.status === 'pending';
  }
}

export default new ReminderHelperService();