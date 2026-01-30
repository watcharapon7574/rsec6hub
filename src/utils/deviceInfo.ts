/**
 * Device Fingerprint Utility
 *
 * This utility captures basic device information for audit trail purposes.
 * Used to track which device was used to sign documents.
 * No user interaction or verification - just passive logging.
 */

export interface DeviceFingerprint {
  user_agent: string;
  browser: string;
  os: string;
  screen_size: string;
  timestamp: string;
  viewport_size: string;
}

/**
 * Get device fingerprint information
 * @returns DeviceFingerprint object with device details
 */
export function getDeviceFingerprint(): DeviceFingerprint {
  const userAgent = navigator.userAgent;

  // Detect browser
  const browser = detectBrowser(userAgent);

  // Detect OS
  const os = detectOS(userAgent);

  // Get screen information
  const screenSize = `${screen.width}x${screen.height}`;
  const viewportSize = `${window.innerWidth}x${window.innerHeight}`;

  // Get timestamp
  const timestamp = new Date().toISOString();

  return {
    user_agent: userAgent,
    browser,
    os,
    screen_size: screenSize,
    viewport_size: viewportSize,
    timestamp
  };
}

/**
 * Detect browser from user agent
 */
function detectBrowser(userAgent: string): string {
  if (userAgent.includes('Firefox/')) {
    return 'Firefox';
  } else if (userAgent.includes('Edg/')) {
    return 'Edge';
  } else if (userAgent.includes('Chrome/')) {
    return 'Chrome';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
    return 'Safari';
  } else if (userAgent.includes('Opera/') || userAgent.includes('OPR/')) {
    return 'Opera';
  }
  return 'Unknown';
}

/**
 * Detect operating system from user agent
 */
function detectOS(userAgent: string): string {
  if (userAgent.includes('Windows')) {
    return 'Windows';
  } else if (userAgent.includes('Mac OS X')) {
    return 'macOS';
  } else if (userAgent.includes('Linux')) {
    return 'Linux';
  } else if (userAgent.includes('Android')) {
    return 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    return 'iOS';
  }
  return 'Unknown';
}
