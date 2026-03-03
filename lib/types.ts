export type BookingMode = 'request' | 'calendar';

export interface Service {
  name: string;
  durationMin: number;
  priceRange?: string;
  bufferMin?: number;
}

export interface BusinessConfig {
  businessId: string;
  name: string;
  timezone: string;
  hours: Record<string, { open: string; close: string } | null>;
  services: Service[];
  policies: {
    cancellation: string;
    booking: string;
  };
  contact: {
    phone: string;
    email?: string;
    address?: string;
  };
  faq?: Record<string, string>;
  allowedDomains: string[];
  bookingMode: BookingMode;
  styling?: {
    accentColor?: string;
  };
}

export interface BookingRecord {
  bookingId: string;
  businessId: string;
  serviceName: string;
  startTimeISO: string;
  endTimeISO: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  status: 'confirmed' | 'requested';
  notes?: string;
  createdAt: string;
}

export interface HandoffRecord {
  handoffId: string;
  businessId: string;
  summary: string;
  customerContact: string;
  createdAt: string;
}

export interface ConversationLog {
  businessId: string;
  sessionId: string;
  userMessage: string;
  assistantMessage: string;
  createdAt: string;
}
