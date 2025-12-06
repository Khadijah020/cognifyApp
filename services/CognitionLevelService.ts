// services/CognitionLevelService.ts

import { supabase } from '../src/lib/supabase';

export type CognitionLevel = 'Severe' | 'Moderate' | 'Mild' | 'Good' | 'Excellent';

export type CognitionScore = {
  level: CognitionLevel;
  score: number; // 0-100
  position: number; // 0-4 (index position on the scale bar)
  factors: {
    medicationAdherence: number;
    fallFrequency: number;
    reminderResponse: number;
    overallHealth: number;
  };
  details: {
    totalReminders: number;
    completedReminders: number;
    missedReminders: number;
    fallCount: number;
    daysAnalyzed: number;
  };
};

class CognitionLevelService {
  /**
   * Calculate cognition level for a patient based on multiple factors
   */
  static async calculateCognitionLevel(patientId: string): Promise<CognitionScore> {
    try {
      console.log('🧠 Calculating cognition level for patient:', patientId);

      // Get data from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

      // 1. Get medication adherence data (last 30 days)
      const { data: reminders, error: remindersError } = await supabase
        .from('reminders')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', thirtyDaysAgoStr)
        .in('status', ['completed', 'missed']);

      if (remindersError) {
        console.error('Error fetching reminders:', remindersError);
      }

      const totalReminders = reminders?.length || 0;
      const completedReminders = reminders?.filter(r => r.status === 'completed').length || 0;
      const missedReminders = reminders?.filter(r => r.status === 'missed').length || 0;

      // 2. Get fall detection data (last 30 days)
      const { data: falls, error: fallsError } = await supabase
        .from('fall_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .gte('created_at', thirtyDaysAgoStr);

      if (fallsError) {
        console.error('Error fetching falls:', fallsError);
      }

      const fallCount = falls?.length || 0;

      // Calculate individual factor scores (0-100)
      const medicationScore = this.calculateMedicationScore(totalReminders, completedReminders, missedReminders);
      const fallScore = this.calculateFallScore(fallCount);
      const reminderResponseScore = this.calculateReminderResponseScore(totalReminders, completedReminders);
      
      // Calculate overall health score (weighted average)
      const overallScore = this.calculateOverallScore({
        medication: medicationScore,
        falls: fallScore,
        reminderResponse: reminderResponseScore,
      });

      // Determine cognition level and position
      const { level, position } = this.determineCognitionLevel(overallScore);

      const result: CognitionScore = {
        level,
        score: Math.round(overallScore),
        position,
        factors: {
          medicationAdherence: Math.round(medicationScore),
          fallFrequency: Math.round(fallScore),
          reminderResponse: Math.round(reminderResponseScore),
          overallHealth: Math.round(overallScore),
        },
        details: {
          totalReminders,
          completedReminders,
          missedReminders,
          fallCount,
          daysAnalyzed: 30,
        },
      };

      console.log('✅ Cognition level calculated:', result);
      return result;

    } catch (error) {
      console.error('❌ Error calculating cognition level:', error);
      
      // Return default "Good" level on error
      return {
        level: 'Good',
        score: 70,
        position: 3,
        factors: {
          medicationAdherence: 70,
          fallFrequency: 70,
          reminderResponse: 70,
          overallHealth: 70,
        },
        details: {
          totalReminders: 0,
          completedReminders: 0,
          missedReminders: 0,
          fallCount: 0,
          daysAnalyzed: 30,
        },
      };
    }
  }

  /**
   * Calculate medication adherence score (0-100)
   * Higher completion rate = better score
   */
  private static calculateMedicationScore(
    total: number,
    completed: number,
    missed: number
  ): number {
    if (total === 0) {
      // No reminders set up yet - assume neutral/good
      return 75;
    }

    const completionRate = (completed / total) * 100;
    
    // Score based on completion rate
    // 90-100% completion = 90-100 score
    // 70-89% completion = 70-89 score
    // 50-69% completion = 50-69 score
    // 0-49% completion = 0-49 score
    
    return completionRate;
  }

  /**
   * Calculate fall frequency score (0-100)
   * Fewer falls = better score
   */
  private static calculateFallScore(fallCount: number): number {
    // Fall frequency scoring:
    // 0 falls = 100 (excellent)
    // 1 fall = 85 (good)
    // 2 falls = 70 (mild concern)
    // 3 falls = 55 (moderate concern)
    // 4 falls = 40 (moderate concern)
    // 5+ falls = 25 or less (severe concern)

    if (fallCount === 0) return 100;
    if (fallCount === 1) return 85;
    if (fallCount === 2) return 70;
    if (fallCount === 3) return 55;
    if (fallCount === 4) return 40;
    
    // 5 or more falls - significant concern
    return Math.max(10, 30 - (fallCount * 3));
  }

  /**
   * Calculate reminder response score (0-100)
   * Quick response to reminders = better score
   */
  private static calculateReminderResponseScore(
    total: number,
    completed: number
  ): number {
    if (total === 0) {
      // No data yet
      return 75;
    }

    // Similar to medication score but focuses on responsiveness
    const responseRate = (completed / total) * 100;
    
    return responseRate;
  }

  /**
   * Calculate overall weighted score
   * Weights: Medication (40%), Falls (35%), Reminder Response (25%)
   */
  private static calculateOverallScore(scores: {
    medication: number;
    falls: number;
    reminderResponse: number;
  }): number {
    const weights = {
      medication: 0.40,      // 40% weight - most important
      falls: 0.35,           // 35% weight - very important safety indicator
      reminderResponse: 0.25, // 25% weight - cognitive engagement
    };

    const weightedScore = 
      scores.medication * weights.medication +
      scores.falls * weights.falls +
      scores.reminderResponse * weights.reminderResponse;

    return Math.min(100, Math.max(0, weightedScore));
  }

  /**
   * Determine cognition level and position based on overall score
   */
  private static determineCognitionLevel(score: number): {
    level: CognitionLevel;
    position: number;
  } {
    // Score ranges and corresponding positions (0-4)
    // Position 0: Severe (0-20)
    // Position 1: Moderate (21-40)
    // Position 2: Mild (41-60)
    // Position 3: Good (61-80)
    // Position 4: Excellent (81-100)

    if (score >= 81) {
      return { level: 'Excellent', position: 4 };
    } else if (score >= 61) {
      return { level: 'Good', position: 3 };
    } else if (score >= 41) {
      return { level: 'Mild', position: 2 };
    } else if (score >= 21) {
      return { level: 'Moderate', position: 1 };
    } else {
      return { level: 'Severe', position: 0 };
    }
  }

  /**
   * Get color for cognition level badge
   */
  static getCognitionColor(level: CognitionLevel): {
    text: string;
    background: string;
  } {
    switch (level) {
      case 'Excellent':
        return { text: '#059669', background: '#d1fae5' }; // Green
      case 'Good':
        return { text: '#6366F1', background: '#e0e7ff' }; // Indigo
      case 'Mild':
        return { text: '#eab308', background: '#fef9c3' }; // Yellow
      case 'Moderate':
        return { text: '#f97316', background: '#fed7aa' }; // Orange
      case 'Severe':
        return { text: '#dc2626', background: '#fecaca' }; // Red
      default:
        return { text: '#6366F1', background: '#e0e7ff' };
    }
  }

  /**
   * Get descriptive text for cognition level
   */
  static getCognitionDescription(level: CognitionLevel): string {
    switch (level) {
      case 'Excellent':
        return 'Patient is doing exceptionally well with high adherence and no safety concerns.';
      case 'Good':
        return 'Patient is managing well with good medication adherence and minimal issues.';
      case 'Mild':
        return 'Some minor concerns with medication adherence or occasional safety issues.';
      case 'Moderate':
        return 'Notable concerns with medication adherence and/or multiple safety incidents.';
      case 'Severe':
        return 'Serious concerns requiring immediate attention and possible intervention.';
      default:
        return 'Monitoring patient health and cognitive function.';
    }
  }

  /**
   * Get recommendations based on cognition level
   */
  static getRecommendations(cognitionScore: CognitionScore): string[] {
    const recommendations: string[] = [];

    // Medication-related recommendations
    if (cognitionScore.factors.medicationAdherence < 70) {
      recommendations.push('💊 Consider setting more frequent medication reminders');
      recommendations.push('📱 Enable voice alerts for medication times');
    }

    // Fall-related recommendations
    if (cognitionScore.details.fallCount >= 2) {
      recommendations.push('🚨 High fall risk - consider home safety assessment');
      recommendations.push('🏥 Consult with healthcare provider about fall prevention');
    } else if (cognitionScore.details.fallCount >= 1) {
      recommendations.push('⚠️ Recent fall detected - monitor closely for patterns');
    }

    // Reminder response recommendations
    if (cognitionScore.factors.reminderResponse < 60) {
      recommendations.push('🔔 Patient may need additional support with reminders');
      recommendations.push('👥 Consider increasing caregiver check-ins');
    }

    // Overall recommendations
    if (cognitionScore.score >= 80) {
      recommendations.push('✅ Keep up the excellent work!');
    } else if (cognitionScore.score < 40) {
      recommendations.push('🏥 Consider scheduling a healthcare consultation');
      recommendations.push('📞 Increase frequency of caregiver contact');
    }

    return recommendations;
  }
}

export default CognitionLevelService;