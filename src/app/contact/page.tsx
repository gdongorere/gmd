// src/app/contact/page.tsx
import type { Metadata } from 'next';
import ContactPageContent from '@/components/ContactPageContent';
import { profile } from '@/data/profile';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Get in touch with ${profile.name} about a project, a role or a question. Replies within two business days.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return <ContactPageContent />;
}
