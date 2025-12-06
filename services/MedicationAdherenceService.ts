// services/MedicationAdherenceService.ts
import { supabase } from '../src/lib/supabase';

type DailyMetrics = {
  taken: number;
  scheduled: number;
  percentage: number;
};

class MedicationAdherenceService {
  /**
   * ✅ Check for reminders that are more than 5 minutes past their time and mark as missed
   */
  async markOverdueRemindersAsMissed(patientId: string): Promise<number> {
    try {
      const now = new Date();
      
      // Get all pending reminders for this patient
      const { data: pendingReminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'pending');

      if (error) {
        console.error('❌ Error fetching pending reminders:', error);
        return 0;
      }

      if (!pendingReminders || pendingReminders.length === 0) {
        return 0;
      }

      const remindersToMark: string[] = [];

      for (const reminder of pendingReminders) {
        const reminderDateTime = this.parseReminderDateTime(reminder.date, reminder.time);
        const timeDiff = now.getTime() - reminderDateTime.getTime();
        
        // If more than 5 minutes (300,000 ms) past the reminder time
        if (timeDiff > 30000) {
          remindersToMark.push(reminder.id);
          console.log(`⏰ Marking reminder as missed: ${reminder.title} (${reminder.id})`);
        }
      }

      if (remindersToMark.length === 0) {
        return 0;
      }

      // Update all overdue reminders to missed status
      const { error: updateError } = await supabase
        .from('reminders')
        .update({ status: 'missed' })
        .in('id', remindersToMark);

      if (updateError) {
        console.error('❌ Error updating missed reminders:', updateError);
        return 0;
      }

      console.log(`✅ Marked ${remindersToMark.length} reminders as missed`);
      return remindersToMark.length;
    } catch (error) {
      console.error('❌ Error in markOverdueRemindersAsMissed:', error);
      return 0;
    }
  }

  /**
   * Parse reminder date and time into a Date object
   */
  private parseReminderDateTime(dateStr: string, timeStr: string): Date {
    const [timePart, period] = timeStr.includes(' ')
      ? timeStr.split(' ')
      : [timeStr, ''];

    const [hoursStr, minutesStr] = timePart.split(':');
    let hour = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;

    const reminderDate = new Date(dateStr);
    reminderDate.setHours(hour, minutes, 0, 0);

    return reminderDate;
  }

  /**
   * ✅ Calculate medication adherence for a specific day
   */
  async calculateDailyAdherence(patientId: string, date: Date): Promise<DailyMetrics> {
    try {
      // Format date as YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];

      // Get all medication reminders for this day
      const { data: reminders, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .eq('date', dateStr)
        .ilike('type', '%medication%'); // Case-insensitive match for 'medication'

      if (error) {
        console.error('❌ Error fetching reminders:', error);
        return { taken: 0, scheduled: 0, percentage: 0 };
      }

      if (!reminders || reminders.length === 0) {
        return { taken: 0, scheduled: 0, percentage: 0 };
      }

      const scheduled = reminders.length;
      const taken = reminders.filter(r => r.status === 'completed').length;
      const percentage = scheduled > 0 ? Math.round((taken / scheduled) * 100) : 0;

      console.log(`📊 Daily adherence for ${dateStr}: ${taken}/${scheduled} (${percentage}%)`);

      return { taken, scheduled, percentage };
    } catch (error) {
      console.error('❌ Error calculating daily adherence:', error);
      return { taken: 0, scheduled: 0, percentage: 0 };
    }
  }

  /**
   * ✅ Get medication adherence for the last 7 days (Mon-Sun aligned)
   */
  async getWeeklyAdherence(patientId: string): Promise<number[]> {
    try {
      const adherenceData: number[] = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      
      // Get today at midnight local time
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today for comparison
      
      // Get current day of week (0=Sun, 1=Mon, ..., 6=Sat)
      const currentDayOfWeek = today.getDay();
      
      // Calculate days since Monday (start of week)
      const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
      
      // Calculate Monday of current week
      const monday = new Date(today);
      monday.setDate(today.getDate() - daysSinceMonday);
      monday.setHours(0, 0, 0, 0);
      
      const todayStr = today.toISOString().split('T')[0];
      console.log('📅 Today:', todayStr, `(${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][currentDayOfWeek]})`);
      console.log('📅 Current week Monday:', monday.toISOString().split('T')[0]);
      console.log('📅 Today is day index:', daysSinceMonday, '(0=Mon, 6=Sun)');
      
      // Calculate adherence for each day Mon-Sun
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + dayIndex);
        date.setHours(12, 0, 0, 0); // Noon to avoid timezone issues
        
        const dateStr = date.toISOString().split('T')[0];
        const dayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dayIndex];
        
        // Compare date strings instead of Date objects to avoid timezone issues
        const isToday = dateStr === todayStr;
        const isPast = dateStr <= todayStr;
        
        if (isPast) {
          const metrics = await this.calculateDailyAdherence(patientId, date);
          adherenceData[dayIndex] = metrics.percentage;
          console.log(`  ${dayName}: ${metrics.percentage}% (${dateStr})${isToday ? ' ← TODAY' : ''}`);
        } else {
          adherenceData[dayIndex] = 0;
          console.log(`  ${dayName}: 0% (${dateStr}) [future]`);
        }
      }

