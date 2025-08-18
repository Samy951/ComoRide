import { PrismaClient, MatchingStatus, NotificationResponse } from '@prisma/client';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface TimeFrame {
  start: Date;
  end: Date;
}

export interface ZoneMetrics {
  zone: string;
  totalBookings: number;
  successfulMatches: number;
  averageMatchingTime: number;
  timeoutRate: number;
  peakHours: number[];
}

export interface HourMetrics {
  hour: number;
  totalBookings: number;
  successfulMatches: number;
  averageMatchingTime: number;
  averageDriversNotified: number;
  timeoutRate: number;
}

export interface DriverStats {
  driverId: string;
  driverName: string;
  notificationsReceived: number;
  responsesGiven: number;
  acceptanceRate: number;
  averageResponseTime: number;
  timeoutCount: number;
}

export interface DailyReport {
  date: Date;
  totalBookings: number;
  successfulMatches: number;
  timeoutBookings: number;
  cancelledBookings: number;
  averageMatchingTime: number;
  averageDriversNotified: number;
  successRate: number;
  timeoutRate: number;
  activeDrivers: number;
  peakHour: number;
  slowestMatchingTime: number;
  fastestMatchingTime: number;
}

export interface WeeklyReport extends DailyReport {
  weekStart: Date;
  weekEnd: Date;
  dailyBreakdown: DailyReport[];
  trendsAnalysis: {
    bookingsTrend: 'UP' | 'DOWN' | 'STABLE';
    successRateTrend: 'UP' | 'DOWN' | 'STABLE';
    averageTimeTrend: 'UP' | 'DOWN' | 'STABLE';
  };
}

export interface MetricsService {
  getActiveMatchings(): Promise<number>;
  getAverageMatchingTime(timeframe: TimeFrame): Promise<number>;
  getAcceptanceRate(timeframe: TimeFrame): Promise<number>;
  getTimeoutRate(timeframe: TimeFrame): Promise<number>;
  getMetricsByZone(zone: string, timeframe: TimeFrame): Promise<ZoneMetrics>;
  getMetricsByHour(hour: number, timeframe: TimeFrame): Promise<HourMetrics>;
  getDriverResponseStats(driverId: string, timeframe: TimeFrame): Promise<DriverStats>;
  generateDailyReport(date: Date): Promise<DailyReport>;
  generateWeeklyReport(startDate: Date): Promise<WeeklyReport>;
  getTopPerformingDrivers(timeframe: TimeFrame, limit: number): Promise<DriverStats[]>;
  getSystemHealthMetrics(): Promise<any>;
}

export class MetricsServiceImpl implements MetricsService {
  private static instance: MetricsServiceImpl;

  constructor() {
    if (MetricsServiceImpl.instance) {
      return MetricsServiceImpl.instance;
    }
    MetricsServiceImpl.instance = this;
  }

  static getInstance(): MetricsServiceImpl {
    if (!MetricsServiceImpl.instance) {
      MetricsServiceImpl.instance = new MetricsServiceImpl();
    }
    return MetricsServiceImpl.instance;
  }

