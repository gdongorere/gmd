// src/components/ContactForm.tsx
'use client';

import React, { useRef, useState } from 'react';
import {
  Alert, AlertDescription, AlertIcon, AlertTitle, Box, Button, FormControl, FormErrorMessage, FormHelperText, FormLabel, Heading, Input,
  Stack, Text, Textarea,
} from '@chakra-ui/react';
import { FiCheckCircle, FiSend } from 'react-icons/fi';
import {
  CONTACT_LIMITS, validateContact, validateField, type ContactErrors, type ContactField, type ContactInput,
} from '@/lib/contactSchema';
import { GlassCard } from '@/components/ui';

type Status = 'idle' | 'sending' | 'sent' | 'error';
const EMPTY: ContactInput = { name: '', email: '', phone: '', subject: '', message: '' };
const ORDER: ContactField[] = ['name', 'email', 'phone', 'subject', 'message'];

export default function ContactForm() {
  const [values, setValues] = useState<ContactInput>(EMPTY);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverMessage, setServerMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const change = (field: ContactField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
    // Once a field has been visited, re-validate as the visitor fixes it.
    if (touched[field]) setErrors((errs) => ({ ...errs, [field]: validateField(field, value) }));
  };
  const blur = (field: ContactField) => () => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors((errs) => ({ ...errs, [field]: validateField(field, values[field]) }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'sending') return;
    const result = validateContact(values);
    setTouched({ name: true, email: true, phone: true, subject: true, message: true });
    setErrors(result.errors);
    if (!result.ok) {
      const first = ORDER.find((f) => result.errors[f]);
      if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setStatus('sending');
    setServerMessage('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...result.data, website: honeypot }),
      });
      const body = (await response.json().catch(() => ({}))) as { message?: string; errors?: ContactErrors };
      if (response.ok) {
        setStatus('sent');
        setValues(EMPTY);
        setTouched({});
        setErrors({});
        // Move focus to the confirmation so screen-reader users hear it.
        window.setTimeout(() => headingRef.current?.focus(), 50);
        return;
      }
      if (body.errors) setErrors(body.errors);
      setServerMessage(body.message ?? 'Something went wrong. Please try again.');
      setStatus('error');
    } catch {
      setServerMessage('I couldn’t reach the server. Check your connection and try again, or email me directly.');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <GlassCard strong p={{ base: 6, md: 10 }} textAlign="center" role="status">
        <Stack spacing={5} align="center">
          <Box as={FiCheckCircle} boxSize={12} color="green.300" aria-hidden="true" />
          <Heading as="h2" size="xl" ref={headingRef} tabIndex={-1} _focus={{ outline: 'none' }}>Message sent</Heading>
          <Text color="content.secondary" fontSize="lg" maxW="md">
            Thanks for reaching out. I’ll reply within two business days.
          </Text>
          <Button variant="outline" onClick={() => setStatus('idle')}>Send another message</Button>
        </Stack>
      </GlassCard>
    );
  }

  const messageLength = values.message.trim().length;
  const errorList = ORDER.filter((f) => errors[f]);

  return (
    <GlassCard strong p={{ base: 6, md: 8 }} as="form" ref={formRef} onSubmit={submit} noValidate aria-labelledby="contact-form-title">
      <Stack spacing={5}>
        <Heading as="h2" id="contact-form-title" size="lg">Send a message</Heading>

        {(status === 'error' || (errorList.length > 1 && status !== 'sending' && Object.values(touched).every(Boolean))) && (
          <Alert status="error" variant="left-accent" borderRadius="lg" bg="rgba(229, 62, 62, 0.14)" role="alert" alignItems="flex-start">
            <AlertIcon />
            <Box>
              <AlertTitle>{status === 'error' && serverMessage ? 'Your message wasn’t sent' : 'Please fix the highlighted fields'}</AlertTitle>
              {serverMessage && <AlertDescription>{serverMessage}</AlertDescription>}
            </Box>
          </Alert>
        )}

        <FormControl isRequired isInvalid={!!errors.name}>
          <FormLabel>Your name</FormLabel>
          <Input name="name" value={values.name} onChange={change('name')} onBlur={blur('name')} autoComplete="name" maxLength={CONTACT_LIMITS.name.max + 20} />
          <FormErrorMessage>{errors.name}</FormErrorMessage>
        </FormControl>

        <FormControl isRequired isInvalid={!!errors.email}>
          <FormLabel>Email</FormLabel>
          <Input type="email" name="email" value={values.email} onChange={change('email')} onBlur={blur('email')} autoComplete="email" inputMode="email" placeholder="you@example.com" />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.phone}>
          <FormLabel>Phone <Text as="span" color="content.muted" fontWeight={400}>(optional)</Text></FormLabel>
          <Input type="tel" name="phone" value={values.phone ?? ''} onChange={change('phone')} onBlur={blur('phone')} autoComplete="tel" inputMode="tel" />
          <FormErrorMessage>{errors.phone}</FormErrorMessage>
        </FormControl>

        <FormControl isRequired isInvalid={!!errors.subject}>
          <FormLabel>Subject</FormLabel>
          <Input name="subject" value={values.subject} onChange={change('subject')} onBlur={blur('subject')} autoComplete="off" />
          <FormErrorMessage>{errors.subject}</FormErrorMessage>
        </FormControl>

        <FormControl isRequired isInvalid={!!errors.message}>
          <FormLabel>Message</FormLabel>
          <Textarea name="message" rows={6} value={values.message} onChange={change('message')} onBlur={blur('message')} autoComplete="off" resize="vertical" />
          {errors.message ? (
            <FormErrorMessage>{errors.message}</FormErrorMessage>
          ) : (
            <FormHelperText color="content.muted">{messageLength} / {CONTACT_LIMITS.message.max}</FormHelperText>
          )}
        </FormControl>

        {/* Honeypot: invisible to people and assistive tech; bots fill it in. */}
        <Box aria-hidden="true" position="absolute" left="-10000px" top="auto" w="1px" h="1px" overflow="hidden">
          <label>
            Leave this field empty
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </label>
        </Box>

        <Button type="submit" size="lg" isLoading={status === 'sending'} loadingText="Sending…" leftIcon={<FiSend aria-hidden="true" />} alignSelf={{ base: 'stretch', md: 'flex-start' }}>
          Send message
        </Button>
      </Stack>
    </GlassCard>
  );
}