      console.log('📈 Weekly adherence (Mon-Sun):', adherenceData);
      return adherenceData;
    } catch (error) {
      console.error('❌ Error getting weekly adherence:', error);
      return [0, 0, 0, 0, 0, 0, 0];
    }
  }

  /**
   * ✅ Store daily adherence metrics in med_adherence table
   */
  async storeDailyMetrics(patientId: string, date: Date): Promise<boolean> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      const metrics = await this.calculateDailyAdherence(patientId, date);

      // Check if entry already exists
      const { data: existing } = await supabase
        .from('med_adherence')
        .select('id')
        .eq('patient_id', patientId)
        .eq('date', dateStr)
        .single();

      const metricsData = {
        taken: metrics.taken,
        scheduled: metrics.scheduled,
        percentage: metrics.percentage,
      };

      if (existing) {
        // Update existing entry
        const { error } = await supabase
          .from('med_adherence')
          .update({ metrics: metricsData })
          .eq('id', existing.id);

        if (error) {
          console.error('❌ Error updating metrics:', error);
          return false;
        }
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('med_adherence')
          .insert({
            patient_id: patientId,
            date: dateStr,
            metrics: metricsData,
          });

        if (error) {
          console.error('❌ Error inserting metrics:', error);
          return false;
        }
      }

      console.log(`✅ Stored metrics for ${dateStr}`);
      return true;
    } catch (error) {
      console.error('❌ Error storing daily metrics:', error);
      return false;
    }
  }

  /**
   * ✅ Store weekly adherence summary
   */
  async storeWeeklyMetrics(patientId: string): Promise<boolean> {
    try {
      const today = new Date();
      
      // Calculate start of week (Monday)
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // Calculate weekly totals
      let totalTaken = 0;
      let totalScheduled = 0;

      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        
        const metrics = await this.calculateDailyAdherence(patientId, date);
        totalTaken += metrics.taken;
        totalScheduled += metrics.scheduled;
      }

      // Check if entry exists
      const { data: existing } = await supabase
        .from('med_adherence_weekly')
        .select('id')
        .eq('patient_id', patientId)
        .eq('week_start', weekStartStr)
        .single();

      const weeklyData = {
        patient_id: patientId,
        week_start: weekStartStr,
        taken: totalTaken,
        scheduled: totalScheduled,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error } = await supabase
          .from('med_adherence_weekly')
          .update(weeklyData)
          .eq('id', existing.id);

        if (error) {
          console.error('❌ Error updating weekly metrics:', error);
          return false;
        }
      } else {
        const { error } = await supabase
          .from('med_adherence_weekly')
          .insert(weeklyData);

        if (error) {
          console.error('❌ Error inserting weekly metrics:', error);
          return false;
        }
      }

      console.log(`✅ Stored weekly metrics: ${totalTaken}/${totalScheduled}`);
      return true;
    } catch (error) {
      console.error('❌ Error storing weekly metrics:', error);
      return false;
    }
  }

  /**
   * ✅ Run daily maintenance tasks
   * - Mark overdue reminders as missed
   * - Store daily adherence metrics
   * - Update weekly metrics
   */
  async runDailyMaintenance(patientId: string): Promise<void> {
    console.log('🔧 Running daily maintenance for patient:', patientId);
    
    try {
      // 1. Mark overdue reminders as missed
      await this.markOverdueRemindersAsMissed(patientId);

      // 2. Store today's metrics
      await this.storeDailyMetrics(patientId, new Date());

      // 3. Update weekly metrics
      await this.storeWeeklyMetrics(patientId);

      console.log('✅ Daily maintenance completed');
    } catch (error) {
      console.error('❌ Error in daily maintenance:', error);
    }
  }

  /**
 * ✅ Get overall weekly adherence percentage (FIXED)
 */
async getWeeklyAdherencePercentage(patientId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    // Calculate start of week (Monday)
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];

    console.log('📊 Calculating weekly adherence percentage...');
    console.log('  Week starts:', weekStart.toISOString().split('T')[0]);
    console.log('  Today:', todayStr);

    // Calculate from daily data for all days up to today
    let totalTaken = 0;
    let totalScheduled = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      date.setHours(12, 0, 0, 0);
      
      const dateStr = date.toISOString().split('T')[0];
      
      // Only count days up to and including today
      if (dateStr <= todayStr) {
        const metrics = await this.calculateDailyAdherence(patientId, date);
        
        console.log(`  ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]} (${dateStr}): ${metrics.taken}/${metrics.scheduled}`);
        
        totalTaken += metrics.taken;
        totalScheduled += metrics.scheduled;
      } else {
        console.log(`  ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]} (${dateStr}): [future - skipped]`);
      }
    }

    if (totalScheduled === 0) {
      console.log('📊 Weekly adherence: No medications scheduled this week (so far)');
      return 0;
    }

    const percentage = Math.round((totalTaken / totalScheduled) * 100);
    console.log(`📊 Weekly adherence: ${totalTaken}/${totalScheduled} = ${percentage}%`);
    
    // Also update the weekly table for record-keeping
    this.updateWeeklyTable(patientId, weekStart, totalTaken, totalScheduled);
    
    return percentage;
  } catch (error) {
    console.error('❌ Error getting weekly adherence percentage:', error);
    return 0;
  }
}

/**
 * ✅ Helper method to update weekly table asynchronously
 */
private async updateWeeklyTable(
  patientId: string, 
  weekStart: Date, 
  taken: number, 
  scheduled: number
): Promise<void> {
  try {
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const { data: existing } = await supabase
      .from('med_adherence_weekly')
      .select('id')
      .eq('patient_id', patientId)
      .eq('week_start', weekStartStr)
      .single();

    const weeklyData = {
      patient_id: patientId,
      week_start: weekStartStr,
      taken: taken,
      scheduled: scheduled,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from('med_adherence_weekly')
        .update(weeklyData)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('med_adherence_weekly')
        .insert(weeklyData);
    }
  } catch (error) {
    console.error('❌ Error updating weekly table:', error);
  }
}  
}

export default new MedicationAdherenceService();