  async getActiveMatchings(): Promise<number> {
    try {
      const activeMatchings = await prisma.matchingMetrics.count({
        where: {
          finalStatus: MatchingStatus.ACTIVE
        }
      });

      logger.debug('Active matchings retrieved', { count: activeMatchings });
      return activeMatchings;
    } catch (error) {
      logger.error('Failed to get active matchings', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  async getAverageMatchingTime(timeframe: TimeFrame): Promise<number> {
    try {
      const result = await prisma.matchingMetrics.aggregate({
        where: {
          createdAt: {
            gte: timeframe.start,
            lte: timeframe.end
          },
          finalStatus: MatchingStatus.MATCHED,
          timeToMatch: {
            not: null
          }
        },
        _avg: {
          timeToMatch: true
        }
      });

      const averageTime = result._avg.timeToMatch || 0;
      
      logger.debug('Average matching time calculated', {
        timeframe,
        averageTime
      });

      return Math.round(averageTime);
    } catch (error) {
      logger.error('Failed to calculate average matching time', {
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  async getAcceptanceRate(timeframe: TimeFrame): Promise<number> {
    try {
      const [totalNotifications, acceptedNotifications] = await Promise.all([
        prisma.bookingNotification.count({
          where: {
            sentAt: {
              gte: timeframe.start,
              lte: timeframe.end
            },
            response: {
              not: null
            }
          }
        }),
        prisma.bookingNotification.count({
          where: {
            sentAt: {
              gte: timeframe.start,
              lte: timeframe.end
            },
            response: NotificationResponse.ACCEPTED
          }
        })
      ]);

      const acceptanceRate = totalNotifications > 0 
        ? (acceptedNotifications / totalNotifications) * 100 
        : 0;

      logger.debug('Acceptance rate calculated', {
        timeframe,
        totalNotifications,
        acceptedNotifications,
        acceptanceRate
      });

      return Math.round(acceptanceRate * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      logger.error('Failed to calculate acceptance rate', {
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  async getTimeoutRate(timeframe: TimeFrame): Promise<number> {
    try {
      const [totalBookings, timeoutBookings] = await Promise.all([
        prisma.matchingMetrics.count({
          where: {
            createdAt: {
              gte: timeframe.start,
              lte: timeframe.end
            }
          }
        }),
        prisma.matchingMetrics.count({
          where: {
            createdAt: {
              gte: timeframe.start,
              lte: timeframe.end
            },
            finalStatus: MatchingStatus.TIMEOUT
          }
        })
      ]);

      const timeoutRate = totalBookings > 0 
        ? (timeoutBookings / totalBookings) * 100 
        : 0;

      logger.debug('Timeout rate calculated', {
        timeframe,
        totalBookings,
        timeoutBookings,
        timeoutRate
      });

      return Math.round(timeoutRate * 100) / 100;
    } catch (error) {
      logger.error('Failed to calculate timeout rate', {
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return 0;
    }
  }

  async getMetricsByZone(zone: string, timeframe: TimeFrame): Promise<ZoneMetrics> {
    try {
      // Note: Cette implémentation nécessiterait un champ 'zone' dans Booking
      // Pour l'instant, on utilise une approche simplifiée basée sur les adresses
      const bookingsInZone = await prisma.booking.findMany({
        where: {
          pickupAddress: {
            contains: zone,
            mode: 'insensitive'
          },
          createdAt: {
            gte: timeframe.start,
            lte: timeframe.end
          }
        },
        include: {
          metrics: true
        }
      });

      const totalBookings = bookingsInZone.length;
      const successfulMatches = bookingsInZone.filter(b => 
        b.metrics?.finalStatus === MatchingStatus.MATCHED
      ).length;

      const matchingTimes = bookingsInZone
        .map(b => b.metrics?.timeToMatch)
        .filter(time => time !== null && time !== undefined) as number[];

      const averageMatchingTime = matchingTimes.length > 0
        ? matchingTimes.reduce((sum, time) => sum + time, 0) / matchingTimes.length
        : 0;

      const timeoutCount = bookingsInZone.filter(b => 
        b.metrics?.finalStatus === MatchingStatus.TIMEOUT
      ).length;

      const timeoutRate = totalBookings > 0 ? (timeoutCount / totalBookings) * 100 : 0;

      // Calculer les heures de pointe
      const hourCounts = bookingsInZone.reduce((acc, booking) => {
        const hour = booking.createdAt.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const peakHours = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

      const result: ZoneMetrics = {
        zone,
        totalBookings,
        successfulMatches,
        averageMatchingTime: Math.round(averageMatchingTime),
        timeoutRate: Math.round(timeoutRate * 100) / 100,
        peakHours
      };

      logger.debug('Zone metrics calculated', { zone, result });
      return result;

    } catch (error) {
      logger.error('Failed to get metrics by zone', {
        zone,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        zone,
        totalBookings: 0,
        successfulMatches: 0,
        averageMatchingTime: 0,
        timeoutRate: 0,
        peakHours: []
      };
    }
  }

  async getMetricsByHour(hour: number, timeframe: TimeFrame): Promise<HourMetrics> {
    try {
      const bookingsInHour = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: timeframe.start,
            lte: timeframe.end
          }
        },
        include: {
          metrics: true
        }
      });

      // Filtrer par heure
      const hourBookings = bookingsInHour.filter(booking => 
        booking.createdAt.getHours() === hour
      );

      const totalBookings = hourBookings.length;
      const successfulMatches = hourBookings.filter(b => 
        b.metrics?.finalStatus === MatchingStatus.MATCHED
      ).length;

      const matchingTimes = hourBookings
        .map(b => b.metrics?.timeToMatch)
        .filter(time => time !== null && time !== undefined) as number[];

      const averageMatchingTime = matchingTimes.length > 0
        ? matchingTimes.reduce((sum, time) => sum + time, 0) / matchingTimes.length
        : 0;

      const driversNotified = hourBookings
        .map(b => b.metrics?.totalDriversNotified || 0);

      const averageDriversNotified = driversNotified.length > 0
        ? driversNotified.reduce((sum, count) => sum + count, 0) / driversNotified.length
        : 0;

      const timeoutCount = hourBookings.filter(b => 
        b.metrics?.finalStatus === MatchingStatus.TIMEOUT
      ).length;

      const timeoutRate = totalBookings > 0 ? (timeoutCount / totalBookings) * 100 : 0;

      const result: HourMetrics = {
        hour,
        totalBookings,
        successfulMatches,
        averageMatchingTime: Math.round(averageMatchingTime),
        averageDriversNotified: Math.round(averageDriversNotified),
        timeoutRate: Math.round(timeoutRate * 100) / 100
      };

      logger.debug('Hour metrics calculated', { hour, result });
      return result;

    } catch (error) {
      logger.error('Failed to get metrics by hour', {
        hour,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        hour,
        totalBookings: 0,
        successfulMatches: 0,
        averageMatchingTime: 0,
        averageDriversNotified: 0,
        timeoutRate: 0
      };
    }
  }

  async getDriverResponseStats(driverId: string, timeframe: TimeFrame): Promise<DriverStats> {
    try {
      const [driver, notifications] = await Promise.all([
        prisma.driver.findUnique({
          where: { id: driverId },
          select: { name: true }
        }),
        prisma.bookingNotification.findMany({
          where: {
            driverId,
            sentAt: {
              gte: timeframe.start,
              lte: timeframe.end
            }
          }
        })
      ]);

      if (!driver) {
        throw new Error('Driver not found');
      }

      const notificationsReceived = notifications.length;
      const responsesGiven = notifications.filter(n => n.response !== null).length;
      const acceptedCount = notifications.filter(n => n.response === NotificationResponse.ACCEPTED).length;
      const timeoutCount = notifications.filter(n => n.response === NotificationResponse.TIMEOUT).length;

      const acceptanceRate = responsesGiven > 0 
        ? (acceptedCount / responsesGiven) * 100 
        : 0;

      // Calculer temps de réponse moyen
      const responseTimes = notifications
        .filter(n => n.respondedAt && n.response !== NotificationResponse.TIMEOUT)
        .map(n => {
          const sentTime = n.sentAt.getTime();
          const respondedTime = n.respondedAt!.getTime();
          return respondedTime - sentTime;
        });

      const averageResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        : 0;

      const result: DriverStats = {
        driverId,
        driverName: driver.name,
        notificationsReceived,
        responsesGiven,
        acceptanceRate: Math.round(acceptanceRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime / 1000), // Convert to seconds
        timeoutCount
      };

      logger.debug('Driver response stats calculated', { driverId, result });
      return result;

    } catch (error) {
      logger.error('Failed to get driver response stats', {
        driverId,
        timeframe,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        driverId,
        driverName: 'Unknown',
        notificationsReceived: 0,
        responsesGiven: 0,
        acceptanceRate: 0,
        averageResponseTime: 0,
        timeoutCount: 0
      };
    }
  }

  async generateDailyReport(date: Date): Promise<DailyReport> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const timeframe = { start: startOfDay, end: endOfDay };

      const [
        bookings,
        activeDriversCount
      ] = await Promise.all([
        prisma.booking.findMany({
          where: {
            createdAt: {
              gte: timeframe.start,
              lte: timeframe.end
            }
          },
          include: {
            metrics: true
          }
        }),
        prisma.driver.count({
          where: {
            isAvailable: true,
            isOnline: true,
            isVerified: true,
            isActive: true,
            lastSeenAt: {
              gte: startOfDay
            }
          }
        })
      ]);

      const totalBookings = bookings.length;
      const successfulMatches = bookings.filter(b => b.status === 'ACCEPTED').length;
      const timeoutBookings = bookings.filter(b => 
        b.metrics && b.metrics.finalStatus === MatchingStatus.TIMEOUT
      ).length;
      const cancelledBookings = bookings.filter(b => b.status === 'CANCELLED').length;

      const matchingTimes = bookings
        .map(b => b.metrics ? b.metrics.timeToMatch : null)
        .filter(time => time !== null && time !== undefined) as number[];

      const averageMatchingTime = matchingTimes.length > 0
        ? matchingTimes.reduce((sum, time) => sum + time, 0) / matchingTimes.length
        : 0;

      const driversNotified = bookings
        .map(b => b.metrics ? b.metrics.totalDriversNotified : 0);

      const averageDriversNotified = driversNotified.length > 0
        ? driversNotified.reduce((sum, count) => sum + count, 0) / driversNotified.length
        : 0;

      const successRate = totalBookings > 0 ? (successfulMatches / totalBookings) * 100 : 0;
      const timeoutRate = totalBookings > 0 ? (timeoutBookings / totalBookings) * 100 : 0;

      // Calculer heure de pointe
      const hourCounts = bookings.reduce((acc, booking) => {
        const hour = booking.createdAt.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const peakHour = Object.entries(hourCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 0;

      const slowestMatchingTime = Math.max(...matchingTimes, 0);
      const fastestMatchingTime = matchingTimes.length > 0 ? Math.min(...matchingTimes) : 0;

      const report: DailyReport = {
        date,
        totalBookings,
        successfulMatches,
        timeoutBookings,
        cancelledBookings,
        averageMatchingTime: Math.round(averageMatchingTime),
        averageDriversNotified: Math.round(averageDriversNotified),
        successRate: Math.round(successRate * 100) / 100,
        timeoutRate: Math.round(timeoutRate * 100) / 100,
        activeDrivers: activeDriversCount,
        peakHour: parseInt(peakHour.toString()),
        slowestMatchingTime,
        fastestMatchingTime
      };

      logger.info('Daily report generated', { date, report });
      return report;

    } catch (error) {
      logger.error('Failed to generate daily report', {
        date,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        date,
        totalBookings: 0,
        successfulMatches: 0,
        timeoutBookings: 0,
        cancelledBookings: 0,
        averageMatchingTime: 0,
        averageDriversNotified: 0,
        successRate: 0,
        timeoutRate: 0,
        activeDrivers: 0,
        peakHour: 0,
        slowestMatchingTime: 0,
        fastestMatchingTime: 0
      };
    }
  }

  async generateWeeklyReport(startDate: Date): Promise<WeeklyReport> {
    try {
      const weekStart = new Date(startDate);
      const weekEnd = new Date(startDate);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Générer rapports quotidiens pour la semaine
      const dailyReports: DailyReport[] = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dailyReport = await this.generateDailyReport(currentDate);
        dailyReports.push(dailyReport);
      }

      // Agréger les données hebdomadaires
      const totalBookings = dailyReports.reduce((sum, report) => sum + report.totalBookings, 0);
      const successfulMatches = dailyReports.reduce((sum, report) => sum + report.successfulMatches, 0);
      const timeoutBookings = dailyReports.reduce((sum, report) => sum + report.timeoutBookings, 0);
      const cancelledBookings = dailyReports.reduce((sum, report) => sum + report.cancelledBookings, 0);

      const averageMatchingTime = dailyReports.length > 0
        ? dailyReports.reduce((sum, report) => sum + report.averageMatchingTime, 0) / dailyReports.length
        : 0;

      const averageDriversNotified = dailyReports.length > 0
        ? dailyReports.reduce((sum, report) => sum + report.averageDriversNotified, 0) / dailyReports.length
        : 0;

      const successRate = totalBookings > 0 ? (successfulMatches / totalBookings) * 100 : 0;
      const timeoutRate = totalBookings > 0 ? (timeoutBookings / totalBookings) * 100 : 0;

      const activeDrivers = dailyReports.length > 0
        ? Math.max(...dailyReports.map(r => r.activeDrivers))
        : 0;

      const peakHour = this.calculateMostFrequentPeakHour(dailyReports);
      const slowestMatchingTime = Math.max(...dailyReports.map(r => r.slowestMatchingTime), 0);
      const fastestMatchingTime = dailyReports.length > 0
        ? Math.min(...dailyReports.map(r => r.fastestMatchingTime).filter(t => t > 0))
        : 0;

      // Analyser les tendances
      const trendsAnalysis = this.analyzeTrends(dailyReports);

      const weeklyReport: WeeklyReport = {
        date: weekStart,
        weekStart,
        weekEnd,
        totalBookings,
        successfulMatches,
        timeoutBookings,
        cancelledBookings,
        averageMatchingTime: Math.round(averageMatchingTime),
        averageDriversNotified: Math.round(averageDriversNotified),
        successRate: Math.round(successRate * 100) / 100,
        timeoutRate: Math.round(timeoutRate * 100) / 100,
        activeDrivers,
        peakHour,
        slowestMatchingTime,
        fastestMatchingTime,
        dailyBreakdown: dailyReports,
        trendsAnalysis
      };

      logger.info('Weekly report generated', { weekStart, weekEnd, weeklyReport });
      return weeklyReport;

    } catch (error) {
      logger.error('Failed to generate weekly report', {
        startDate,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        date: startDate,
        weekStart: startDate,
        weekEnd: new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000),
        totalBookings: 0,
        successfulMatches: 0,
        timeoutBookings: 0,
        cancelledBookings: 0,
        averageMatchingTime: 0,
        averageDriversNotified: 0,
        successRate: 0,
        timeoutRate: 0,
        activeDrivers: 0,
        peakHour: 0,
        slowestMatchingTime: 0,
        fastestMatchingTime: 0,
        dailyBreakdown: [],
        trendsAnalysis: {
          bookingsTrend: 'STABLE',
          successRateTrend: 'STABLE',
          averageTimeTrend: 'STABLE'
        }
      };
    }
  }

  async getTopPerformingDrivers(timeframe: TimeFrame, limit: number = 10): Promise<DriverStats[]> {
    try {
      const drivers = await prisma.driver.findMany({
        where: {
          isVerified: true,
          isActive: true
        },
        select: {
          id: true,
          name: true
        }
      });

      const driverStats = await Promise.all(
        drivers.map(driver => this.getDriverResponseStats(driver.id, timeframe))
      );

      // Filtrer et trier par taux d'acceptation et nombre de notifications
      const topDrivers = driverStats
        .filter(stats => stats.notificationsReceived > 0)
        .sort((a, b) => {
          // Prioriser par taux d'acceptation, puis par nombre de notifications
          if (b.acceptanceRate !== a.acceptanceRate) {
            return b.acceptanceRate - a.acceptanceRate;
          }
          return b.notificationsReceived - a.notificationsReceived;
        })
        .slice(0, limit);

      logger.debug('Top performing drivers calculated', {
        timeframe,
        limit,
        resultCount: topDrivers.length
      });

      return topDrivers;

    } catch (error) {
      logger.error('Failed to get top performing drivers', {
        timeframe,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return [];
    }
  }

  async getSystemHealthMetrics(): Promise<any> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        activeMatchings,
        recentBookings,
        activeDrivers,
        avgMatchingTime1h,
        avgMatchingTime24h,
        timeoutRate1h,
        timeoutRate24h
      ] = await Promise.all([
        this.getActiveMatchings(),
        prisma.booking.count({
          where: {
            createdAt: {
              gte: oneHourAgo
            }
          }
        }),
        prisma.driver.count({
          where: {
            isAvailable: true,
            isOnline: true,
            isVerified: true
          }
        }),
        this.getAverageMatchingTime({ start: oneHourAgo, end: now }),
        this.getAverageMatchingTime({ start: oneDayAgo, end: now }),
        this.getTimeoutRate({ start: oneHourAgo, end: now }),
        this.getTimeoutRate({ start: oneDayAgo, end: now })
      ]);

      const healthStatus = this.determineHealthStatus({
        activeMatchings,
        activeDrivers,
        timeoutRate1h,
        avgMatchingTime1h
      });

      const metrics = {
        timestamp: now,
        overall: healthStatus,
        activeMatchings,
        recentBookings,
        activeDrivers,
        performance: {
          averageMatchingTime1h: `${avgMatchingTime1h}s`,
          averageMatchingTime24h: `${avgMatchingTime24h}s`,
          timeoutRate1h: `${timeoutRate1h}%`,
          timeoutRate24h: `${timeoutRate24h}%`
        },
        components: {
          database: 'HEALTHY', // Pourrait être vérifié avec un ping
          matching: activeMatchings < 50 ? 'HEALTHY' : 'WARNING',
          drivers: activeDrivers > 5 ? 'HEALTHY' : 'WARNING',
          timeouts: timeoutRate1h < 20 ? 'HEALTHY' : 'CRITICAL'
        }
      };

      logger.debug('System health metrics calculated', metrics);
      return metrics;

    } catch (error) {
      logger.error('Failed to get system health metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        timestamp: new Date(),
        overall: 'CRITICAL',
        error: 'Failed to retrieve metrics'
      };
    }
  }

  // Méthode utilitaire conservée pour usage futur
  // private async getMetricsForTimeframe(timeframe: TimeFrame): Promise<any> {
  //   return prisma.matchingMetrics.findMany({
  //     where: {
  //       createdAt: {
  //         gte: timeframe.start,
  //         lte: timeframe.end
  //       }
  //     }
  //   });
  // }

  private calculateMostFrequentPeakHour(dailyReports: DailyReport[]): number {
    const hourCounts = dailyReports.reduce((acc, report) => {
      acc[report.peakHour] = (acc[report.peakHour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return parseInt(Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '0');
  }

  private analyzeTrends(dailyReports: DailyReport[]): any {
    if (dailyReports.length < 2) {
      return {
        bookingsTrend: 'STABLE',
        successRateTrend: 'STABLE',
        averageTimeTrend: 'STABLE'
      };
    }

    const firstHalf = dailyReports.slice(0, Math.floor(dailyReports.length / 2));
    const secondHalf = dailyReports.slice(Math.floor(dailyReports.length / 2));

    const firstHalfAvg = {
      bookings: firstHalf.reduce((sum, r) => sum + r.totalBookings, 0) / firstHalf.length,
      successRate: firstHalf.reduce((sum, r) => sum + r.successRate, 0) / firstHalf.length,
      avgTime: firstHalf.reduce((sum, r) => sum + r.averageMatchingTime, 0) / firstHalf.length
    };

    const secondHalfAvg = {
      bookings: secondHalf.reduce((sum, r) => sum + r.totalBookings, 0) / secondHalf.length,
      successRate: secondHalf.reduce((sum, r) => sum + r.successRate, 0) / secondHalf.length,
      avgTime: secondHalf.reduce((sum, r) => sum + r.averageMatchingTime, 0) / secondHalf.length
    };

    const bookingsTrend = this.determineTrend(firstHalfAvg.bookings, secondHalfAvg.bookings, 0.1);
    const successRateTrend = this.determineTrend(firstHalfAvg.successRate, secondHalfAvg.successRate, 5);
    const averageTimeTrend = this.determineTrend(firstHalfAvg.avgTime, secondHalfAvg.avgTime, 10);

    return {
      bookingsTrend,
      successRateTrend,
      averageTimeTrend
    };
  }

  private determineTrend(oldValue: number, newValue: number, threshold: number): 'UP' | 'DOWN' | 'STABLE' {
    const change = ((newValue - oldValue) / oldValue) * 100;
    
    if (Math.abs(change) < threshold) {
      return 'STABLE';
    }
    
    return change > 0 ? 'UP' : 'DOWN';
  }

  private determineHealthStatus(metrics: any): 'HEALTHY' | 'WARNING' | 'CRITICAL' {
    if (metrics.timeoutRate1h > 30 || metrics.activeDrivers < 3) {
      return 'CRITICAL';
    }
    
    if (metrics.timeoutRate1h > 15 || metrics.activeDrivers < 5 || metrics.avgMatchingTime1h > 180) {
      return 'WARNING';
    }
    
    return 'HEALTHY';
  }
}

// Export singleton instance
export const MetricsService = MetricsServiceImpl;