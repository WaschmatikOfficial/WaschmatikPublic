export type PartnerStatus = 'pending' | 'active' | 'paused' | 'inactive';
export type RequestStatus = 'new' | 'assigned' | 'contacted' | 'in_progress' | 'completed' | 'cancelled';
export type OrderStatus = 'open' | 'completed' | 'cancelled';
export type InvoiceStatus = 'offen' | 'bezahlt' | 'überfällig' | 'storniert';

export type Business = {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city: string;
  website?: string | null;
  description?: string | null;
  status: PartnerStatus;
  commission_percent: number;
  service_area?: string[];
};

export type AppRow = Business & { created_at: string; updated_at: string };

export type Inquiry = {
  id: string;
  request_id: string;
  request_code: string;
  partner_id?: string | null;
  business_name?: string | null;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_postal_code: string;
  customer_city: string;
  brand?: string | null;
  model?: string | null;
  problem: string;
  problem_description: string;
  preferred_date?: string | null;
  preferred_time?: string | null;
  status: RequestStatus;
  order_value: number;
  commission_amount: number;
  commission_percentage: number;
  invoice_number?: string | null;
  invoice_status?: InvoiceStatus | null;
  invoice_due_at?: string | null;
  invoice_paid_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  request_id: string;
  business_id: string;
  business_name?: string | null;
  order_value: number;
  commission_percentage: number;
  commission_amount: number;
  status: InvoiceStatus;
  due_at: string;
  paid_at?: string | null;
  created_at: string;
};
