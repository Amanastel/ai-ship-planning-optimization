const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.transporter = this.createTransporter();
    this.defaultFrom = process.env.EMAIL_USER || 'noreply@shipplanning.com';
  }

  createTransporter() {
    if (process.env.NODE_ENV === 'production') {
      return nodemailer.createTransporter({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    } else {
      // Use ethereal for development
      return nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'ethereal.pass'
        }
      });
    }
  }

  /**
   * Send maintenance alert notification
   */
  async sendMaintenanceAlert(shipData, maintenanceData, recipients) {
    try {
      const subject = `🔧 Maintenance Alert: ${shipData.name} - ${maintenanceData.category}`;
      const html = this.generateMaintenanceAlertHTML(shipData, maintenanceData);

      await this.sendEmail({
        to: recipients,
        subject,
        html
      });

      logger.info(`Maintenance alert sent for ship ${shipData.shipId}`);
    } catch (error) {
      logger.error('Error sending maintenance alert:', error);
    }
  }

  /**
   * Send voyage completion notification
   */
  async sendVoyageNotification(voyageData, recipients) {
    try {
      const subject = `🚢 Voyage Update: ${voyageData.voyageId} - ${voyageData.status}`;
      const html = this.generateVoyageNotificationHTML(voyageData);

      await this.sendEmail({
        to: recipients,
        subject,
        html
      });

      logger.info(`Voyage notification sent for ${voyageData.voyageId}`);
    } catch (error) {
      logger.error('Error sending voyage notification:', error);
    }
  }

  /**
   * Send critical system alert
   */
  async sendCriticalAlert(alertData, recipients) {
    try {
      const subject = `🚨 CRITICAL ALERT: ${alertData.title}`;
      const html = this.generateCriticalAlertHTML(alertData);

      await this.sendEmail({
        to: recipients,
        subject,
        html,
        priority: 'high'
      });

      logger.warn(`Critical alert sent: ${alertData.title}`);
    } catch (error) {
      logger.error('Error sending critical alert:', error);
    }
  }

  /**
   * Send email utility function
   */
  async sendEmail({ to, subject, html, text, priority = 'normal' }) {
    try {
      const mailOptions = {
        from: this.defaultFrom,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.htmlToText(html),
        priority
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully:', info.messageId);
      return info;
    } catch (error) {
      logger.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Generate maintenance alert HTML
   */
  generateMaintenanceAlertHTML(shipData, maintenanceData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert-box { background: #f39c12; color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .details { background: #ecf0f1; padding: 15px; border-radius: 5px; }
          .priority-critical { border-left: 5px solid #e74c3c; }
          .priority-high { border-left: 5px solid #f39c12; }
          .priority-medium { border-left: 5px solid #f1c40f; }
          .priority-low { border-left: 5px solid #27ae60; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔧 Maintenance Alert</h1>
          <p>Ship Planning & Optimization System</p>
        </div>
        <div class="content">
          <div class="alert-box priority-${maintenanceData.priority}">
            <h2>Maintenance Required: ${maintenanceData.category}</h2>
            <p><strong>Ship:</strong> ${shipData.name} (${shipData.shipId})</p>
            <p><strong>Priority:</strong> ${maintenanceData.priority.toUpperCase()}</p>
          </div>
          
          <div class="details">
            <h3>Details</h3>
            <p><strong>Description:</strong> ${maintenanceData.description}</p>
            <p><strong>Scheduled Date:</strong> ${new Date(maintenanceData.scheduledDate).toLocaleDateString()}</p>
            <p><strong>Estimated Duration:</strong> ${maintenanceData.estimatedDuration} hours</p>
            <p><strong>Estimated Cost:</strong> $${maintenanceData.cost?.estimated || 'TBD'}</p>
            
            ${maintenanceData.aiPrediction ? `
              <h4>AI Prediction</h4>
              <p><strong>Risk Score:</strong> ${maintenanceData.aiPrediction.riskScore}/100</p>
              <p><strong>Confidence:</strong> ${maintenanceData.aiPrediction.confidenceLevel}%</p>
              <p><strong>Recommended Action:</strong> ${maintenanceData.aiPrediction.recommendedAction}</p>
            ` : ''}
          </div>
          
          <p>Please review and take appropriate action. For more details, log into the Ship Planning System.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate voyage notification HTML
   */
  generateVoyageNotificationHTML(voyageData) {
    const statusEmoji = {
      'planned': '📋',
      'in-progress': '🚢',
      'completed': '✅',
      'cancelled': '❌',
      'delayed': '⏰'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #3498db; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .status-box { padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
          .status-completed { background: #d5f4e6; color: #27ae60; }
          .status-in-progress { background: #d4edda; color: #155724; }
          .status-planned { background: #cce7ff; color: #0066cc; }
          .status-delayed { background: #fff3cd; color: #856404; }
          .status-cancelled { background: #f8d7da; color: #721c24; }
          .route-info { background: #ecf0f1; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${statusEmoji[voyageData.status]} Voyage Update</h1>
          <p>Ship Planning & Optimization System</p>
        </div>
        <div class="content">
          <div class="status-box status-${voyageData.status}">
            <h2>Voyage ${voyageData.voyageId}</h2>
            <p><strong>Status:</strong> ${voyageData.status.toUpperCase()}</p>
          </div>
          
          <div class="route-info">
            <h3>Voyage Details</h3>
            <p><strong>Ship:</strong> ${voyageData.shipId}</p>
            <p><strong>Route:</strong> ${voyageData.origin.name} → ${voyageData.destination.name}</p>
            <p><strong>Departure:</strong> ${new Date(voyageData.departureTime).toLocaleString()}</p>
            ${voyageData.estimatedArrival ? `<p><strong>Estimated Arrival:</strong> ${new Date(voyageData.estimatedArrival).toLocaleString()}</p>` : ''}
            ${voyageData.actualArrival ? `<p><strong>Actual Arrival:</strong> ${new Date(voyageData.actualArrival).toLocaleString()}</p>` : ''}
            <p><strong>Cargo:</strong> ${voyageData.cargoLoad.weight} tons of ${voyageData.cargoLoad.type}</p>
            
            ${voyageData.fuelPrediction ? `
              <h4>Fuel Information</h4>
              <p><strong>Estimated Consumption:</strong> ${voyageData.fuelPrediction.estimatedConsumption} tons</p>
              ${voyageData.fuelPrediction.actualConsumption ? `<p><strong>Actual Consumption:</strong> ${voyageData.fuelPrediction.actualConsumption} tons</p>` : ''}
            ` : ''}
          </div>
          
          <p>For complete voyage details and tracking, please access the Ship Planning System dashboard.</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate critical alert HTML
   */
  generateCriticalAlertHTML(alertData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .critical-alert { background: #f8d7da; border: 2px solid #e74c3c; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .timestamp { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚨 CRITICAL SYSTEM ALERT</h1>
          <p>Immediate Attention Required</p>
        </div>
        <div class="content">
          <div class="critical-alert">
            <h2>${alertData.title}</h2>
            <p><strong>Description:</strong> ${alertData.description}</p>
            <p><strong>Severity:</strong> ${alertData.severity || 'CRITICAL'}</p>
            ${alertData.shipId ? `<p><strong>Affected Ship:</strong> ${alertData.shipId}</p>` : ''}
            ${alertData.component ? `<p><strong>Component:</strong> ${alertData.component}</p>` : ''}
            <p class="timestamp"><strong>Alert Time:</strong> ${new Date(alertData.timestamp || Date.now()).toLocaleString()}</p>
          </div>
          
          ${alertData.recommendations ? `
            <h3>Recommended Actions</h3>
            <ul>
              ${alertData.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
          ` : ''}
          
          <p><strong>Please take immediate action and investigate this alert.</strong></p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  /**
   * Send SMS notification (placeholder for future implementation)
   */
  async sendSMS(phoneNumber, message) {
    // Implementation would use a service like Twilio
    logger.info(`SMS would be sent to ${phoneNumber}: ${message}`);
  }

  /**
   * Send push notification (placeholder for future implementation)
   */
  async sendPushNotification(deviceTokens, _notification) {
    // Implementation would use Firebase Cloud Messaging
    logger.info(`Push notification would be sent to ${deviceTokens.length} devices`);
  }
}

module.exports = new NotificationService();
