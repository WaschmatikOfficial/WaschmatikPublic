export type Business = {
  id: string;
  name: string;
  city: string;
  email: string;
  active: boolean;
  service_area: string[] | string;
  rating?: number;
  review_count?: number;
  website?: string;
  description?: string;
  image?: string;
};

export type AppRow = {
  id: string;
  business_name: string;
  contact_person?: string;
  email: string;
  phone: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  website?: string;
  google_maps_url?: string;
  services: string;
  service_area: string;
  description: string;
  image?: string;
  status: string;
  terms_version: string;
  terms_accepted_at: string;
  created_at: string;
};

export type InquiryStatus = 'new'|'contacted'|'accepted'|'completed'|'cancelled';

export type Inquiry = {
  id: string;
  inquiry_id: string;
  business_id: string;
  business_name?: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_postal_code: string;
  customer_city: string;
  problem: string;
  problem_description: string;
  preferred_contact: string;
  status: InquiryStatus | string;
  email_status: string;
  email_sent_at?: string;
  order_value: number;
  commission_percentage: number;
  commission_amount: number;
  partner_response_at?: string;
  completed_at?: string;
  customer_confirmation_status?: 'pending'|'completed'|'not_completed'|'disputed'|'expired'|string;
  customer_confirmation_at?: string;
  customer_invoice_amount?: number | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  inquiry_id: string;
  business_id: string;
  status: 'accepted'|'in_progress'|'completed'|'cancelled'|string;
  order_value: number;
  customer_reported_value?: number | null;
  customer_confirmation_status?: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  inquiry_id: string;
  business_id: string;
  order_value: number;
  commission_percentage: number;
  commission_amount: number;
  status: string;
  issued_at: string;
  due_at: string;
  paid_at?: string;
};
