import { LocalNotifications } from '@capacitor/local-notifications';
import type { ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface DCANotification {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
}

class NotificationService {
  private isAvailable = false;

  async initialize() {
    // Check if we're on a native platform
    if (!Capacitor.isNativePlatform()) {
      console.log('Notifications only available on native platforms');
      return false;
    }

    try {
      // Request permission
      const permission = await LocalNotifications.requestPermissions();
      this.isAvailable = permission.display === 'granted';
      
      if (this.isAvailable) {
        console.log('Notification permissions granted');
      } else {
        console.log('Notification permissions denied');
      }
      
      return this.isAvailable;
    } catch (error) {
      console.error('Error initializing notifications:', error);
      return false;
    }
  }

  async scheduleDCAReminder(
    dcaDate: Date,
    amount: number,
    frequency: string
  ): Promise<number | null> {
    if (!this.isAvailable) {
      console.log('Notifications not available');
      return null;
    }

    try {
      const id = Math.floor(Math.random() * 1000000);
      
      // Schedule notification for the DCA date
      const schedule: ScheduleOptions = {
        notifications: [
          {
            id,
            title: '💰 DCA Reminder',
            body: `Time to buy $${amount} of SOL (${frequency})`,
            schedule: {
              at: dcaDate,
            },
            sound: 'default',
            actionTypeId: 'DCA_ACTION',
            extra: {
              type: 'dca',
              amount,
              frequency,
              scheduledFor: dcaDate.toISOString(),
            },
          },
        ],
      };

      await LocalNotifications.schedule(schedule);
      console.log(`Scheduled DCA notification ${id} for ${dcaDate}`);
      return id;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  async scheduleMissedDCAReminder(
    amount: number,
    daysMissed: number
  ): Promise<number | null> {
    if (!this.isAvailable) return null;

    try {
      const id = Math.floor(Math.random() * 1000000);
      
      // Immediate notification for missed DCA
      const schedule: ScheduleOptions = {
        notifications: [
          {
            id,
            title: '⚠️ Missed DCA',
            body: `You missed your $${amount} SOL purchase ${daysMissed} day${daysMissed > 1 ? 's' : ''} ago`,
            schedule: {
              at: new Date(Date.now() + 1000), // 1 second from now
            },
            sound: 'default',
            actionTypeId: 'MISSED_DCA_ACTION',
            extra: {
              type: 'missed-dca',
              amount,
              daysMissed,
            },
          },
        ],
      };

      await LocalNotifications.schedule(schedule);
      console.log(`Scheduled missed DCA notification ${id}`);
      return id;
    } catch (error) {
      console.error('Error scheduling missed DCA notification:', error);
      return null;
    }
  }

  async cancelNotification(id: number) {
    if (!this.isAvailable) return;

    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log(`Cancelled notification ${id}`);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }

  async cancelAllNotifications() {
    if (!this.isAvailable) return;

    try {
      await LocalNotifications.cancel({ notifications: [] }); // Empty array cancels all
      console.log('Cancelled all notifications');
    } catch (error) {
      console.error('Error cancelling all notifications:', error);
    }
  }

  async getPendingNotifications() {
    if (!this.isAvailable) return [];

    try {
      const pending = await LocalNotifications.getPending();
      return pending.notifications;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  // Test notification - useful for debugging
  async sendTestNotification() {
    if (!this.isAvailable) {
      console.log('Notifications not available - requesting permission...');
      await this.initialize();
      if (!this.isAvailable) return;
    }

    try {
      const schedule: ScheduleOptions = {
        notifications: [
          {
            id: 999999,
            title: '🧪 Test Notification',
            body: 'RetireOnSol notifications are working!',
            schedule: {
              at: new Date(Date.now() + 2000), // 2 seconds from now
            },
            sound: 'default',
          },
        ],
      };

      await LocalNotifications.schedule(schedule);
      console.log('Test notification scheduled');
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
